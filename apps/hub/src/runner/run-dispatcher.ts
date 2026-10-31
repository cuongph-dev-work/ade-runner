import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type {
  CredentialProfile,
  HarnessType,
  LiveCardPayload,
  PermissionCardPayload,
  RunSummary,
  RunnerMessage,
  SkillMountSpec,
  WsRunnerServerEvent,
} from "@ade/shared";
import { validateCredentialForMode, type AdeMode, type RunnerTransport } from "@ade/runner";
import { HubDomainError, assertRunTransition } from "./state-machines.js";
import { ProgressAggregator } from "./progress-aggregator.js";

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 26)}`;
}

const RUN_SUMMARY_SELECT_SQL = `
  SELECT r.*, a.handle AS agent_handle, a.display_name AS agent_display_name, a.harness AS harness,
         rn.machine_name AS runner_machine_name,
         (SELECT m.id FROM messages m WHERE m.run_id = r.id AND m.kind = 'live_card' LIMIT 1) AS live_card_message_id,
         (SELECT json_extract(m.card_json, '$.tool')
            FROM messages m
           WHERE m.run_id = r.id
             AND m.kind = 'approval_card'
             AND json_extract(m.card_json, '$.status') = 'pending'
           ORDER BY m.created_at DESC
           LIMIT 1) AS pending_permission_tool
  FROM runs r
  INNER JOIN threads t ON t.id = r.thread_id
  INNER JOIN channels c ON c.id = t.channel_id AND c.deleted_at IS NULL
  INNER JOIN agents a ON a.id = r.agent_id
  LEFT JOIN runners rn ON rn.id = r.runner_id
`;

export class RunDispatcher {
  private readonly aggregator: ProgressAggregator;

  constructor(
    private readonly deps: {
      sqlite: Database.Database;
      mode: AdeMode;
      mcpUrl: string | null;
      transport: RunnerTransport;
      appendEvent: (evt: {
        type: string;
        projectId: string | null;
        threadId: string | null;
        runId: string | null;
        actorType: "human" | "agent" | "system";
        actorId: string;
        payload: Record<string, unknown>;
      }) => void;
      broadcastWs: (threadId: string, event: WsRunnerServerEvent) => void;
      resolveAgentSkills: (agentId: string) => SkillMountSpec[];
    },
  ) {
    this.aggregator = new ProgressAggregator({
      intervalMs: 1000,
      insertRunLog: (row) => {
        this.deps.sqlite
          .prepare(
            "INSERT INTO run_logs (run_id, seq, kind, data_json, ts) VALUES (?, ?, ?, ?, ?)",
          )
          .run(row.runId, row.seq, row.kind, row.dataJson, row.ts);
      },
      emitAggregatedProgress: (runId, snapshot) => {
        const meta = this.getRunRow(runId);
        if (!meta || String(meta.status) === "cancelled") return;
        this.deps.appendEvent({
          type: "run.progress",
          projectId: String(meta.project_id),
          threadId: String(meta.thread_id),
          runId,
          actorType: "agent",
          actorId: String(meta.agent_id),
          payload: { run_id: runId, kind: "step", data: snapshot },
        });
        this.updateLiveCard(runId, (card) => ({
          ...card,
          plan: snapshot.plan,
          toolCalls: snapshot.toolCalls,
          steps: snapshot.steps,
          lastMessageText: snapshot.lastMessageText,
        }));
      },
    });

    this.deps.transport.onHubReceive((msg) => this.onTransportMessage(msg));
    this.deps.transport.onRunnerDisconnect((runnerId, reason) => {
      this.deps.appendEvent({
        type: "runner.disconnected",
        projectId: null,
        threadId: null,
        runId: null,
        actorType: "system",
        actorId: runnerId,
        payload: { runner_id: runnerId, reason },
      });
    });
  }

  onAgentMentioned(params: {
    projectId: string;
    threadId: string;
    agentId: string;
    invokedBy: string;
    promptText: string;
  }): string | null {
    const thread = this.getActiveThreadContext(params.threadId);
    if (!thread || Number(thread.engine_halted ?? 0) !== 0) {
      return null;
    }

    const agent = this.deps.sqlite
      .prepare("SELECT * FROM agents WHERE id = ? AND enabled = 1")
      .get(params.agentId) as Record<string, unknown> | undefined;
    const depth = 0;
    if (!agent || depth > Number(agent.max_depth ?? 3)) {
      return null;
    }

    const profile = String(agent.credential_profile) as CredentialProfile;
    const harness = String(agent.harness) as HarnessType;

    // S5-04: Kiểm tra credential_profile theo ADE_MODE trước Run/T-01
    try {
      validateCredentialForMode(profile, harness, this.deps.mode);
    } catch {
      const warnMsgId = makeId("msg");
      const text =
        "ERR_CREDENTIAL_MODE_MISMATCH: Hồ sơ xác thực không được phép trong chế độ hiện tại.";
      this.deps.appendEvent({
        type: "message.posted",
        projectId: params.projectId,
        threadId: params.threadId,
        runId: null,
        actorType: "system",
        actorId: "dispatcher",
        payload: {
          message_id: warnMsgId,
          kind: "system",
          code: "ERR_CREDENTIAL_MODE_MISMATCH",
          body: text,
          is_root: false,
          mentions: [],
          human_mentions: [],
        },
      });
      this.emitMessageCreated({
        projectId: thread.project_id,
        channelId: thread.channel_id,
        threadId: params.threadId,
        messageId: warnMsgId,
        runId: null,
        kind: "system",
        body: text,
        card: null,
      });
      return null;
    }

    // S5-05: Kiểm tra có ít nhất 1 runner đăng ký hỗ trợ harness của agent
    const registeredRunners = this.deps.sqlite
      .prepare("SELECT id, status, harnesses_available_json FROM runners")
      .all() as { id: string; status: string; harnesses_available_json: string }[];
    const supportingRunners = registeredRunners.filter((rn) => {
      const list = JSON.parse(rn.harnesses_available_json) as string[];
      return list.includes(harness);
    });

    if (supportingRunners.length === 0) {
      const warnMsgId = makeId("msg");
      const text =
        "ERR_RUNNER_UNAVAILABLE: Runner hoặc harness chưa sẵn sàng để khởi chạy agent.";
      this.deps.appendEvent({
        type: "message.posted",
        projectId: params.projectId,
        threadId: params.threadId,
        runId: null,
        actorType: "system",
        actorId: "dispatcher",
        payload: {
          message_id: warnMsgId,
          kind: "system",
          code: "ERR_RUNNER_UNAVAILABLE",
          body: text,
          is_root: false,
          mentions: [],
          human_mentions: [],
        },
      });
      this.emitMessageCreated({
        projectId: thread.project_id,
        channelId: thread.channel_id,
        threadId: params.threadId,
        messageId: warnMsgId,
        runId: null,
        kind: "system",
        body: text,
        card: null,
      });
      return null;
    }

    // S5-06: Xếp hàng phiên chạy (Run/T-01 — chưa tạo live_card)
    const runId = makeId("run");
    const skills = this.deps.resolveAgentSkills(params.agentId);
    const resolvedTimeoutS = Number(agent.timeout_s ?? 600);

    this.deps.appendEvent({
      type: "run.queued",
      projectId: params.projectId,
      threadId: params.threadId,
      runId,
      actorType: "human",
      actorId: params.invokedBy,
      payload: {
        run_id: runId,
        agent_id: params.agentId,
        role: "worker",
        depth,
        timeout_s: resolvedTimeoutS,
        credential_profile: profile,
        skills_snapshot: skills.map((s) => ({ name: s.name, hash: s.contentHash })),
        prompt: params.promptText,
      },
    });

    this.emitRunUpdated(runId);

    // S5-07: Giữ run ở trạng thái queued khi toàn bộ runner hỗ trợ harness đang offline
    const hasOnlineRunner = supportingRunners.some((rn) => rn.status === "online");
    if (!hasOnlineRunner) {
      const waitMsgId = makeId("msg");
      const waitText = "Đang chờ runner trực tuyến để khởi chạy agent.";
      this.deps.appendEvent({
        type: "message.posted",
        projectId: params.projectId,
        threadId: params.threadId,
        runId,
        actorType: "system",
        actorId: "dispatcher",
        payload: {
          message_id: waitMsgId,
          kind: "system",
          body: waitText,
          is_root: false,
          mentions: [],
          human_mentions: [],
        },
      });
      this.emitMessageCreated({
        projectId: thread.project_id,
        channelId: thread.channel_id,
        threadId: params.threadId,
        messageId: waitMsgId,
        runId,
        kind: "system",
        body: waitText,
        card: null,
      });
      return runId;
    }

    this.tryDispatchQueuedRuns(params.threadId, params.promptText);
    return runId;
  }

  tryDispatchQueuedRuns(threadId: string, fallbackPrompt = "Thực hiện yêu cầu"): void {
    const threadCtx = this.getActiveThreadContext(threadId);
    if (!threadCtx) return;

    const writeBusy = this.deps.sqlite
      .prepare(
        `SELECT COUNT(*) AS cnt
         FROM runs r INNER JOIN agents a ON a.id = r.agent_id
         WHERE r.thread_id = ? AND a.write = 1 AND r.status IN ('running', 'waiting_permission', 'waiting_human')`,
      )
      .get(threadId) as { cnt: number };

    const queuedRuns = this.deps.sqlite
      .prepare("SELECT * FROM runs WHERE thread_id = ? AND status = 'queued' ORDER BY created_at ASC")
      .all(threadId) as Record<string, unknown>[];

    let lockTaken = writeBusy.cnt > 0;
    for (const runRow of queuedRuns) {
      const agent = this.deps.sqlite
        .prepare("SELECT * FROM agents WHERE id = ?")
        .get(String(runRow.agent_id)) as Record<string, unknown>;
      const requiresWrite = Number(agent.write) === 1;
      if (requiresWrite && lockTaken) {
        continue;
      }

      const onlineRunners = this.deps.sqlite
        .prepare("SELECT * FROM runners WHERE status = 'online' ORDER BY last_seen DESC")
        .all() as Record<string, unknown>[];
      const runner = onlineRunners.find((rn) => {
        const list = JSON.parse(String(rn.harnesses_available_json)) as string[];
        return list.includes(String(agent.harness));
      });

      // Giữ run ở trạng thái queued khi runner hỗ trợ harness đang offline (không chuyển sang failed)
      if (!runner) {
        continue;
      }

      if (requiresWrite) lockTaken = true;
      const project = this.deps.sqlite
        .prepare("SELECT * FROM projects WHERE id = ?")
        .get(String(runRow.project_id)) as Record<string, unknown>;
      const runId = String(runRow.id);
      const startedAt = new Date().toISOString();
      const liveCardMsgId = makeId("msg");

      const queuedEvt = this.deps.sqlite
        .prepare(
          "SELECT payload FROM events WHERE run_id = ? AND type = 'run.queued' ORDER BY seq DESC LIMIT 1",
        )
        .get(runId) as { payload: string } | undefined;
      const queuedPrompt = queuedEvt
        ? String((JSON.parse(queuedEvt.payload) as { prompt?: string }).prompt ?? fallbackPrompt)
        : fallbackPrompt;

      // S5-08: Tạo đúng 1 live_card cho run_id tại thời điểm chuyển qua Run/T-02
      const initialCard: LiveCardPayload = {
        cardType: "live_card",
        runId,
        agentId: String(agent.id),
        agentHandle: String(agent.handle),
        agentDisplayName: String(agent.display_name),
        invokedBy: String(runRow.invoked_by),
        runnerMachineName: String(runner.machine_name),
        status: "running",
        plan: [],
        toolCalls: [],
        steps: [],
        lastMessageText: "",
        outcome: null,
        stopReason: null,
        errorCode: null,
        costUsd: 0,
        startedAt,
        endedAt: null,
      };

      this.deps.sqlite
        .prepare(
          `INSERT INTO messages (
            id, thread_id, is_root, author_type, author_id, kind, body,
            mentions_json, human_mentions_json, reactions_json, card_json, run_id, created_at, updated_at
          ) VALUES (?, ?, 0, 'agent', ?, 'live_card', '', '[]', '[]', '[]', ?, ?, ?, ?)`,
        )
        .run(
          liveCardMsgId,
          threadId,
          String(agent.id),
          JSON.stringify(initialCard),
          runId,
          startedAt,
          startedAt,
        );

      this.deps.appendEvent({
        type: "run.started",
        projectId: String(runRow.project_id),
        threadId,
        runId,
        actorType: "system",
        actorId: String(runner.id),
        payload: {
          run_id: runId,
          runner_id: String(runner.id),
          agent: String(agent.handle),
          harness: String(agent.harness),
          acp_session_id: null,
          live_card_message_id: liveCardMsgId,
        },
      });

      this.emitMessageCreated({
        projectId: threadCtx.project_id,
        channelId: threadCtx.channel_id,
        threadId,
        messageId: liveCardMsgId,
        runId,
        kind: "live_card",
        body: "",
        card: initialCard,
      });
      this.emitRunUpdated(runId);

      this.deps.transport.sendToRunner({
        type: "run.start",
        runId,
        projectId: String(runRow.project_id),
        threadId,
        repoPath: String(project.repo_path),
        defaultBranch: String(project.default_branch ?? "main"),
        useRepoInstructions: Number(project.use_repo_instructions ?? 0) === 1,
        agent: {
          id: String(agent.id),
          handle: String(agent.handle),
          displayName: String(agent.display_name),
          role: String(agent.role ?? ""),
          harness: String(agent.harness) as HarnessType,
          model: agent.model ? String(agent.model) : null,
          credentialProfile: String(agent.credential_profile) as CredentialProfile,
          write: requiresWrite,
          timeoutS: Number(agent.timeout_s ?? 600),
          scenarioFile: agent.source_file ? String(agent.source_file) : undefined,
        },
        skills: this.deps.resolveAgentSkills(String(agent.id)),
        prompt: queuedPrompt,
        context: "",
        mcpUrl: this.deps.mcpUrl,
        mcpToken: this.deps.mcpUrl ? `mcp_${runId}` : null,
        resumeSessionId: null,
      });
    }
  }

  listRunsByThread(threadId: string): RunSummary[] {
    const thread = this.getActiveThreadContext(threadId);
    if (!thread) {
      throw new HubDomainError("ERR_NOT_FOUND", "Không tìm thấy dữ liệu yêu cầu.", 404);
    }
    const rows = this.deps.sqlite
      .prepare(`${RUN_SUMMARY_SELECT_SQL} WHERE r.thread_id = ? ORDER BY r.created_at ASC`)
      .all(threadId) as Record<string, unknown>[];

    return rows.map((r) => this.mapRunRowToSummary(r));
  }

  listRunsByProject(projectId: string): RunSummary[] {
    const project = this.deps.sqlite
      .prepare("SELECT id FROM projects WHERE id = ?")
      .get(projectId) as { id: string } | undefined;
    if (!project) {
      throw new HubDomainError("ERR_NOT_FOUND", "Không tìm thấy dữ liệu yêu cầu.", 404);
    }
    const rows = this.deps.sqlite
      .prepare(`${RUN_SUMMARY_SELECT_SQL} WHERE r.project_id = ? ORDER BY r.created_at ASC`)
      .all(projectId) as Record<string, unknown>[];

    return rows.map((r) => this.mapRunRowToSummary(r));
  }

  resolvePermission(params: {
    runId: string;
    requestId: string;
    optionId: string;
    decision: "allow" | "deny";
    decidedBy: string;
  }): {
    runId: string;
    requestId: string;
    optionId: string;
    decision: "allow" | "deny";
    runStatus: RunSummary["status"];
    cardStatus: "allowed" | "denied";
  } {
    const run = this.getActiveRunRow(params.runId);
    if (!run) {
      throw new HubDomainError("ERR_NOT_FOUND", "Không tìm thấy dữ liệu yêu cầu.", 404);
    }
    const msgRow = this.deps.sqlite
      .prepare(
        `SELECT id, card_json FROM messages
         WHERE run_id = ? AND kind = 'approval_card' AND json_extract(card_json, '$.requestId') = ?`,
      )
      .get(params.runId, params.requestId) as { id: string; card_json: string } | undefined;
    if (!msgRow) {
      throw new HubDomainError("ERR_NOT_FOUND", "Không tìm thấy dữ liệu yêu cầu.", 404);
    }

    const card = JSON.parse(msgRow.card_json) as PermissionCardPayload;
    if (card.status !== "pending" || String(run.status) !== "waiting_permission") {
      throw new HubDomainError(
        "ERR_PERMISSION_ALREADY_RESOLVED",
        "Yêu cầu cấp quyền này đã được xử lý trước đó.",
        409,
      );
    }

    const matchedOpt = card.options.find(
      (o) => o.id === params.optionId && o.decision === params.decision,
    );
    if (!matchedOpt) {
      throw new HubDomainError("ERR_VALIDATION", "Dữ liệu gửi lên không hợp lệ.", 422, {
        optionId: ["MSG04"],
      });
    }

    this.deps.appendEvent({
      type: "run.permission_resolved",
      projectId: String(run.project_id),
      threadId: String(run.thread_id),
      runId: params.runId,
      actorType: "human",
      actorId: params.decidedBy,
      payload: {
        run_id: params.runId,
        request_id: params.requestId,
        option_id: params.optionId,
        decision: params.decision,
        decided_by: params.decidedBy,
      },
    });

    const cardStatus = params.decision === "allow" ? "allowed" : "denied";
    const now = new Date().toISOString();
    const updatedCard: PermissionCardPayload = {
      ...card,
      status: cardStatus,
      selectedOptionId: params.optionId,
      decidedBy: params.decidedBy,
      decidedAt: now,
    };
    this.deps.sqlite
      .prepare("UPDATE messages SET card_json = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(updatedCard), now, msgRow.id);

    this.updateLiveCard(params.runId, (lc) => ({ ...lc, status: "running" }));
    this.emitMessageUpdated({
      projectId: String(run.project_id),
      channelId: String(run.channel_id),
      threadId: String(run.thread_id),
      messageId: msgRow.id,
      runId: params.runId,
      kind: "approval_card",
      card: updatedCard,
    });
    this.emitRunUpdated(params.runId);

    this.deps.transport.sendToRunner({
      type: "permission.reply",
      runId: params.runId,
      requestId: params.requestId,
      optionId: params.optionId,
      decision: params.decision,
    });

    return {
      runId: params.runId,
      requestId: params.requestId,
      optionId: params.optionId,
      decision: params.decision,
      runStatus: "running",
      cardStatus,
    };
  }

  async cancelRun(params: {
    runId: string;
    cancelledBy: string;
  }): Promise<{ runId: string; status: "cancelled"; endedAt: string }> {
    const run = this.getActiveRunRow(params.runId);
    if (!run) {
      throw new HubDomainError("ERR_NOT_FOUND", "Không tìm thấy dữ liệu yêu cầu.", 404);
    }
    const currentStatus = String(run.status) as RunSummary["status"];
    assertRunTransition(currentStatus, "cancelled");

    this.aggregator.clear(params.runId);
    this.deps.appendEvent({
      type: "run.cancelled",
      projectId: String(run.project_id),
      threadId: String(run.thread_id),
      runId: params.runId,
      actorType: "human",
      actorId: params.cancelledBy,
      payload: { run_id: params.runId, cancelled_by: params.cancelledBy },
    });

    const endedAt = new Date().toISOString();

    if (currentStatus === "waiting_permission") {
      const pendingCards = this.deps.sqlite
        .prepare(
          "SELECT id, card_json FROM messages WHERE run_id = ? AND kind = 'approval_card'",
        )
        .all(params.runId) as { id: string; card_json: string }[];
      for (const pc of pendingCards) {
        const parsed = JSON.parse(pc.card_json) as PermissionCardPayload;
        if (parsed.status === "pending") {
          const cancelledCard: PermissionCardPayload = {
            ...parsed,
            status: "cancelled",
            decidedBy: params.cancelledBy,
            decidedAt: endedAt,
          };
          this.deps.sqlite
            .prepare("UPDATE messages SET card_json = ?, updated_at = ? WHERE id = ?")
            .run(JSON.stringify(cancelledCard), endedAt, pc.id);
          this.emitMessageUpdated({
            projectId: String(run.project_id),
            channelId: String(run.channel_id),
            threadId: String(run.thread_id),
            messageId: pc.id,
            runId: params.runId,
            kind: "approval_card",
            card: cancelledCard,
          });
        }
      }
    }

    this.updateLiveCard(params.runId, (c) => ({
      ...c,
      status: "cancelled",
      stopReason: "cancelled",
      endedAt,
    }));

    this.emitRunUpdated(params.runId);

    if (currentStatus === "running" || currentStatus === "waiting_permission") {
      this.deps.transport.sendToRunner({
        type: "run.cancel",
        runId: params.runId,
        reason: "user_cancelled",
      });
    }
    this.tryDispatchQueuedRuns(String(run.thread_id));
    return { runId: params.runId, status: "cancelled", endedAt };
  }

  private onTransportMessage(msg: RunnerMessage): void {
    if (msg.type === "runner.hello") {
      this.deps.appendEvent({
        type: "runner.connected",
        projectId: null,
        threadId: null,
        runId: null,
        actorType: "system",
        actorId: msg.runnerId,
        payload: {
          runner_id: msg.runnerId,
          machine_name: msg.machineName,
          harnesses_available: msg.harnessesAvailable,
        },
      });
      const pendingThreads = this.deps.sqlite
        .prepare("SELECT DISTINCT thread_id FROM runs WHERE status = 'queued'")
        .all() as { thread_id: string }[];
      for (const row of pendingThreads) {
        this.tryDispatchQueuedRuns(String(row.thread_id));
      }
    } else if (msg.type === "run.event") {
      const run = this.getRunRow(msg.runId);
      if (!run || String(run.status) === "cancelled") return;
      if (msg.acpSessionId && !run.acp_session_id) {
        this.deps.sqlite
          .prepare("UPDATE runs SET acp_session_id = ? WHERE id = ?")
          .run(msg.acpSessionId, msg.runId);
      }
      this.aggregator.ingest(msg.runId, msg.ts, msg.event);
    } else if (msg.type === "permission.request") {
      this.aggregator.flush(msg.runId);
      const run = this.getActiveRunRow(msg.runId);
      if (!run || String(run.status) !== "running") return;
      const agent = this.deps.sqlite
        .prepare("SELECT handle FROM agents WHERE id = ?")
        .get(String(run.agent_id)) as { handle: string };
      const cardMsgId = makeId("msg");
      const now = new Date().toISOString();
      const permCard: PermissionCardPayload = {
        cardType: "tool_permission",
        runId: msg.runId,
        requestId: msg.requestId,
        agentHandle: agent.handle,
        invokedBy: String(run.invoked_by),
        tool: msg.tool,
        args: msg.args,
        displayCommand: msg.displayCommand,
        options: msg.options,
        status: "pending",
        selectedOptionId: null,
        decidedBy: null,
        decidedAt: null,
      };
      this.deps.appendEvent({
        type: "run.permission_requested",
        projectId: String(run.project_id),
        threadId: String(run.thread_id),
        runId: msg.runId,
        actorType: "agent",
        actorId: String(run.agent_id),
        payload: {
          run_id: msg.runId,
          request_id: msg.requestId,
          tool: msg.tool,
          args: msg.args,
          options: msg.options,
          card_message_id: cardMsgId,
        },
      });
      this.deps.sqlite
        .prepare(
          `INSERT INTO messages (
            id, thread_id, is_root, author_type, author_id, kind, body,
            mentions_json, human_mentions_json, reactions_json, card_json, run_id, created_at, updated_at
          ) VALUES (?, ?, 0, 'agent', ?, 'approval_card', '', '[]', '[]', '[]', ?, ?, ?, ?)`,
        )
        .run(
          cardMsgId,
          String(run.thread_id),
          String(run.agent_id),
          JSON.stringify(permCard),
          msg.runId,
          now,
          now,
        );
      this.updateLiveCard(msg.runId, (lc) => ({ ...lc, status: "waiting_permission" }));
      this.emitMessageCreated({
        projectId: String(run.project_id),
        channelId: String(run.channel_id),
        threadId: String(run.thread_id),
        messageId: cardMsgId,
        runId: msg.runId,
        kind: "approval_card",
        body: "",
        card: permCard,
      });
      this.emitRunUpdated(msg.runId);
    } else if (msg.type === "run.end") {
      this.aggregator.clear(msg.runId);
      const run = this.getRunRow(msg.runId);
      if (!run || String(run.status) === "cancelled") return;

      const settledCostUsd = msg.usage?.costUsd ?? Number(run.cost_usd ?? 0);
      const agent = this.deps.sqlite
        .prepare("SELECT budget_usd FROM agents WHERE id = ?")
        .get(String(run.agent_id)) as { budget_usd: number | null } | undefined;
      const threadRow = this.deps.sqlite
        .prepare("SELECT budget_usd, spent_usd FROM threads WHERE id = ?")
        .get(String(run.thread_id)) as { budget_usd: number | null; spent_usd: number | null } | undefined;
      const overAgentBudget =
        agent?.budget_usd !== null &&
        agent?.budget_usd !== undefined &&
        settledCostUsd > Number(agent.budget_usd);
      const overThreadBudget =
        threadRow?.budget_usd !== null &&
        threadRow?.budget_usd !== undefined &&
        Number(threadRow.spent_usd ?? 0) + settledCostUsd > Number(threadRow.budget_usd);
      const overBudget = msg.stopReason === "budget_exceeded" || overAgentBudget || overThreadBudget;

      const endedAt = new Date().toISOString();
      if (!overBudget && msg.stopReason === "end_turn") {
        // S5-11: Run/T-08 (completed)
        const outcome = run.outcome ? String(run.outcome) : "unknown";
        this.deps.appendEvent({
          type: "run.completed",
          projectId: String(run.project_id),
          threadId: String(run.thread_id),
          runId: msg.runId,
          actorType: "agent",
          actorId: String(run.agent_id),
          payload: {
            run_id: msg.runId,
            stop_reason: "end_turn",
            outcome,
            summary: run.summary ?? null,
            decisions: [],
            cost_usd: settledCostUsd,
          },
        });
        this.updateLiveCard(msg.runId, (lc) => ({
          ...lc,
          status: "completed",
          stopReason: "end_turn",
          outcome: outcome as LiveCardPayload["outcome"],
          costUsd: settledCostUsd,
          endedAt,
        }));
        this.emitRunUpdated(msg.runId);
      } else {
        // S5-12 (Run/T-14 budget_exceeded) & S5-13 (Run/T-09 runtime error)
        const errorCode = overBudget
          ? "ERR_BUDGET_EXCEEDED"
          : (msg.errorCode ?? "ERR_DRIVER_EXECUTION");
        const stopReason = overBudget ? "budget_exceeded" : msg.stopReason;
        this.deps.appendEvent({
          type: "run.failed",
          projectId: String(run.project_id),
          threadId: String(run.thread_id),
          runId: msg.runId,
          actorType: "agent",
          actorId: String(run.agent_id),
          payload: {
            run_id: msg.runId,
            stop_reason: stopReason,
            error_code: errorCode,
            cost_usd: settledCostUsd,
          },
        });
        this.updateLiveCard(msg.runId, (lc) => ({
          ...lc,
          status: "failed",
          stopReason,
          errorCode,
          costUsd: settledCostUsd,
          endedAt,
        }));
        this.emitRunUpdated(msg.runId);
      }
      this.tryDispatchQueuedRuns(String(run.thread_id));
    }
  }

  private getActiveThreadContext(threadId: string):
    | { id: string; project_id: string; channel_id: string; engine_halted: number }
    | undefined {
    return this.deps.sqlite
      .prepare(
        `SELECT t.id, t.project_id, t.channel_id, t.engine_halted
         FROM threads t
         INNER JOIN channels c ON c.id = t.channel_id AND c.deleted_at IS NULL
         WHERE t.id = ?`,
      )
      .get(threadId) as
      | { id: string; project_id: string; channel_id: string; engine_halted: number }
      | undefined;
  }

  private getActiveRunRow(runId: string): (Record<string, unknown> & { channel_id: string }) | undefined {
    return this.deps.sqlite
      .prepare(
        `SELECT r.*, t.channel_id
         FROM runs r
         INNER JOIN threads t ON t.id = r.thread_id
         INNER JOIN channels c ON c.id = t.channel_id AND c.deleted_at IS NULL
         WHERE r.id = ?`,
      )
      .get(runId) as (Record<string, unknown> & { channel_id: string }) | undefined;
  }

  private getRunRow(runId: string): Record<string, unknown> | undefined {
    return this.deps.sqlite.prepare("SELECT * FROM runs WHERE id = ?").get(runId) as
      | Record<string, unknown>
      | undefined;
  }

  private mapRunRowToSummary(r: Record<string, unknown>): RunSummary {
    return {
      id: String(r.id),
      projectId: String(r.project_id),
      threadId: String(r.thread_id),
      agentId: String(r.agent_id),
      agentHandle: String(r.agent_handle),
      agentDisplayName: String(r.agent_display_name),
      harness: String(r.harness) as HarnessType,
      runnerId: r.runner_id ? String(r.runner_id) : null,
      runnerMachineName: r.runner_machine_name ? String(r.runner_machine_name) : null,
      invokedBy: String(r.invoked_by),
      credentialProfile: String(r.credential_profile) as CredentialProfile,
      acpSessionId: r.acp_session_id ? String(r.acp_session_id) : null,
      role: (String(r.role) === "main" ? "main" : "worker") as "main" | "worker",
      depth: Number(r.depth),
      timeoutS: Number(r.timeout_s ?? 600),
      status: String(r.status) as RunSummary["status"],
      outcome: r.outcome ? (String(r.outcome) as RunSummary["outcome"]) : null,
      stopReason: r.stop_reason ? (String(r.stop_reason) as RunSummary["stopReason"]) : null,
      costUsd: Number(r.cost_usd ?? 0),
      liveCardMessageId: r.live_card_message_id ? String(r.live_card_message_id) : null,
      pendingPermissionTool: r.pending_permission_tool ? String(r.pending_permission_tool) : null,
      startedAt: r.started_at ? String(r.started_at) : null,
      endedAt: r.ended_at ? String(r.ended_at) : null,
      createdAt: String(r.created_at),
    };
  }

  private getLatestEventMeta(): { eventId: string; seq: number } {
    const row = this.deps.sqlite
      .prepare("SELECT id, seq FROM events ORDER BY seq DESC LIMIT 1")
      .get() as { id: string; seq: number } | undefined;
    return row ? { eventId: String(row.id), seq: Number(row.seq) } : { eventId: makeId("evt"), seq: 0 };
  }

  private emitMessageCreated(params: {
    projectId: string;
    channelId: string;
    threadId: string;
    messageId: string;
    runId: string | null;
    kind: "live_card" | "approval_card" | "system";
    body: string;
    card: LiveCardPayload | PermissionCardPayload | null;
  }): void {
    const meta = this.getLatestEventMeta();
    this.deps.broadcastWs(params.threadId, {
      type: "message.created",
      data: {
        eventId: meta.eventId,
        seq: meta.seq,
        projectId: params.projectId,
        channelId: params.channelId,
        threadId: params.threadId,
        messageId: params.messageId,
        runId: params.runId,
        kind: params.kind,
        body: params.body,
        card: params.card,
      },
    });
  }

  private emitMessageUpdated(params: {
    projectId: string;
    channelId: string;
    threadId: string;
    messageId: string;
    runId: string;
    kind: "live_card" | "approval_card";
    card: LiveCardPayload | PermissionCardPayload;
  }): void {
    const meta = this.getLatestEventMeta();
    this.deps.broadcastWs(params.threadId, {
      type: "message.updated",
      data: {
        eventId: meta.eventId,
        seq: meta.seq,
        projectId: params.projectId,
        channelId: params.channelId,
        threadId: params.threadId,
        messageId: params.messageId,
        runId: params.runId,
        kind: params.kind,
        card: params.card,
      },
    });
  }

  private emitRunUpdated(runId: string): void {
    const row = this.deps.sqlite
      .prepare(`${RUN_SUMMARY_SELECT_SQL} WHERE r.id = ?`)
      .get(runId) as Record<string, unknown> | undefined;
    if (!row) return;
    const threadCtx = this.getActiveThreadContext(String(row.thread_id));
    if (!threadCtx) return;
    const meta = this.getLatestEventMeta();
    this.deps.broadcastWs(threadCtx.id, {
      type: "run.updated",
      data: {
        eventId: meta.eventId,
        seq: meta.seq,
        projectId: threadCtx.project_id,
        channelId: threadCtx.channel_id,
        threadId: threadCtx.id,
        run: this.mapRunRowToSummary(row),
      },
    });
  }

  private updateLiveCard(
    runId: string,
    updater: (current: LiveCardPayload) => LiveCardPayload,
  ): void {
    const row = this.deps.sqlite
      .prepare(
        `SELECT m.id, m.thread_id, m.card_json, t.project_id, t.channel_id
         FROM messages m
         INNER JOIN threads t ON t.id = m.thread_id
         INNER JOIN channels c ON c.id = t.channel_id AND c.deleted_at IS NULL
         WHERE m.run_id = ? AND m.kind = 'live_card'`,
      )
      .get(runId) as
      | { id: string; thread_id: string; card_json: string; project_id: string; channel_id: string }
      | undefined;
    if (!row) return;
    const next = updater(JSON.parse(row.card_json) as LiveCardPayload);
    const now = new Date().toISOString();
    this.deps.sqlite
      .prepare("UPDATE messages SET card_json = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(next), now, row.id);
    this.emitMessageUpdated({
      projectId: row.project_id,
      channelId: row.channel_id,
      threadId: row.thread_id,
      messageId: row.id,
      runId,
      kind: "live_card",
      card: next,
    });
  }
}
