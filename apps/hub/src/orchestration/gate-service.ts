import type Database from "better-sqlite3";
import { ulid } from "ulid";
import type { ActorType, EventType, GateKind } from "@ade/shared";
import { HubDomainError } from "../chat/chat-service.js";

export interface GateServiceDeps {
  sqlite: Database.Database;
  appendEvent: (evt: {
    type: EventType;
    projectId: string | null;
    threadId: string | null;
    runId: string | null;
    actorType: ActorType;
    actorId: string;
    payload: Record<string, unknown>;
  }) => void;
  broadcastWs?: (threadId: string, event: unknown) => void;
  wakeAgent?: (params: { threadId: string; runId?: string | null; prompt: string }) => Promise<void> | void;
}

export interface CreateApprovalParams {
  threadId: string;
  runId: string;
  gate: GateKind;
  summary: string;
  targetState: string;
  requestedByAgentId: string;
  projectId?: string | null;
}

export interface ResolveApprovalParams {
  threadId: string;
  approvalId: string;
  decision: "approved" | "changes_requested" | "approve";
  feedback?: string;
  decidedBy: string;
  projectId?: string | null;
}

export class GateService {
  constructor(private readonly deps: GateServiceDeps) {}

  /**
   * Tạo yêu cầu phê duyệt mới cho gate tương ứng.
   * Version được tự động tăng dựa trên số lần duyệt trước đó của cùng gate trong thread.
   */
  createApproval(params: CreateApprovalParams) {
    const thread = this.deps.sqlite
      .prepare("SELECT id, project_id, state FROM threads WHERE id = ?")
      .get(params.threadId) as { id: string; project_id: string; state: string } | undefined;

    if (!thread) {
      throw new HubDomainError(404, "ERR_NOT_FOUND");
    }

    const projectId = params.projectId ?? thread.project_id;

    // Kiểm tra xem đã có approval pending cùng gate chưa
    const pending = this.deps.sqlite
      .prepare("SELECT id, version FROM approvals WHERE thread_id = ? AND gate = ? AND status = 'pending'")
      .get(params.threadId, params.gate) as { id: string; version: number } | undefined;

    if (pending) {
      return {
        approval_id: pending.id,
        version: pending.version,
        status: "pending" as const,
        already_pending: true,
      };
    }

    // Tính version tiếp theo
    const maxVerRow = this.deps.sqlite
      .prepare("SELECT MAX(version) as max_v FROM approvals WHERE thread_id = ? AND gate = ?")
      .get(params.threadId, params.gate) as { max_v: number | null } | undefined;

    const version = (maxVerRow?.max_v ?? 0) + 1;
    const approvalId = `appr_${ulid().toLowerCase()}`;
    const cardMsgId = `msg_appr_${ulid().toLowerCase()}`;

    this.deps.appendEvent({
      type: "approval.requested",
      projectId,
      threadId: params.threadId,
      runId: params.runId,
      actorType: "agent",
      actorId: params.requestedByAgentId,
      payload: {
        approval_id: approvalId,
        gate: params.gate,
        version,
        target_state: params.targetState,
        summary: params.summary,
        title: `Cổng duyệt ${params.gate.toUpperCase()} v${version}`,
        run_id: params.runId,
        card_message_id: cardMsgId,
      },
    });

    return {
      approval_id: approvalId,
      version,
      status: "pending" as const,
      card_message_id: cardMsgId,
    };
  }

  /**
   * Quyết định phê duyệt: Duyệt (approved) hoặc Yêu cầu sửa (changes_requested).
   */
  resolveApproval(params: ResolveApprovalParams) {
    const approval = this.deps.sqlite
      .prepare("SELECT * FROM approvals WHERE id = ?")
      .get(params.approvalId) as {
      id: string;
      thread_id: string;
      run_id: string;
      gate: string;
      version: number;
      status: string;
      target_state: string;
      summary: string;
    } | undefined;

    if (!approval) {
      throw new HubDomainError(404, "ERR_NOT_FOUND");
    }

    if (approval.status !== "pending") {
      throw new HubDomainError(409, "ERR_APPROVAL_ALREADY_DECIDED");
    }

    const thread = this.deps.sqlite
      .prepare("SELECT project_id, state FROM threads WHERE id = ?")
      .get(approval.thread_id) as { project_id: string; state: string } | undefined;

    const projectId = params.projectId ?? thread?.project_id ?? null;

    const finalDecision = params.decision === "approve" ? "approved" : params.decision;

    this.deps.appendEvent({
      type: "approval.resolved",
      projectId,
      threadId: approval.thread_id,
      runId: approval.run_id,
      actorType: "human",
      actorId: params.decidedBy,
      payload: {
        approval_id: approval.id,
        gate: approval.gate,
        version: approval.version,
        status: finalDecision,
        decided_by: params.decidedBy,
        feedback: params.feedback ?? null,
      },
    });

    if (this.deps.broadcastWs) {
      const cardRow = this.deps.sqlite
        .prepare("SELECT * FROM messages WHERE card_json LIKE ?")
        .get(`%"approval_id":"${approval.id}"%`) as any;
      if (cardRow) {
        const threadRow = this.deps.sqlite
          .prepare("SELECT channel_id FROM threads WHERE id = ?")
          .get(approval.thread_id) as any;
        this.deps.broadcastWs(approval.thread_id, {
          type: "message.posted",
          data: {
            eventId: `evt_${cardRow.id}`,
            seq: 0,
            projectId: projectId ?? "",
            channelId: threadRow?.channel_id ?? "",
            threadId: approval.thread_id,
            message: {
              id: cardRow.id,
              threadId: cardRow.thread_id,
              isRoot: Boolean(cardRow.is_root),
              authorType: cardRow.author_type,
              authorId: cardRow.author_id,
              kind: cardRow.kind,
              body: cardRow.body,
              mentions: JSON.parse(cardRow.mentions_json || "[]"),
              humanMentions: JSON.parse(cardRow.human_mentions_json || "[]"),
              reactions: [],
              card: cardRow.card_json ? JSON.parse(cardRow.card_json) : null,
              runId: cardRow.run_id,
              createdAt: cardRow.created_at,
              updatedAt: cardRow.updated_at,
            },
          },
        });
      }
    }

    if (finalDecision === "approved") {
      // Khi được duyệt, nếu targetState hợp lệ thì chuyển state thread
      if (approval.target_state && approval.target_state !== thread?.state) {
        this.deps.appendEvent({
          type: "thread.state_changed",
          projectId,
          threadId: approval.thread_id,
          runId: approval.run_id,
          actorType: "system",
          actorId: "rule_engine",
          payload: {
            from: thread?.state ?? "planning",
            to: approval.target_state,
            reason: `Cổng duyệt ${approval.gate} v${approval.version} đã được phê duyệt`,
          },
        });
      }
    } else if (params.decision === "changes_requested") {
      // Khi yêu cầu sửa, đánh thức Main Agent
      if (this.deps.wakeAgent) {
        const prompt = `[CỔNG DUYỆT ${approval.gate.toUpperCase()} v${approval.version} YÊU CẦU SỬA ĐỔI]\nLý do / Phản hồi từ người dùng: ${params.feedback ?? "Cần điều chỉnh lại kế hoạch"}.\nVui lòng cập nhật và trình lại cổng duyệt khi hoàn tất.`;
        void this.deps.wakeAgent({
          threadId: approval.thread_id,
          runId: approval.run_id,
          prompt,
        });
      }
    }

    return {
      approval_id: approval.id,
      gate: approval.gate,
      version: approval.version,
      status: params.decision,
      target_state: approval.target_state,
    };
  }

  /**
   * Kiểm tra xem thread có cổng duyệt pending nào không.
   */
  hasPendingApproval(threadId: string, gate?: string): boolean {
    if (gate) {
      const row = this.deps.sqlite
        .prepare("SELECT 1 FROM approvals WHERE thread_id = ? AND gate = ? AND status = 'pending' LIMIT 1")
        .get(threadId, gate);
      return Boolean(row);
    }
    const row = this.deps.sqlite
      .prepare("SELECT 1 FROM approvals WHERE thread_id = ? AND status = 'pending' LIMIT 1")
      .get(threadId);
    return Boolean(row);
  }

  /**
   * Xử lý slash command trong tin nhắn chat: /approve, /revise <notes>, /main @handle
   */
  async handleSlashCommand(threadId: string, userId: string, text: string): Promise<boolean> {
    const trimmed = text.trim();

    // /approve [notes]
    if (trimmed === "/approve" || trimmed.startsWith("/approve ")) {
      const pendingApproval = this.deps.sqlite
        .prepare("SELECT id FROM approvals WHERE thread_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1")
        .get(threadId) as { id: string } | undefined;

      if (!pendingApproval) {
        throw new HubDomainError(400, "ERR_INVALID_STATUS");
      }

      const notes = trimmed.replace(/^\/approve\s*/, "");
      this.resolveApproval({
        threadId,
        approvalId: pendingApproval.id,
        decision: "approved",
        feedback: notes.length > 0 ? notes : undefined,
        decidedBy: userId,
      });
      return true;
    }

    // /revise <notes>
    if (trimmed.startsWith("/revise")) {
      const notes = trimmed.replace(/^\/revise\s*/, "").trim();
      if (!notes) {
        throw new HubDomainError(422, "ERR_VALIDATION");
      }

      const pendingApproval = this.deps.sqlite
        .prepare("SELECT id FROM approvals WHERE thread_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1")
        .get(threadId) as { id: string } | undefined;

      if (!pendingApproval) {
        throw new HubDomainError(400, "ERR_INVALID_STATUS");
      }

      this.resolveApproval({
        threadId,
        approvalId: pendingApproval.id,
        decision: "changes_requested",
        feedback: notes,
        decidedBy: userId,
      });
      return true;
    }

    // /main @handle
    if (trimmed.startsWith("/main")) {
      const handle = trimmed.replace(/^\/main\s*/, "").trim();
      if (!handle.startsWith("@")) {
        throw new HubDomainError(422, "ERR_VALIDATION");
      }

      const thread = this.deps.sqlite
        .prepare("SELECT project_id FROM threads WHERE id = ?")
        .get(threadId) as { project_id: string } | undefined;

      if (!thread) {
        throw new HubDomainError(404, "ERR_NOT_FOUND");
      }

      const agent = this.deps.sqlite
        .prepare("SELECT id, handle, can_be_main FROM agents WHERE project_id = ? AND handle = ?")
        .get(thread.project_id, handle) as { id: string; handle: string; can_be_main: number } | undefined;

      if (!agent) {
        throw new HubDomainError(404, "ERR_NOT_FOUND");
      }

      if (!agent.can_be_main) {
        throw new HubDomainError(400, "ERR_AGENT_CANNOT_BE_MAIN");
      }

      this.deps.appendEvent({
        type: "main.changed",
        projectId: thread.project_id,
        threadId,
        runId: null,
        actorType: "human",
        actorId: userId,
        payload: {
          new_main_agent_id: agent.id,
          handle: agent.handle,
          changed_by: userId,
        },
      });

      return true;
    }

    return false;
  }
}
