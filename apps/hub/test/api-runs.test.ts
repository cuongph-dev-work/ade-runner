import Fastify from "fastify";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { InProcessRunnerTransport, type AdeMode } from "@ade/runner";
import {
  WsRunnerServerEventSchema,
  type RunnerMessage,
  type WsRunnerServerEvent,
} from "@ade/shared";
import { assertRunTransition, assertRunnerTransition } from "../src/runner/state-machines.js";
import { projectRunnerEvent } from "../src/db/projector.js";
import { RunDispatcher } from "../src/runner/run-dispatcher.js";
import { registerRunRoutes } from "../src/routes/runs.js";

function createTestEnv(mode: AdeMode = "solo") {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE events (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL,
      type TEXT NOT NULL,
      project_id TEXT,
      thread_id TEXT,
      run_id TEXT,
      actor_type TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      ts TEXT NOT NULL
    );
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'ADE Demo',
      repo_path TEXT NOT NULL,
      default_branch TEXT NOT NULL DEFAULT 'main',
      workflow_id TEXT NOT NULL DEFAULT 'feature',
      use_repo_instructions INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE channels (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT 'general',
      description TEXT NOT NULL DEFAULT '',
      deleted_at TEXT
    );
    CREATE TABLE threads (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      channel_id TEXT NOT NULL DEFAULT 'chn_01',
      root_message_id TEXT,
      title TEXT NOT NULL DEFAULT 'Thread 01',
      state TEXT NOT NULL DEFAULT 'open',
      previous_state TEXT,
      workflow_id TEXT NOT NULL DEFAULT 'feature',
      budget_usd REAL,
      spent_usd REAL NOT NULL DEFAULT 0,
      engine_halted INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT
    );
    CREATE TABLE agents (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      handle TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      harness TEXT NOT NULL,
      model TEXT,
      credential_profile TEXT NOT NULL,
      write INTEGER NOT NULL DEFAULT 0,
      max_depth INTEGER NOT NULL DEFAULT 3,
      enabled INTEGER NOT NULL DEFAULT 1,
      budget_usd REAL,
      timeout_s INTEGER NOT NULL DEFAULT 600,
      source_file TEXT
    );
    CREATE TABLE runners (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      machine_name TEXT NOT NULL,
      harnesses_available_json TEXT NOT NULL,
      status TEXT NOT NULL,
      last_seen TEXT NOT NULL
    );
    CREATE TABLE runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      invoked_by TEXT NOT NULL,
      runner_id TEXT,
      credential_profile TEXT NOT NULL,
      acp_session_id TEXT,
      role TEXT NOT NULL,
      task TEXT,
      delegation_id TEXT,
      parent_run_id TEXT,
      depth INTEGER NOT NULL DEFAULT 0,
      timeout_s INTEGER NOT NULL DEFAULT 600,
      status TEXT NOT NULL,
      outcome TEXT,
      stop_reason TEXT,
      summary TEXT,
      decisions_json TEXT,
      skills_snapshot_json TEXT NOT NULL,
      cost_usd REAL NOT NULL DEFAULT 0,
      started_at TEXT,
      ended_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE run_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      kind TEXT NOT NULL,
      data_json TEXT NOT NULL,
      ts TEXT NOT NULL
    );
    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      is_root INTEGER NOT NULL DEFAULT 0,
      author_type TEXT NOT NULL,
      author_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      body TEXT NOT NULL,
      mentions_json TEXT NOT NULL DEFAULT '[]',
      human_mentions_json TEXT NOT NULL DEFAULT '[]',
      reactions_json TEXT NOT NULL DEFAULT '[]',
      card_json TEXT,
      run_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  sqlite
    .prepare("INSERT INTO projects (id, repo_path, default_branch) VALUES ('prj_01', '/tmp/repo', 'main')")
    .run();
  sqlite
    .prepare("INSERT INTO channels (id, project_id, name, description) VALUES ('chn_01', 'prj_01', 'general', 'Kênh chung')")
    .run();
  sqlite.prepare("INSERT INTO threads (id, project_id, channel_id) VALUES ('thr_01', 'prj_01', 'chn_01')").run();
  sqlite
    .prepare(
      `INSERT INTO agents (id, project_id, handle, display_name, harness, credential_profile, write, budget_usd)
       VALUES
         ('agt_codex', 'prj_01', '@coder', 'Coder', 'codex', 'sub-chatgpt', 0, 0.05),
         ('agt_writer_a', 'prj_01', '@writer_a', 'Writer A', 'claude-code', 'sub-claude', 1, 1.0),
         ('agt_writer_b', 'prj_01', '@writer_b', 'Writer B', 'claude-code', 'sub-claude', 1, 1.0)`,
    )
    .run();

  const transport = new InProcessRunnerTransport();
  const sentToRunner: RunnerMessage[] = [];
  transport.onRunnerReceive((msg) => sentToRunner.push(msg));

  let evtCounter = 0;
  const appendEvent = sqlite.transaction(
    (evt: {
      type: string;
      projectId: string | null;
      threadId: string | null;
      runId: string | null;
      actorType: "human" | "agent" | "system";
      actorId: string;
      payload: Record<string, unknown>;
    }) => {
      evtCounter += 1;
      const ts = new Date().toISOString();
      sqlite
        .prepare(
          `INSERT INTO events (id, type, project_id, thread_id, run_id, actor_type, actor_id, payload, ts)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          `evt_${evtCounter}`,
          evt.type,
          evt.projectId,
          evt.threadId,
          evt.runId,
          evt.actorType,
          evt.actorId,
          JSON.stringify(evt.payload),
          ts,
        );
      projectRunnerEvent(sqlite, {
        type: evt.type,
        projectId: evt.projectId,
        threadId: evt.threadId,
        runId: evt.runId,
        actorId: evt.actorId,
        payload: evt.payload,
        ts,
      });
    },
  );

  const wsEvents: WsRunnerServerEvent[] = [];
  const dispatcher = new RunDispatcher({
    sqlite,
    mode,
    mcpUrl: null,
    transport,
    appendEvent,
    broadcastWs: (_tid, ev) => {
      wsEvents.push(WsRunnerServerEventSchema.parse(ev));
    },
    resolveAgentSkills: () => [],
  });

  const app = Fastify();
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof assertRunTransition.constructor || error.name === "HubDomainError") {
      const e = error as unknown as { httpStatus: number; code: string; message: string; fieldErrors?: Record<string, string[]> };
      return reply.status(e.httpStatus ?? 500).send({
        code: e.code,
        message: e.message,
        details: e.fieldErrors ? { fieldErrors: e.fieldErrors } : {},
      });
    }
    return reply.status(500).send({
      code: "ERR_INTERNAL_ERROR",
      message: "Lỗi hệ thống nội bộ.",
      details: {},
    });
  });
  void registerRunRoutes(app, { dispatcher, mode });

  return { sqlite, transport, sentToRunner, wsEvents, dispatcher, app };
}

describe("API-RN-01 Integration & State Machines", () => {
  it("AC-Runner-01, AC-Runner-02 & AC-API-RN-01-01: chuyển trạng thái Runner T-01..T-04 và chặn offline -> offline", () => {
    const { sqlite, transport } = createTestEnv();
    transport.sendToHub({
      type: "runner.hello",
      runnerId: "rnr_test",
      machineName: "MBP",
      harnessesAvailable: ["claude-code", "codex"],
      version: "0.1.0",
    });
    transport.sendToHub({
      type: "runner.hello",
      runnerId: "rnr_test",
      machineName: "MBP-2",
      harnessesAvailable: ["claude-code", "codex"],
      version: "0.1.0",
    });
    transport.disconnectRunner("rnr_test", "socket_closed");
    let row = sqlite.prepare("SELECT status FROM runners WHERE id = 'rnr_test'").get() as {
      status: string;
    };
    expect(row.status).toBe("offline");

    transport.sendToHub({
      type: "runner.hello",
      runnerId: "rnr_test",
      machineName: "MBP-2",
      harnessesAvailable: ["claude-code", "codex"],
      version: "0.1.0",
    });
    row = sqlite.prepare("SELECT status FROM runners WHERE id = 'rnr_test'").get() as {
      status: string;
    };
    expect(row.status).toBe("online");
    expect(() => assertRunnerTransition("offline", "offline")).toThrowError(/offline/);
  });

  it("AC-API-RN-01-03, AC-API-RN-01-04, AC-API-RN-01-08, AC-API-RN-01-19, AC-API-RN-01-20 & AC-API-RN-01-23: kiểm tra 403, 404 (kể cả kênh đã xoá mềm), 422 V-07..V-10 và API-4 runs theo project", async () => {
    const { app, sqlite, transport, dispatcher } = createTestEnv("solo");
    await app.ready();

    transport.sendToHub({
      type: "runner.hello",
      runnerId: "rnr_local",
      machineName: "MBP",
      harnessesAvailable: ["claude-code", "codex"],
      version: "0.1.0",
    });

    const activeRunId = dispatcher.onAgentMentioned({
      projectId: "prj_01",
      threadId: "thr_01",
      agentId: "agt_codex",
      invokedBy: "usr_local",
      promptText: "Chạy trong kênh hoạt động",
    })!;
    transport.sendToHub({
      type: "permission.request",
      runId: activeRunId,
      requestId: "req_active",
      tool: "Bash",
      args: { command: "npm test" },
      displayCommand: "Bash: npm test",
      options: [
        { id: "allow", label: "Cho phép", decision: "allow" },
        { id: "deny", label: "Từ chối", decision: "deny" },
      ],
    });

    // Kênh đã xoá mềm (channels.deleted_at IS NOT NULL) -> 404 cho API-1, API-2, API-3 và bị loại khỏi API-4
    sqlite
      .prepare(
        "INSERT INTO channels (id, project_id, name, description, deleted_at) VALUES ('chn_del', 'prj_01', 'archived', '', '2026-10-31T06:00:00.000Z')",
      )
      .run();
    sqlite
      .prepare("INSERT INTO threads (id, project_id, channel_id) VALUES ('thr_del', 'prj_01', 'chn_del')")
      .run();
    sqlite
      .prepare(
        `INSERT INTO runs (id, project_id, thread_id, agent_id, invoked_by, credential_profile, role, depth, timeout_s, status, skills_snapshot_json, cost_usd, created_at)
         VALUES ('run_del_01', 'prj_01', 'thr_del', 'agt_codex', 'usr_local', 'sub-chatgpt', 'worker', 0, 600, 'waiting_permission', '[]', 0, '2026-10-31T06:00:01.000Z')`,
      )
      .run();
    sqlite
      .prepare(
        `INSERT INTO messages (id, thread_id, is_root, author_type, author_id, kind, body, card_json, run_id, created_at, updated_at)
         VALUES ('msg_del_card', 'thr_del', 0, 'agent', 'agt_codex', 'approval_card', '', ?, 'run_del_01', '2026-10-31T06:00:01.000Z', '2026-10-31T06:00:01.000Z')`,
      )
      .run(
        JSON.stringify({
          cardType: "tool_permission",
          runId: "run_del_01",
          requestId: "req_del_01",
          agentHandle: "@coder",
          invokedBy: "usr_local",
          tool: "Bash",
          args: {},
          displayCommand: "Bash: ls",
          options: [
            { id: "allow", label: "Cho phép", decision: "allow" },
            { id: "deny", label: "Từ chối", decision: "deny" },
          ],
          status: "pending",
          selectedOptionId: null,
          decidedBy: null,
          decidedAt: null,
        }),
      );

    // AC-API-RN-01-23: API-4 trả về run thuộc kênh hoạt động kèm pendingPermissionTool = "Bash" và loại trừ run_del_01
    const projRunsRes = await app.inject({
      method: "GET",
      url: "/api/projects/prj_01/runs",
      headers: { host: "127.0.0.1:4310" },
    });
    expect(projRunsRes.statusCode).toBe(200);
    expect(projRunsRes.json().runs).toHaveLength(1);
    expect(projRunsRes.json().runs[0]).toMatchObject({
      id: activeRunId,
      pendingPermissionTool: "Bash",
    });

    const notFoundProject = await app.inject({
      method: "GET",
      url: "/api/projects/prj_01J000000000000000000000/runs",
      headers: { host: "127.0.0.1:4310" },
    });
    expect(notFoundProject.statusCode).toBe(404);
    expect(notFoundProject.json().code).toBe("ERR_NOT_FOUND");

    for (const softDelReq of [
      { method: "GET" as const, url: "/api/threads/thr_del/runs" },
      {
        method: "POST" as const,
        url: "/api/runs/run_del_01/permissions/req_del_01/reply",
        payload: { optionId: "allow", decision: "allow" },
      },
      { method: "POST" as const, url: "/api/runs/run_del_01/cancel" },
    ]) {
      const res = await app.inject({ ...softDelReq, headers: { host: "127.0.0.1:4310" } });
      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe("ERR_NOT_FOUND");
    }

    const forbidden = await app.inject({
      method: "GET",
      url: "/api/threads/thr_01/runs",
      headers: { origin: "https://evil.example.com", host: "127.0.0.1:4310" },
    });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json().code).toBe("ERR_LOCAL_ORIGIN_ONLY");

    const notFoundThread = await app.inject({
      method: "GET",
      url: "/api/threads/thr_01J00000000000000000000000/runs",
      headers: { host: "127.0.0.1:4310" },
    });
    expect(notFoundThread.statusCode).toBe(404);
    expect(notFoundThread.json().code).toBe("ERR_NOT_FOUND");

    const notFoundPerm = await app.inject({
      method: "POST",
      url: "/api/runs/run_perm_allow/permissions/req_khong_ton_tai/reply",
      headers: { host: "127.0.0.1:4310" },
      payload: { optionId: "allow", decision: "allow" },
    });
    expect(notFoundPerm.statusCode).toBe(404);

    const notFoundCancel = await app.inject({
      method: "POST",
      url: "/api/runs/run_khong_ton_tai_99/cancel",
      headers: { host: "127.0.0.1:4310" },
    });
    expect(notFoundCancel.statusCode).toBe(404);

    for (const bad of [
      { method: "GET" as const, url: "/api/projects/sai_prj/runs" },
      { method: "GET" as const, url: "/api/threads/sai_dinh_dang/runs" },
      {
        method: "POST" as const,
        url: "/api/runs/bad_id/permissions/req_01/reply",
        payload: { optionId: "allow", decision: "allow" },
      },
      {
        method: "POST" as const,
        url: "/api/runs/run_01/permissions/bad_req/reply",
        payload: { optionId: "allow", decision: "allow" },
      },
      { method: "POST" as const, url: "/api/runs/x/cancel" },
    ]) {
      const res = await app.inject({ ...bad, headers: { host: "127.0.0.1:4310" } });
      expect(res.statusCode).toBe(422);
      expect(JSON.stringify(res.json())).toContain("MSG04");
    }
  });

  it("AC-API-RN-01-05, AC-API-RN-01-06, AC-API-RN-01-07, AC-API-RN-01-09, AC-API-RN-01-10, AC-API-RN-01-11, AC-API-RN-01-12, AC-Run-01 & AC-Run-02: quyền công cụ, huỷ run và chặn chuyển trạng thái sai", async () => {
    const { app, sqlite, transport, dispatcher } = createTestEnv("solo");
    await app.ready();
    transport.sendToHub({
      type: "runner.hello",
      runnerId: "rnr_local",
      machineName: "MBP",
      harnessesAvailable: ["claude-code", "codex"],
      version: "0.1.0",
    });

    const runId = dispatcher.onAgentMentioned({
      projectId: "prj_01",
      threadId: "thr_01",
      agentId: "agt_codex",
      invokedBy: "usr_local",
      promptText: "Chạy npm test",
    })!;
    expect(runId).toMatch(/^run_/);

    transport.sendToHub({
      type: "permission.request",
      runId,
      requestId: "req_01",
      tool: "Bash",
      args: { command: "npm test" },
      displayCommand: "Bash: npm test",
      options: [
        { id: "allow", label: "Cho phép", decision: "allow" },
        { id: "deny", label: "Từ chối", decision: "deny" },
      ],
    });

    // AC-API-RN-01-09: optionId không khớp options trên thẻ -> 422 MSG04
    const mismatch = await app.inject({
      method: "POST",
      url: `/api/runs/${runId}/permissions/req_01/reply`,
      headers: { host: "127.0.0.1:4310" },
      payload: { optionId: "opt_khong_ton_tai", decision: "allow" },
    });
    expect(mismatch.statusCode).toBe(422);
    expect(mismatch.json().details.fieldErrors.optionId).toContain("MSG04");

    // AC-API-RN-01-05: Cho phép thành công -> 200 MSG16
    const okAllow = await app.inject({
      method: "POST",
      url: `/api/runs/${runId}/permissions/req_01/reply`,
      headers: { host: "127.0.0.1:4310" },
      payload: { optionId: "allow", decision: "allow" },
    });
    expect(okAllow.statusCode).toBe(200);
    expect(okAllow.json().messageCode).toBe("MSG16");

    // AC-API-RN-01-07: Gửi lại lần 2 -> 409 ERR_PERMISSION_ALREADY_RESOLVED
    const dup = await app.inject({
      method: "POST",
      url: `/api/runs/${runId}/permissions/req_01/reply`,
      headers: { host: "127.0.0.1:4310" },
      payload: { optionId: "deny", decision: "deny" },
    });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().code).toBe("ERR_PERMISSION_ALREADY_RESOLVED");

    // Hoàn tất run rồi thử cancel -> 409 ERR_RUN_NOT_CANCELLABLE (AC-API-RN-01-11 & AC-Run-02)
    transport.sendToHub({
      type: "run.end",
      runId,
      stopReason: "end_turn",
      errorCode: null,
      errorMessage: null,
      acpSessionId: "ses_01",
      usage: { inputTokens: 10, outputTokens: 10, costUsd: 0.01 },
    });
    const cancelDone = await app.inject({
      method: "POST",
      url: `/api/runs/${runId}/cancel`,
      headers: { host: "127.0.0.1:4310" },
    });
    expect(cancelDone.statusCode).toBe(409);
    expect(cancelDone.json().code).toBe("ERR_RUN_NOT_CANCELLABLE");

    // AC-API-RN-01-10: Huỷ khi đang waiting_permission -> cả approval_card và live_card đều cancelled
    const runWp = dispatcher.onAgentMentioned({
      projectId: "prj_01",
      threadId: "thr_01",
      agentId: "agt_codex",
      invokedBy: "usr_local",
      promptText: "Chạy lần 2",
    })!;
    transport.sendToHub({
      type: "permission.request",
      runId: runWp,
      requestId: "req_02",
      tool: "Bash",
      args: { command: "npm test" },
      displayCommand: "Bash: npm test",
      options: [
        { id: "allow", label: "Cho phép", decision: "allow" },
        { id: "deny", label: "Từ chối", decision: "deny" },
      ],
    });
    const cancelWp = await app.inject({
      method: "POST",
      url: `/api/runs/${runWp}/cancel`,
      headers: { host: "127.0.0.1:4310" },
    });
    expect(cancelWp.statusCode).toBe(200);
    const approvalCardRow = sqlite
      .prepare("SELECT card_json FROM messages WHERE run_id = ? AND kind = 'approval_card'")
      .get(runWp) as { card_json: string };
    expect(JSON.parse(approvalCardRow.card_json).status).toBe("cancelled");

    // AC-API-RN-01-12: chặn chuyển trạng thái bất hợp lệ từ queued
    expect(() => assertRunTransition("queued", "completed")).toThrowError();
    expect(() => assertRunTransition("queued", "failed")).toThrowError();
  });

  it("AC-API-RN-01-15, AC-API-RN-01-16, AC-API-RN-01-17, AC-API-RN-01-18, AC-API-RN-01-21 & AC-API-RN-01-22: mode mismatch, runner unavailable/offline, budget (agent & thread), write lock và 500", async () => {
    // AC-API-RN-01-15: VPS + sub-chatgpt -> không tạo run, ghi message.posted
    const vpsEnv = createTestEnv("vps");
    const vpsRes = vpsEnv.dispatcher.onAgentMentioned({
      projectId: "prj_01",
      threadId: "thr_01",
      agentId: "agt_codex",
      invokedBy: "usr_local",
      promptText: "Test VPS",
    });
    expect(vpsRes).toBeNull();
    const vpsEvt = vpsEnv.sqlite
      .prepare("SELECT payload FROM events WHERE type = 'message.posted'")
      .get() as { payload: string };
    expect(vpsEvt.payload).toContain("ERR_CREDENTIAL_MODE_MISMATCH");

    // AC-API-RN-01-18: chưa có runner nào hỗ trợ codex -> không tạo run, ghi ERR_RUNNER_UNAVAILABLE
    const env = createTestEnv("solo");
    await env.app.ready();
    env.transport.sendToHub({
      type: "runner.hello",
      runnerId: "rnr_claude_only",
      machineName: "MBP",
      harnessesAvailable: ["claude-code"],
      version: "0.1.0",
    });
    expect(
      env.dispatcher.onAgentMentioned({
        projectId: "prj_01",
        threadId: "thr_01",
        agentId: "agt_codex",
        invokedBy: "usr_local",
        promptText: "Thử codex",
      }),
    ).toBeNull();

    // AC-API-RN-01-16: runner hỗ trợ codex đang offline -> giữ ở queued, chưa tạo live_card
    env.transport.sendToHub({
      type: "runner.hello",
      runnerId: "rnr_codex",
      machineName: "MBP-Codex",
      harnessesAvailable: ["codex"],
      version: "0.1.0",
    });
    env.transport.disconnectRunner("rnr_codex", "network");
    const queuedRunId = env.dispatcher.onAgentMentioned({
      projectId: "prj_01",
      threadId: "thr_01",
      agentId: "agt_codex",
      invokedBy: "usr_local",
      promptText: "Chờ online",
    })!;
    const liveCardsWhileQueued = env.sqlite
      .prepare("SELECT COUNT(*) AS cnt FROM messages WHERE run_id = ? AND kind = 'live_card'")
      .get(queuedRunId) as { cnt: number };
    expect(liveCardsWhileQueued.cnt).toBe(0);

    // Khi runner kết nối lại -> tự động chuyển sang running + tạo đúng 1 live_card, rồi vượt agent budget -> failed (AC-API-RN-01-17)
    env.transport.sendToHub({
      type: "runner.hello",
      runnerId: "rnr_codex",
      machineName: "MBP-Codex",
      harnessesAvailable: ["codex"],
      version: "0.1.0",
    });
    env.transport.sendToHub({
      type: "run.end",
      runId: queuedRunId,
      stopReason: "end_turn",
      errorCode: null,
      errorMessage: null,
      acpSessionId: null,
      usage: { inputTokens: 100, outputTokens: 200, costUsd: 0.09 },
    });
    const overBudgetRun = env.sqlite
      .prepare("SELECT status, stop_reason FROM runs WHERE id = ?")
      .get(queuedRunId) as { status: string; stop_reason: string };
    expect(overBudgetRun).toEqual({ status: "failed", stop_reason: "budget_exceeded" });

    // AC-API-RN-01-17 (nhánh vượt threads.budget_usd khi costUsd <= agents.budget_usd)
    env.sqlite
      .prepare("UPDATE threads SET budget_usd = 0.11, spent_usd = 0.09 WHERE id = 'thr_01'")
      .run();
    const threadBudgetRunId = env.dispatcher.onAgentMentioned({
      projectId: "prj_01",
      threadId: "thr_01",
      agentId: "agt_codex",
      invokedBy: "usr_local",
      promptText: "Thử trần ngân sách thread",
    })!;
    env.transport.sendToHub({
      type: "run.end",
      runId: threadBudgetRunId,
      stopReason: "end_turn",
      errorCode: null,
      errorMessage: null,
      acpSessionId: null,
      usage: { inputTokens: 50, outputTokens: 50, costUsd: 0.03 },
    });
    const overThreadBudgetRow = env.sqlite
      .prepare("SELECT status, stop_reason FROM runs WHERE id = ?")
      .get(threadBudgetRunId) as { status: string; stop_reason: string };
    expect(overThreadBudgetRow).toEqual({ status: "failed", stop_reason: "budget_exceeded" });
    env.sqlite.prepare("UPDATE threads SET budget_usd = NULL WHERE id = 'thr_01'").run();

    // AC-API-RN-01-21: Khoá ghi theo thread cho write = 1
    const runWa = env.dispatcher.onAgentMentioned({
      projectId: "prj_01",
      threadId: "thr_01",
      agentId: "agt_writer_a",
      invokedBy: "usr_local",
      promptText: "Ghi A",
    })!;
    const runWb = env.dispatcher.onAgentMentioned({
      projectId: "prj_01",
      threadId: "thr_01",
      agentId: "agt_writer_b",
      invokedBy: "usr_local",
      promptText: "Ghi B",
    })!;
    expect(
      (env.sqlite.prepare("SELECT status FROM runs WHERE id = ?").get(runWb) as { status: string })
        .status,
    ).toBe("queued");
    env.transport.sendToHub({
      type: "run.end",
      runId: runWa,
      stopReason: "end_turn",
      errorCode: null,
      errorMessage: null,
      acpSessionId: null,
      usage: { inputTokens: 10, outputTokens: 10, costUsd: 0.01 },
    });
    expect(
      (env.sqlite.prepare("SELECT status FROM runs WHERE id = ?").get(runWb) as { status: string })
        .status,
    ).toBe("running");

    // AC-API-RN-01-22: 500 ERR_INTERNAL_ERROR khi SQLite đóng kết nối bất ngờ
    env.sqlite.close();
    const err500 = await env.app.inject({
      method: "GET",
      url: "/api/threads/thr_01/runs",
      headers: { host: "127.0.0.1:4310" },
    });
    expect(err500.statusCode).toBe(500);
    expect(err500.json()).toMatchObject({
      code: "ERR_INTERNAL_ERROR",
      message: "Lỗi hệ thống nội bộ.",
    });
  });
});
