import type { FastifyInstance } from "fastify";
import { ERROR_CODES, HealthResponseSchema } from "@ade/shared";
import type { HubDatabase } from "../db/client.js";

export interface HealthRouteOptions {
  hubDb: HubDatabase;
  version: string;
}

export async function registerHealthRoutes(
  app: FastifyInstance,
  options: HealthRouteOptions
): Promise<void> {
  app.get("/api/health", async (_request, reply) => {
    try {
      const eventCount = options.hubDb.countEvents();
      const body = HealthResponseSchema.parse({
        status: "ok",
        mode: "solo",
        dbConnected: true,
        eventCount,
        version: options.version
      });
      return await reply.status(200).send(body);
    } catch {
      return await reply.status(ERROR_CODES.ERR_INTERNAL_ERROR.http).send({
        code: "ERR_INTERNAL_ERROR",
        message: ERROR_CODES.ERR_INTERNAL_ERROR.defaultMessage,
        details: {}
      });
    }
  });
}
