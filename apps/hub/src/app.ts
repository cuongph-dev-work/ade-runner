import { existsSync } from "node:fs";
import { resolve } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import type { FSWatcher } from "chokidar";
import { AdeModeSchema, ERROR_CODES, type AdeMode } from "@ade/shared";
import { openHubDatabase, type HubDatabase } from "./db/client.js";
import { createLocalOriginPreHandler } from "./plugins/local-origin-guard.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerChatRoutes } from "./routes/chat.js";
import { registerWsRoutes } from "./routes/ws.js";
import { InMemoryEventBus } from "./events/event-bus.js";
import { ChatService, HubDomainError } from "./chat/chat-service.js";
import { syncProjectAdeConfig, watchProjectAdeDirectory } from "./config/ade-loader.js";

export interface BuildHubAppOptions {
  dbPath: string;
  mode?: AdeMode;
  version?: string;
  webDistDir?: string;
  defaultRepoPath?: string;
  watchAdeFiles?: boolean;
}

export interface HubServerBundle {
  app: FastifyInstance;
  hubDb: HubDatabase;
  chatService: ChatService;
  eventBus: InMemoryEventBus;
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

  return { app, hubDb, chatService, eventBus };
}
