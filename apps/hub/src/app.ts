import { existsSync } from "node:fs";
import { resolve } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import type { FSWatcher } from "chokidar";
import { ulid } from "ulid";
import {
  AdeModeSchema,
  ERROR_CODES,
  type ActorType,
  type AdeMode,
  type EventType,
  type WsServerEvent,
} from "@ade/shared";
import { InProcessRunnerTransport, type RunnerTransport } from "@ade/runner";
import { openHubDatabase, type HubDatabase } from "./db/client.js";
import { LOCAL_USER_ID } from "./db/projector.js";
import { createLocalOriginPreHandler } from "./plugins/local-origin-guard.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerChatRoutes } from "./routes/chat.js";
import { registerWsRoutes } from "./routes/ws.js";
import { registerRunRoutes } from "./routes/runs.js";
import { registerMcpRoutes } from "./routes/mcp.js";
import { registerQuestionRoutes } from "./routes/questions.js";
import { registerGrantRoutes } from "./routes/grants.js";
import { InMemoryEventBus } from "./events/event-bus.js";
import { ChatService, HubDomainError } from "./chat/chat-service.js";
import { HubDomainError as RunnerDomainError } from "./runner/state-machines.js";
import { RunDispatcher } from "./runner/run-dispatcher.js";
import { GrantService } from "./trigger/grant-service.js";
import { McpTokenService, HubMcpError } from "./mcp/mcp-token-service.js";
import { McpServer } from "./mcp/mcp-server.js";
import { RuleEngine } from "./trigger/rule-engine.js";
import { syncProjectAdeConfig, watchProjectAdeDirectory } from "./config/ade-loader.js";

export interface BuildHubAppOptions {
  dbPath: string;
  mode?: AdeMode;
  version?: string;
  webDistDir?: string;
  defaultRepoPath?: string;
  watchAdeFiles?: boolean;
  runnerTransport?: RunnerTransport;
  mcpUrl?: string;
}

export interface HubServerBundle {
  app: FastifyInstance;
  hubDb: HubDatabase;
  chatService: ChatService;
  eventBus: InMemoryEventBus;
  runDispatcher: RunDispatcher;
  runnerTransport: RunnerTransport;
  grantService: GrantService;
  mcpServer: McpServer;
  ruleEngine: RuleEngine;
  mcpTokenService: McpTokenService;
}

export async function buildHubApp(
  options: BuildHubAppOptions
): Promise<HubServerBundle> {
  const mode = AdeModeSchema.parse(options.mode ?? process.env.ADE_MODE ?? "solo");
  const version = options.version ?? "0.1.0";
  const hubDb = openHubDatabase(options.dbPath);
  const eventBus = new InMemoryEventBus();
  const chatService = new ChatService(hubDb, eventBus);

  const defaultRepo = options.defaultRepoPath ?? process.env.ADE_DEFAULT_REPO;
  if (defaultRepo && defaultRepo.trim().length > 0) {
    chatService.registerRepoIfMissing(defaultRepo.trim());
  }
  chatService.syncAllProjectsAdeConfig();

  const watchers: FSWatcher[] = [];
  if (options.watchAdeFiles !== false) {
    for (const proj of chatService.listProjects()) {
      if (existsSync(proj.repoPath)) {
        const w = watchProjectAdeDirectory(proj.repoPath, () => {
          if (!hubDb.sqlite.open) return;
          const res = syncProjectAdeConfig(hubDb.sqlite, proj.id);
          eventBus.publish({
            type: "project.config_updated",
            data: {
              projectId: proj.id,
              agents: res.agents,
              configErrors: res.configErrors
            }
          });
        });
        watchers.push(w);
      }
    }
  }

  const runnerTransport = options.runnerTransport ?? new InProcessRunnerTransport();
  const grantService = new GrantService(hubDb.sqlite);
  const mcpTokenService = new McpTokenService();

  const mcpServer = new McpServer({
    sqlite: hubDb.sqlite,
    grantService,
    appendEvent: (evt) => {
      hubDb.appendAndProject([
        {
          id: `evt_${ulid()}`,
          type: evt.type as EventType,
          ts: new Date().toISOString(),
          project_id: evt.projectId,
          thread_id: evt.threadId,
          run_id: evt.runId,
          actor: { type: evt.actorType as ActorType, id: evt.actorId },
          causation_id: null,
          correlation_id: evt.threadId,
          payload: evt.payload,
        },
      ]);
    },
    broadcastWs: (_threadId, event) => {
      eventBus.publish(event as unknown as WsServerEvent);
    },
  });

  const ruleEngine = new RuleEngine({
    sqlite: hubDb.sqlite,
    defaultRepoPath: defaultRepo,
    appendEvent: (evt) => {
      hubDb.appendAndProject([
        {
          id: `evt_${ulid()}`,
          type: evt.type as EventType,
          ts: new Date().toISOString(),
          project_id: evt.projectId,
          thread_id: evt.threadId,
          run_id: evt.runId,
          actor: { type: evt.actorType as ActorType, id: evt.actorId },
          causation_id: evt.causationId ?? null,
          correlation_id: evt.threadId,
          payload: evt.payload,
        },
      ]);
    },
    postMessage: (threadId, body) => {
      return chatService.postMessage(threadId, { body });
    },
  });

  const runDispatcher = new RunDispatcher({
    sqlite: hubDb.sqlite,
    mode,
    mcpUrl: options.mcpUrl ?? "http://127.0.0.1:3000/mcp",
    transport: runnerTransport,
    appendEvent: (evt) => {
      hubDb.appendAndProject([
        {
          id: `evt_${ulid()}`,
          type: evt.type as EventType,
          ts: new Date().toISOString(),
          project_id: evt.projectId,
          thread_id: evt.threadId,
          run_id: evt.runId,
          actor: { type: evt.actorType as ActorType, id: evt.actorId },
          causation_id: null,
          correlation_id: evt.threadId,
          payload: evt.payload,
        },
      ]);
    },
    broadcastWs: (_threadId, event) => {
      eventBus.publish(event as unknown as WsServerEvent);
    },
    resolveAgentSkills: () => [],
  });

  eventBus.subscribe((frame) => {
    if (frame.type === "agent.mentioned") {
      try {
        grantService.grantAgent({
          threadId: frame.data.threadId,
          agentId: frame.data.agentId,
          role: "worker",
          scope: "full",
          grantedBy: LOCAL_USER_ID,
        });

        runDispatcher.onAgentMentioned({
          projectId: frame.data.projectId,
          threadId: frame.data.threadId,
          agentId: frame.data.agentId,
          invokedBy: LOCAL_USER_ID,
          promptText: frame.data.text,
        });
      } catch (err) {
        console.error("Failed to dispatch agent run:", err);
      }
    }

    if (frame.type && !frame.type.startsWith("ws.")) {
      try {
        const frameData = (frame as { data?: Record<string, unknown> }).data ?? {};
        ruleEngine.onEvent({
          type: frame.type,
          projectId: (frameData.projectId as string) ?? null,
          threadId: (frameData.threadId as string) ?? null,
          runId: (frameData.runId as string) ?? null,
          actorId: "system",
          payload: frameData,
        });
      } catch (err) {
        console.error("RuleEngine evaluation error:", err);
      }
    }
  });

  const app = Fastify({ logger: false });
  await app.register(fastifyWebsocket);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HubDomainError) {
      void reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
        details: error.details
      });
      return;
    }

    if (error instanceof RunnerDomainError) {
      void reply.status(error.httpStatus).send({
        code: error.code,
        message: error.message,
        details: error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}
      });
      return;
    }

    if (error instanceof HubMcpError) {
      void reply.status(error.httpStatus).send({
        code: error.code,
        message: error.message,
        details: error.details
      });
      return;
    }

    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof (error as { statusCode?: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 500;
    const isValidation = statusCode === 422;
    void reply.status(statusCode).send({
      code: isValidation ? "ERR_VALIDATION" : "ERR_INTERNAL_ERROR",
      message: isValidation
        ? ERROR_CODES.ERR_VALIDATION.defaultMessage
        : ERROR_CODES.ERR_INTERNAL_ERROR.defaultMessage,
      details: {}
    });
  });

  app.addHook("preHandler", createLocalOriginPreHandler(mode));
  await registerHealthRoutes(app, { hubDb, version });
  await registerChatRoutes(app, chatService);
  await registerWsRoutes(app, eventBus);
  await registerRunRoutes(app, { dispatcher: runDispatcher, mode });
  await registerMcpRoutes(app, {
    mcpServer,
    tokenService: mcpTokenService,
    lookupRunStatus: (runId) => {
      const r = hubDb.sqlite
        .prepare("SELECT status, thread_id, project_id, agent_id FROM runs WHERE id = ?")
        .get(runId) as { status: string; thread_id: string; project_id: string; agent_id: string } | undefined;
      return r ?? null;
    },
  });
  await registerQuestionRoutes(app, {
    sqlite: hubDb.sqlite,
    appendEvent: (evt) => {
      hubDb.appendAndProject([
        {
          id: `evt_${ulid()}`,
          type: evt.type,
          ts: new Date().toISOString(),
          project_id: evt.projectId,
          thread_id: evt.threadId,
          run_id: evt.runId,
          actor: { type: evt.actorType, id: evt.actorId },
          causation_id: null,
          correlation_id: evt.threadId,
          payload: evt.payload,
        },
      ]);
    },
  });
  await registerGrantRoutes(app, {
    grantService,
    appendEvent: (evt) => {
      hubDb.appendAndProject([
        {
          id: `evt_${ulid()}`,
          type: evt.type,
          ts: new Date().toISOString(),
          project_id: evt.projectId,
          thread_id: evt.threadId,
          run_id: evt.runId,
          actor: { type: evt.actorType, id: evt.actorId },
          causation_id: null,
          correlation_id: evt.threadId,
          payload: evt.payload,
        },
      ]);
    },
    getProjectIdByThreadId: (thId) => {
      const r = hubDb.sqlite.prepare("SELECT project_id FROM threads WHERE id = ?").get(thId) as
        | { project_id: string }
        | undefined;
      return r?.project_id ?? null;
    },
  });

  const distDir =
    options.webDistDir ?? resolve(import.meta.dirname, "../../web/dist");
  if (existsSync(distDir)) {
    await app.register(fastifyStatic, {
      root: distDir,
      prefix: "/"
    });
    app.setNotFoundHandler(async (req, reply) => {
      if (req.url.startsWith("/api")) {
        return reply.status(404).send({
          code: "ERR_NOT_FOUND",
          message: ERROR_CODES.ERR_NOT_FOUND.defaultMessage,
          details: {}
        });
      }
      return reply.sendFile("index.html");
    });
  }

  app.addHook("onClose", async () => {
    for (const w of watchers) {
      await w.close();
    }
    if (hubDb.sqlite.open) {
      hubDb.close();
    }
  });

  return {
    app,
    hubDb,
    chatService,
    eventBus,
    runDispatcher,
    runnerTransport,
    grantService,
    mcpServer,
    ruleEngine,
    mcpTokenService,
  };
}
