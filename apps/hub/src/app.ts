import { existsSync } from "node:fs";
import { resolve } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { AdeModeSchema, ERROR_CODES, type AdeMode } from "@ade/shared";
import { openHubDatabase, type HubDatabase } from "./db/client.js";
import { createLocalOriginPreHandler } from "./plugins/local-origin-guard.js";
import { registerHealthRoutes } from "./routes/health.js";

export interface BuildHubAppOptions {
  dbPath: string;
  mode?: AdeMode;
  version?: string;
  webDistDir?: string;
}

export interface HubServerBundle {
  app: FastifyInstance;
  hubDb: HubDatabase;
}

export async function buildHubApp(
  options: BuildHubAppOptions
): Promise<HubServerBundle> {
  const mode = AdeModeSchema.parse(options.mode ?? process.env.ADE_MODE ?? "solo");
  const version = options.version ?? "0.1.0";
  const hubDb = openHubDatabase(options.dbPath);

  const app = Fastify({ logger: false });

  app.setErrorHandler((error, _request, reply) => {
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
          message: "Không tìm thấy dữ liệu yêu cầu.",
          details: {}
        });
      }
      return reply.sendFile("index.html");
    });
  }

  app.addHook("onClose", async () => {
    if (hubDb.sqlite.open) {
      hubDb.close();
    }
  });

  return { app, hubDb };
}
