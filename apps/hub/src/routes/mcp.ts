import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { McpServer } from "../mcp/mcp-server.js";
import type { McpTokenService } from "../mcp/mcp-token-service.js";
import { HubMcpError } from "../mcp/mcp-token-service.js";

export const registerMcpRoutes: FastifyPluginAsync<{
  mcpServer: McpServer;
  tokenService: McpTokenService;
  lookupRunStatus: (runId: string) => { status: string; thread_id: string; project_id: string; agent_id: string } | null;
}> = async (app: FastifyInstance, opts) => {
  app.post("/mcp", async (req, reply) => {
    let claims;
    try {
      claims = opts.tokenService.verifyToken(
        req.headers.authorization,
        opts.lookupRunStatus
      );
    } catch (err) {
      if (err instanceof HubMcpError) {
        return reply.status(err.httpStatus).send({
          jsonrpc: "2.0",
          error: { code: -32002, message: err.message, data: { code: err.code } },
        });
      }
      return reply.status(401).send({
        jsonrpc: "2.0",
        error: { code: -32002, message: "Unauthorized" },
      });
    }

    try {
      const body = req.body as { jsonrpc?: string; id?: number | string; method: string; params?: Record<string, unknown> };
      const res = await opts.mcpServer.handleRpc(claims, body);
      return reply.status(200).send(res);
    } catch (err) {
      if (err instanceof HubMcpError) {
        return reply.status(err.httpStatus).send({
          jsonrpc: "2.0",
          error: { code: err.httpStatus === 403 ? -32003 : -32001, message: err.message, data: { code: err.code } },
        });
      }
      return reply.status(500).send({
        jsonrpc: "2.0",
        error: { code: -32603, message: err instanceof Error ? err.message : String(err) },
      });
    }
  });
};
