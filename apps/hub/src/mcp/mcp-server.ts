import type Database from "better-sqlite3";
import { ulid } from "ulid";
import {
  McpGetThreadInputSchema,
  McpPostProgressInputSchema,
  McpReportOutcomeInputSchema,
  McpPostMessageInputSchema,
  McpAskHumanInputSchema,
  type ExplorerCardPayload,
  type QuestionCardPayload,
  type EventType,
  type ActorType,
} from "@ade/shared";
import type { GrantService } from "../trigger/grant-service.js";
import type { McpTokenClaims } from "./mcp-token-service.js";
import { HubMcpError } from "./mcp-token-service.js";

export interface McpServerDeps {
  sqlite: Database.Database;
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
  broadcastWs?: (threadId: string, event: unknown) => void;
}

export class McpServer {
  constructor(private readonly deps: McpServerDeps) {}

  async handleRpc(
    claims: McpTokenClaims,
    rpc: { jsonrpc?: string; id?: number | string; method: string; params?: Record<string, unknown> }
  ): Promise<Record<string, unknown>> {
    const id = rpc.id ?? 1;

    if (rpc.method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: 1,
          serverInfo: { name: "ade-mcp-server", version: "0.1.0" },
          capabilities: { tools: {} },
        },
      };
    }

    if (rpc.method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: [
            {
              name: "get_thread",
              description: "Đọc thông tin và tin nhắn trong Thread hiện tại (cần quyền grant).",
              inputSchema: {
                type: "object",
                properties: {
                  include_messages: { type: "integer", default: 20 },
                  thread_id: { type: "string" },
                },
              },
            },
            {
              name: "post_progress",
              description: "Cập nhật tiến độ thực thi gộp vào LiveCard.",
              inputSchema: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  step: { type: "string" },
                  percent: { type: "integer" },
                },
                required: ["text"],
              },
            },
            {
              name: "report_outcome",
              description: "Báo cáo kết quả kết thúc của run (done, blocked, needs_revision).",
              inputSchema: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["done", "blocked", "needs_revision"] },
                  summary: { type: "string" },
                  decisions: { type: "array", items: { type: "string" } },
                },
                required: ["status", "summary"],
              },
            },
            {
              name: "post_message",
              description: "Đăng ghi chú, kết quả hoặc thẻ Explorer vào thread.",
              inputSchema: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  kind: { type: "string", enum: ["note", "result", "explorer_card"] },
                  explorer: { type: "object" },
                },
                required: ["text"],
              },
            },
            {
              name: "ask_human",
              description: "Gửi câu hỏi làm rõ (Clarifier) đến người dùng trong thread.",
              inputSchema: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  options: { type: "array", items: { type: "string" } },
                  questions: { type: "array" },
                  timeout_s: { type: "integer" },
                },
                required: ["question"],
              },
            },
            {
              name: "set_state",
              description: "Chuyển trạng thái thread (chỉ dành cho Rule Engine).",
              inputSchema: {
                type: "object",
                properties: {
                  to: { type: "string" },
                  reason: { type: "string" },
                },
                required: ["to", "reason"],
              },
            },
          ],
        },
      };
    }

    if (rpc.method === "tools/call") {
      const toolName = String(rpc.params?.name ?? "");
      const args = (rpc.params?.arguments as Record<string, unknown>) ?? {};
      const result = await this.executeTool(claims, toolName, args);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result) }],
          structuredContent: result,
        },
      };
    }

    throw new HubMcpError(400, "ERR_METHOD_NOT_FOUND", `Method ${rpc.method} not supported`);
  }

  private broadcastMessage(msgId: string, threadId: string, projectId: string): void {
    if (!this.deps.broadcastWs) return;
    const row = this.deps.sqlite
      .prepare("SELECT * FROM messages WHERE id = ?")
      .get(msgId) as any;
    if (!row) return;

    const threadRow = this.deps.sqlite
      .prepare("SELECT channel_id FROM threads WHERE id = ?")
      .get(threadId) as any;

    this.deps.broadcastWs(threadId, {
      type: "message.posted",
      data: {
        eventId: `evt_${msgId}`,
        seq: 0,
        projectId,
        channelId: threadRow?.channel_id ?? "",
        threadId,
        message: {
          id: row.id,
          threadId: row.thread_id,
          isRoot: Boolean(row.is_root),
          authorType: row.author_type,
          authorId: row.author_id,
          kind: row.kind,
          body: row.body,
          mentions: JSON.parse(row.mentions_json || "[]"),
          humanMentions: JSON.parse(row.human_mentions_json || "[]"),
          reactions: [],
          card: row.card_json ? JSON.parse(row.card_json) : null,
          runId: row.run_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      },
    });
  }

  private async executeTool(
    claims: McpTokenClaims,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const threadId = String(args.thread_id ?? claims.thread_id);

    if (toolName === "get_thread") {
      const hasGrant = this.deps.grantService.hasActiveGrant(threadId, claims.agent_id);
      if (!hasGrant) {
        throw new HubMcpError(
          403,
          "ERR_PERMISSION_DENIED",
          "Agent chưa được cấp quyền đọc thread này (cần mention trước)"
        );
      }

      const input = McpGetThreadInputSchema.parse(args);
      const thread = this.deps.sqlite
        .prepare("SELECT id, title, state, workflow_id, summary FROM threads WHERE id = ?")
        .get(threadId) as { id: string; title: string; state: string; workflow_id: string; summary: string } | undefined;

      if (!thread) {
        throw new HubMcpError(404, "ERR_NOT_FOUND", "Thread not found");
      }

      const limit = input.include_messages ?? 20;
      const msgs = this.deps.sqlite
        .prepare(
          `SELECT id, is_root, author_type, author_id, kind, body, created_at
           FROM messages
           WHERE thread_id = ?
           ORDER BY created_at DESC
           LIMIT ?`
        )
        .all(threadId, limit) as Array<{
        id: string;
        is_root: number;
        author_type: string;
        author_id: string;
        kind: string;
        body: string;
        created_at: string;
      }>;

      return {
        thread_id: thread.id,
        title: thread.title,
        state: thread.state,
        workflow_id: thread.workflow_id,
        summary: thread.summary || null,
        scope: "full",
        messages: msgs.reverse().map((m) => ({
          id: m.id,
          is_root: Boolean(m.is_root),
          author_type: m.author_type,
          author_id: m.author_id,
          kind: m.kind,
          body: m.body,
          created_at: m.created_at,
        })),
      };
    }

    if (toolName === "post_progress") {
      const input = McpPostProgressInputSchema.parse(args);
      this.deps.appendEvent({
        type: "run.progress",
        projectId: claims.project_id,
        threadId: claims.thread_id,
        runId: claims.run_id,
        actorType: "agent",
        actorId: claims.agent_id,
        payload: {
          run_id: claims.run_id,
          kind: "step",
          data: {
            steps: [{ text: input.text, step: input.step ?? null, percent: input.percent ?? null }],
          },
        },
      });
      return { ok: true };
    }

    if (toolName === "report_outcome") {
      const input = McpReportOutcomeInputSchema.parse(args);
      this.deps.appendEvent({
        type: "run.outcome_reported",
        projectId: claims.project_id,
        threadId: claims.thread_id,
        runId: claims.run_id,
        actorType: "agent",
        actorId: claims.agent_id,
        payload: {
          run_id: claims.run_id,
          status: input.status,
          summary: input.summary,
          decisions: input.decisions ?? [],
        },
      });
      return {
        ok: true,
        run_id: claims.run_id,
        recorded_outcome: input.status,
      };
    }

    if (toolName === "post_message") {
      const input = McpPostMessageInputSchema.parse(args);
      const msgId = `msg_${ulid().toLowerCase()}`;
      const now = new Date().toISOString();

      let cardPayload: ExplorerCardPayload | null = null;
      let msgKind = input.kind === "explorer_card" ? "explorer_card" : "text";

      if (input.kind === "explorer_card" && input.explorer) {
        msgKind = "explorer_card";
        const agentRow = this.deps.sqlite
          .prepare("SELECT handle FROM agents WHERE id = ?")
          .get(claims.agent_id) as { handle: string } | undefined;
        cardPayload = {
          cardType: "explorer",
          agent_handle: agentRow?.handle ?? "@explorer",
          topic: input.explorer.topic,
          flow_steps: input.explorer.flow_steps,
          trace_steps: input.explorer.trace_steps ?? [],
          citations: input.explorer.citations,
          cost_usd: 0.001,
          duration_ms: 1200,
        };
      }

      this.deps.appendEvent({
        type: "message.posted",
        projectId: claims.project_id,
        threadId: claims.thread_id,
        runId: claims.run_id,
        actorType: "agent",
        actorId: claims.agent_id,
        payload: {
          message_id: msgId,
          kind: msgKind,
          body: input.text,
          is_root: false,
          mentions: [],
          human_mentions: [],
          card: cardPayload,
        },
      });

      this.broadcastMessage(msgId, claims.thread_id, claims.project_id);

      return { ok: true, message_id: msgId };
    }

    if (toolName === "ask_human") {
      const input = McpAskHumanInputSchema.parse(args);
      const questionId = `q_${ulid().toLowerCase()}`;
      const msgId = `msg_${ulid().toLowerCase()}`;
      const now = new Date().toISOString();

      const agentRow = this.deps.sqlite
        .prepare("SELECT handle FROM agents WHERE id = ?")
        .get(claims.agent_id) as { handle: string } | undefined;

      const cardPayload: QuestionCardPayload = {
        question_id: questionId,
        source: "mcp",
        run_id: claims.run_id,
        agent_handle: agentRow?.handle ?? "@clarifier",
        question: input.question,
        options: input.options ?? [],
        questions: (input.questions as QuestionCardPayload["questions"]) ?? [],
        status: "pending",
        answer: null,
        selected_option_id: null,
        answers: [],
        answered_by: null,
        answered_at: null,
        expires_at: new Date(Date.now() + (input.timeout_s ?? 1800) * 1000).toISOString(),
      };

      this.deps.sqlite
        .prepare("UPDATE runs SET status = 'waiting_human' WHERE id = ?")
        .run(claims.run_id);

      this.deps.appendEvent({
        type: "question.asked",
        projectId: claims.project_id,
        threadId: claims.thread_id,
        runId: claims.run_id,
        actorType: "agent",
        actorId: claims.agent_id,
        payload: {
          ...cardPayload,
          card_message_id: msgId,
        },
      });

      this.broadcastMessage(msgId, claims.thread_id, claims.project_id);

      return {
        question_id: questionId,
        message_id: msgId,
      };
    }

    if (toolName === "set_state") {
      throw new HubMcpError(
        403,
        "ERR_SET_STATE_FORBIDDEN",
        "Agent không được phép tự chuyển trạng thái thread; chỉ Rule Engine có quyền này."
      );
    }

    throw new HubMcpError(404, "ERR_TOOL_NOT_FOUND", `Tool ${toolName} not found`);
  }
}
