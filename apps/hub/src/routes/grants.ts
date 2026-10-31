import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { GrantService } from "../trigger/grant-service.js";
import type { EventType, ActorType } from "@ade/shared";

export const registerGrantRoutes: FastifyPluginAsync<{
  grantService: GrantService;
  appendEvent: (evt: {
    type: EventType;
    projectId: string | null;
    threadId: string | null;
    runId: string | null;
    actorType: ActorType;
    actorId: string;
    payload: Record<string, unknown>;
  }) => void;
  getProjectIdByThreadId: (threadId: string) => string | null;
}> = async (app: FastifyInstance, opts) => {
  app.get<{ Params: { threadId: string } }>(
    "/api/threads/:threadId/agents",
    async (req, reply) => {
      const { threadId } = req.params;
      const grants = opts.grantService.listGrants(threadId);
      return reply.status(200).send({
        thread_id: threadId,
        grants,
      });
    }
  );

  app.delete<{ Params: { threadId: string; agentId: string } }>(
    "/api/threads/:threadId/agents/:agentId",
    async (req, reply) => {
      const { threadId, agentId } = req.params;
      opts.grantService.revokeAgent(threadId, agentId);
      const projectId = opts.getProjectIdByThreadId(threadId);

      const now = new Date().toISOString();
      opts.appendEvent({
        type: "agent.revoked",
        projectId,
        threadId,
        runId: null,
        actorType: "human",
        actorId: "usr_current",
        payload: {
          agent_id: agentId,
          ts: now,
        },
      });

      return reply.status(200).send({
        thread_id: threadId,
        agent_id: agentId,
        status: "revoked",
        revoked_at: now,
      });
    }
  );
};
