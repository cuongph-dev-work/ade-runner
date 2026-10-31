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
import { GateService } from "./orchestration/gate-service.js";
import { ThreadScheduler } from "./orchestration/thread-scheduler.js";
import { registerOrchestrationRoutes } from "./routes/orchestration.js";
import { syncProjectAdeConfig, watchProjectAdeDirectory } from "./config/ade-loader.js";
import { SettingsService } from "./config/settings-service.js";
import { registerSettingsRoutes } from "./routes/settings.js";

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
  settingsService: SettingsService;
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

  let runDispatcher: RunDispatcher;

  const gateService = new GateService({
    sqlite: hubDb.sqlite,
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
    wakeAgent: (params) => {
      const thread = hubDb.sqlite
        .prepare("SELECT project_id, main_agent_id FROM threads WHERE id = ?")
        .get(params.threadId) as { project_id: string; main_agent_id: string | null } | undefined;
      if (thread && thread.main_agent_id) {
        runDispatcher.onAgentMentioned({
          projectId: thread.project_id,
          threadId: params.threadId,
          agentId: thread.main_agent_id,
          invokedBy: LOCAL_USER_ID,
          promptText: params.prompt,
          role: "main",
        });
      }
    },
  });

  const threadScheduler = new ThreadScheduler({
    sqlite: hubDb.sqlite,
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
    dispatchRun: async (params) => {
      const thread = hubDb.sqlite
        .prepare("SELECT project_id FROM threads WHERE id = ?")
        .get(params.threadId) as { project_id: string } | undefined;
      const runId = runDispatcher.onAgentMentioned({
        projectId: thread?.project_id ?? "",
        threadId: params.threadId,
        agentId: params.agentId,
        invokedBy: params.invokedBy,
        promptText: params.promptText,
        role: params.role ?? "worker",
        delegationId: params.delegationId,
        parentRunId: params.parentRunId,
        task: params.task,
      });
      return runId ?? `run_${ulid().toLowerCase()}`;
    },
    tryDispatchQueued: (threadId) => {
      runDispatcher.tryDispatchQueuedRuns(threadId);
    },
  });

  chatService.setGateService(gateService);

  const mcpServer = new McpServer({
    sqlite: hubDb.sqlite,
    grantService,
    gateService,
    threadScheduler,
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

  const settingsService = new SettingsService({
    sqlite: hubDb.sqlite,
    publishEvent: (type, payload, opts) => {
      hubDb.appendAndProject([
        {
          id: `evt_${ulid()}`,
          type: type as EventType,
          ts: new Date().toISOString(),
          project_id: opts?.projectId ?? null,
          thread_id: null,
          run_id: null,
          actor: { type: (opts?.actorType as ActorType) ?? "human", id: opts?.actorId ?? LOCAL_USER_ID },
          causation_id: null,
          correlation_id: null,
          payload,
        },
      ]);
    },
    broadcastWs: (frame) => {
      eventBus.publish(frame as unknown as WsServerEvent);
    },
  });

  runDispatcher = new RunDispatcher({
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
    resolveAgentSkills: (agentId) => {
      const skills = hubDb.sqlite
        .prepare(
          `SELECT s.name, s.scope, s.path, s.content_hash
           FROM skills s
           INNER JOIN agent_skills ask ON ask.skill_id = s.id
           WHERE ask.agent_id = ?`
        )
        .all(agentId) as Array<{
        name: string;
        scope: "project" | "global";
        path: string;
        content_hash: string;
      }>;
      return skills.map((s) => ({
        name: s.name,
        sourceDir: s.path,
        contentHash: s.content_hash,
      }));
    },
  });

  runDispatcher.onDelegationCheck = (delegationId) => {
    const finished = threadScheduler.checkAndHandleFanIn(delegationId);
    if (finished) {
      const runs = hubDb.sqlite
        .prepare(
          `SELECT r.thread_id, r.project_id, r.parent_run_id, r.status, r.outcome, r.summary, a.handle
           FROM runs r INNER JOIN agents a ON a.id = r.agent_id
           WHERE r.delegation_id = ?`
        )
        .all(delegationId) as Array<{
        thread_id: string;
        project_id: string;
        parent_run_id: string | null;
        status: string;
        outcome: string | null;
        summary: string | null;
        handle: string;
      }>;
      if (runs.length > 0) {
        const threadId = runs[0].thread_id;
        const thread = hubDb.sqlite
          .prepare("SELECT main_agent_id FROM threads WHERE id = ?")
          .get(threadId) as { main_agent_id: string | null } | undefined;
        if (thread?.main_agent_id) {
          const summaryList = runs
            .map((r) => `- ${r.handle}: ${r.status} (${r.outcome ?? "unknown"}) — "${r.summary ?? ""}"`)
            .join("\n");
          const prompt = `[TỔNG HỢP KẾT QUẢ CÁC WORKER (delegation: ${delegationId})]\n${summaryList}\n\nVui lòng kiểm tra và tiếp tục điều phối hoặc báo cáo outcome.`;
          runDispatcher.onAgentMentioned({
            projectId: runs[0].project_id,
            threadId,
            agentId: thread.main_agent_id,
            invokedBy: LOCAL_USER_ID,
            promptText: prompt,
            role: "main",
          });
        }
      }
    }
  };

  eventBus.subscribe((frame) => {
    if (frame.type === "agent.mentioned") {
      try {
        const agentRow = hubDb.sqlite
          .prepare("SELECT role, can_be_main FROM agents WHERE id = ?")
          .get(frame.data.agentId) as { role: string; can_be_main: number } | undefined;
        const threadRow = hubDb.sqlite
          .prepare("SELECT main_agent_id FROM threads WHERE id = ?")
          .get(frame.data.threadId) as { main_agent_id: string | null } | undefined;

        const isMain =
          threadRow?.main_agent_id === frame.data.agentId ||
          agentRow?.role === "main" ||
          (!threadRow?.main_agent_id && Boolean(agentRow?.can_be_main));

        const assignedRole: "main" | "worker" = isMain ? "main" : "worker";

        if (isMain && !threadRow?.main_agent_id) {
          hubDb.sqlite
            .prepare("UPDATE threads SET main_agent_id = ? WHERE id = ?")
            .run(frame.data.agentId, frame.data.threadId);
        }

        grantService.grantAgent({
          threadId: frame.data.threadId,
          agentId: frame.data.agentId,
          role: assignedRole,
          scope: "full",
          grantedBy: LOCAL_USER_ID,
        });

        runDispatcher.onAgentMentioned({
          projectId: frame.data.projectId,
          threadId: frame.data.threadId,
          agentId: frame.data.agentId,
          invokedBy: LOCAL_USER_ID,
          promptText: frame.data.text,
          role: assignedRole,
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
        .prepare("SELECT status, thread_id, project_id, agent_id, role FROM runs WHERE id = ?")
        .get(runId) as { status: string; thread_id: string; project_id: string; agent_id: string; role?: string } | undefined;
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
  await registerOrchestrationRoutes(app, {
    sqlite: hubDb.sqlite,
    gateService,
  });
  await registerSettingsRoutes(app, {
    sqlite: hubDb.sqlite,
    settingsService,
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
    settingsService,
  };
}
