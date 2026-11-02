import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import { ApprovalDecisionInputSchema, ThreadIdParamSchema } from "@ade/shared";
import type { GateService } from "../orchestration/gate-service.js";
import { HubDomainError } from "../errors.js";
import { parseParamsOrNotFound } from "./route-utils.js";

interface ApprovalRow {
  id: string;
  thread_id: string;
  run_id: string | null;
  gate: string;
  version: number;
  status: string;
  target_state: string;
  summary: string | null;
  decided_by: string | null;
  decided_at: string | null;
  feedback: string | null;
  created_at: string;
  updated_at: string;
  run_summary: string | null;
}

interface ScratchpadRow {
  thread_id: string;
  agent_id: string;
  content: string;
  updated_at: string;
  handle: string | null;
  display_name: string | null;
  avatar: string | null;
}

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
    const { threadId } = parseParamsOrNotFound(ThreadIdParamSchema, req.params);

    const rows = deps.sqlite
      .prepare(
        `SELECT a.*, r.summary as run_summary
         FROM approvals a
         LEFT JOIN runs r ON r.id = a.run_id
         WHERE a.thread_id = ?
         ORDER BY a.version ASC`
      )
      .all(threadId) as ApprovalRow[];

    return reply.status(200).send({
      approvals: rows.map((r) => ({
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
    const { threadId } = parseParamsOrNotFound(ThreadIdParamSchema, req.params);

    const rows = deps.sqlite
      .prepare(
        `SELECT s.thread_id, s.agent_id, s.content, s.updated_at, a.handle, a.display_name, a.avatar
         FROM agent_scratchpads s
         LEFT JOIN agents a ON a.id = s.agent_id
         WHERE s.thread_id = ?
         ORDER BY s.updated_at DESC`
      )
      .all(threadId) as ScratchpadRow[];

    return reply.status(200).send({
      scratchpads: rows.map((r) => ({
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
