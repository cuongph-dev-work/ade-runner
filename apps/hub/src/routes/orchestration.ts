import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import { ApprovalDecisionInputSchema, ThreadIdParamSchema } from "@ade/shared";
import type { GateService } from "../orchestration/gate-service.js";
import { HubDomainError } from "../chat/chat-service.js";

export function registerOrchestrationRoutes(
  app: FastifyInstance,
  deps: {
    sqlite: Database.Database;
    gateService: GateService;
  }
): void {
  // POST /api/threads/:threadId/approvals/:approvalId/decision
  app.post("/api/threads/:threadId/approvals/:approvalId/decision", async (req, reply) => {
    const params = req.params as { threadId?: string; approvalId?: string };
    const threadId = params.threadId;
    const approvalId = params.approvalId;

    if (!threadId || !approvalId) {
      throw new HubDomainError(422, "ERR_VALIDATION");
    }

    const body = ApprovalDecisionInputSchema.parse(req.body);

    const result = deps.gateService.resolveApproval({
      threadId,
      approvalId,
      decision: body.decision === "approve" ? "approved" : "changes_requested",
      feedback: body.feedback,
      decidedBy: "usr_local",
    });

    return reply.status(200).send({
      ok: true,
      approval: result,
    });
  });

  // GET /api/threads/:threadId/approvals
  app.get("/api/threads/:threadId/approvals", async (req, reply) => {
    const parsed = ThreadIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new HubDomainError(404, "ERR_NOT_FOUND");
    }

    const rows = deps.sqlite
      .prepare(
        `SELECT a.*, r.summary as run_summary
         FROM approvals a
         LEFT JOIN runs r ON r.id = a.run_id
         WHERE a.thread_id = ?
         ORDER BY a.version ASC`
      )
      .all(parsed.data.threadId);

    return reply.status(200).send({
      approvals: rows.map((r: any) => ({
        id: r.id,
        threadId: r.thread_id,
        runId: r.run_id,
        gate: r.gate,
        version: r.version,
        status: r.status,
        targetState: r.target_state,
        summary: r.summary,
        decidedBy: r.decided_by,
        decidedAt: r.decided_at,
        feedback: r.feedback,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  });

  // GET /api/threads/:threadId/scratchpads
  app.get("/api/threads/:threadId/scratchpads", async (req, reply) => {
    const parsed = ThreadIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new HubDomainError(404, "ERR_NOT_FOUND");
    }

    const rows = deps.sqlite
      .prepare(
        `SELECT s.thread_id, s.agent_id, s.content, s.updated_at, a.handle, a.display_name, a.avatar
         FROM agent_scratchpads s
         LEFT JOIN agents a ON a.id = s.agent_id
         WHERE s.thread_id = ?
         ORDER BY s.updated_at DESC`
      )
      .all(parsed.data.threadId);

    return reply.status(200).send({
      scratchpads: rows.map((r: any) => ({
        threadId: r.thread_id,
        agentId: r.agent_id,
        agentHandle: r.handle ?? "@agent",
        agentDisplayName: r.display_name ?? "Agent",
        agentAvatar: r.avatar,
        content: r.content,
        updatedAt: r.updated_at,
      })),
    });
  });
}
