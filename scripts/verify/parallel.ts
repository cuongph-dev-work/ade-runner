import { openHubDatabase } from "../../apps/hub/src/db/client.js";
import { applyEventToProjection } from "../../apps/hub/src/db/projector.js";
import { RunDispatcher } from "../../apps/hub/src/runner/run-dispatcher.js";
import { InProcessRunnerTransport } from "../../packages/runner/src/index.js";

async function main() {
  console.log("=== BẮT ĐẦU KIỂM CHỨNG: scripts/verify/parallel.ts ===");
  const hubDb = openHubDatabase(":memory:");
  const db = hubDb.sqlite;

  let seq = 1;
  const eventsList: any[] = [];

  const appendEvent = (evt: any) => {
    const full = {
      seq: seq++,
      id: `evt_${seq}`,
      type: evt.type,
      project_id: evt.projectId ?? evt.project_id ?? null,
      thread_id: evt.threadId ?? evt.thread_id ?? null,
      run_id: evt.runId ?? evt.run_id ?? null,
      actor: { type: evt.actorType ?? "system", id: evt.actorId ?? "sys" },
      payload: evt.payload,
      ts: new Date().toISOString(),
    };
    eventsList.push(full);
    applyEventToProjection(db, full as any);
    return full;
  };

  // Seed project, channel, thread
  db.prepare(
    `INSERT INTO projects (id, name, repo_path, default_branch, workflow_id, memory_path, created_at, updated_at)
     VALUES ('prj_p4', 'P4 Test', '/tmp/p4', 'main', 'feature', '.ade/memory', datetime('now'), datetime('now'))`
  ).run();
  db.prepare(
    `INSERT INTO channels (id, project_id, name, created_at, updated_at)
     VALUES ('chn_p4', 'prj_p4', 'general', datetime('now'), datetime('now'))`
  ).run();
  db.prepare(
    `INSERT INTO threads (id, channel_id, project_id, root_message_id, title, state, workflow_id, created_by, engine_halted, budget_usd, spent_usd, created_at, updated_at)
     VALUES ('thr_p4', 'chn_p4', 'prj_p4', 'msg_root', 'Thread P4 Parallel', 'planning', 'feature', 'usr_local', 0, 100, 0, datetime('now'), datetime('now'))`
  ).run();

  // Tạo runner online hỗ trợ codex và claude-code
  db.prepare(
    `INSERT INTO runners (id, machine_name, status, harnesses_available_json, last_seen, owner_user_id)
     VALUES ('rnr_01', 'local-runner', 'online', '["claude-code", "codex"]', datetime('now'), 'usr_local')`
  ).run();

  // Tạo 3 agents:
  // - @coder (write: 1)
  // - @tester (write: 1)
  // - @qa (write: 0, read-only)
  db.prepare(
    `INSERT INTO agents (id, project_id, handle, display_name, role, harness, model, credential_profile, mcp_allow_json, write, can_be_main, enabled, max_depth, timeout_s, source_file, updated_at)
     VALUES
     ('agt_coder', 'prj_p4', '@coder', 'Coder', 'worker', 'claude-code', 'claude-3-5-sonnet', 'sub-claude', '[]', 1, 0, 1, 3, 600, 'coder.yaml', datetime('now')),
     ('agt_tester', 'prj_p4', '@tester', 'Tester', 'worker', 'claude-code', 'claude-3-5-sonnet', 'sub-claude', '[]', 1, 0, 1, 3, 600, 'tester.yaml', datetime('now')),
     ('agt_qa', 'prj_p4', '@qa', 'QA', 'worker', 'claude-code', 'claude-3-5-sonnet', 'sub-claude', '[]', 0, 0, 1, 3, 600, 'qa.yaml', datetime('now'))`
  ).run();

  const transport = new InProcessRunnerTransport();
  const dispatcher = new RunDispatcher({
    sqlite: db,
    mode: "solo",
    mcpUrl: "http://127.0.0.1:3000/mcp",
    transport,
    appendEvent,
    broadcastWs: () => {},
    resolveAgentSkills: () => [],
  });

  // 1. Dispatch @coder (write: 1)
  const runCoderId = dispatcher.onAgentMentioned({
    projectId: "prj_p4",
    threadId: "thr_p4",
    agentId: "agt_coder",
    invokedBy: "usr_local",
    promptText: "Task Coder: Write code",
  });
  console.log("Dispatched @coder run:", runCoderId);

  // 2. Dispatch @qa (write: 0, read-only) -> Được phép chạy song song với @coder!
  const runQaId = dispatcher.onAgentMentioned({
    projectId: "prj_p4",
    threadId: "thr_p4",
    agentId: "agt_qa",
    invokedBy: "usr_local",
    promptText: "Task QA: Review code",
  });
  console.log("Dispatched @qa run:", runQaId);

  // 3. Dispatch @tester (write: 1) -> Đụng write lock với @coder, phải chuyển sang queued!
  const runTesterId = dispatcher.onAgentMentioned({
    projectId: "prj_p4",
    threadId: "thr_p4",
    agentId: "agt_tester",
    invokedBy: "usr_local",
    promptText: "Task Tester: Run tests",
  });
  console.log("Dispatched @tester run:", runTesterId);

  // Kiểm tra trạng thái trong DB:
  const runCoderRow = db.prepare("SELECT status FROM runs WHERE id = ?").get(runCoderId) as { status: string };
  const runQaRow = db.prepare("SELECT status FROM runs WHERE id = ?").get(runQaId) as { status: string };
  const runTesterRow = db.prepare("SELECT status FROM runs WHERE id = ?").get(runTesterId) as { status: string };

  console.log("Status coder:", runCoderRow?.status);
  console.log("Status qa (read-only):", runQaRow?.status);
  console.log("Status tester (write queued):", runTesterRow?.status);

  if (runCoderRow?.status !== "running") {
    throw new Error(`Kỳ vọng coder status 'running', nhưng là '${runCoderRow?.status}'`);
  }
  if (runQaRow?.status !== "running") {
    throw new Error(`Kỳ vọng qa (read-only) status 'running' song song, nhưng là '${runQaRow?.status}'`);
  }
  if (runTesterRow?.status !== "queued") {
    throw new Error(`Kỳ vọng tester (write) status 'queued' do khóa ghi, nhưng là '${runTesterRow?.status}'`);
  }

  // 4. Giả lập @coder kết thúc -> @tester trong hàng đợi được tự động kích hoạt chuyển sang running!
  console.log("Hoàn thành run @coder...");
  transport.sendToHub({
    type: "run.end",
    runId: runCoderId!,
    stopReason: "end_turn",
    errorCode: null,
    errorMessage: null,
    acpSessionId: null,
    usage: {
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0.01,
    },
  });

  const runTesterAfter = db.prepare("SELECT status FROM runs WHERE id = ?").get(runTesterId) as { status: string };
  console.log("Status tester sau khi coder xong:", runTesterAfter?.status);

  if (runTesterAfter?.status !== "running") {
    throw new Error(`Kỳ vọng tester chuyển sang 'running' sau khi coder xong, nhưng là '${runTesterAfter?.status}'`);
  }

  console.log("[PASS] Parallel concurrency lock verified: @qa chạy song song với write worker; @coder và @tester không đè worktree nhau.");
}

main().catch((err) => {
  console.error("FAIL scripts/verify/parallel.ts:", err);
  process.exit(1);
});
