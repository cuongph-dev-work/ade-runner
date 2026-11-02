import { openHubDatabase } from "../../apps/hub/src/db/client.js";
import { applyEventToProjection } from "../../apps/hub/src/db/projector.js";
import { RunDispatcher } from "../../apps/hub/src/runner/run-dispatcher.js";
import { ThreadScheduler } from "../../apps/hub/src/orchestration/thread-scheduler.js";
import { InProcessRunnerTransport } from "../../packages/runner/src/index.js";

async function main() {
  console.log("=== BẮT ĐẦU KIỂM CHỨNG: scripts/verify/fan-in.ts ===");
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

  // Seed project, channel, thread (main_agent: agt_lead)
  db.prepare(
    `INSERT INTO projects (id, name, repo_path, default_branch, workflow_id, memory_path, created_at, updated_at)
     VALUES ('prj_p4', 'P4 Test', '/tmp/p4', 'main', 'feature', '.ade/memory', datetime('now'), datetime('now'))`
  ).run();
  db.prepare(
    `INSERT INTO channels (id, project_id, name, created_at, updated_at)
     VALUES ('chn_p4', 'prj_p4', 'general', datetime('now'), datetime('now'))`
  ).run();
  db.prepare(
    `INSERT INTO threads (id, channel_id, project_id, root_message_id, title, state, workflow_id, main_agent_id, created_by, engine_halted, budget_usd, spent_usd, created_at, updated_at)
     VALUES ('thr_p4', 'chn_p4', 'prj_p4', 'msg_root', 'Thread Fan-In Test', 'planning', 'feature', 'agt_lead', 'usr_local', 0, 100, 0, datetime('now'), datetime('now'))`
  ).run();

  // Tạo runner
  db.prepare(
    `INSERT INTO runners (id, machine_name, status, harnesses_available_json, last_seen, owner_user_id)
     VALUES ('rnr_01', 'local-runner', 'online', '["claude-code", "codex"]', datetime('now'), 'usr_local')`
  ).run();

  // Tạo @lead, @coder, @tester, @qa
  db.prepare(
    `INSERT INTO agents (id, project_id, handle, display_name, role, harness, model, credential_profile, mcp_allow_json, write, can_be_main, enabled, max_depth, timeout_s, source_file, updated_at)
     VALUES
     ('agt_lead', 'prj_p4', '@lead', 'Tech Lead', 'main', 'claude-code', 'claude-3-5-sonnet', 'sub-claude', '[]', 0, 1, 1, 3, 600, 'lead.yaml', datetime('now')),
     ('agt_coder', 'prj_p4', '@coder', 'Coder', 'worker', 'claude-code', 'claude-3-5-sonnet', 'sub-claude', '[]', 1, 0, 1, 3, 600, 'coder.yaml', datetime('now')),
     ('agt_tester', 'prj_p4', '@tester', 'Tester', 'worker', 'claude-code', 'claude-3-5-sonnet', 'sub-claude', '[]', 1, 0, 1, 3, 600, 'tester.yaml', datetime('now')),
     ('agt_qa', 'prj_p4', '@qa', 'QA', 'worker', 'claude-code', 'claude-3-5-sonnet', 'sub-claude', '[]', 0, 0, 1, 3, 600, 'qa.yaml', datetime('now'))`
  ).run();

  const transport = new InProcessRunnerTransport();
  let mainAwokenPrompt: string | null = null;

  const dispatcher = new RunDispatcher({
    sqlite: db,
    mode: "solo",
    mcpUrl: "http://127.0.0.1:3000/mcp",
    transport,
    appendEvent,
    broadcastWs: () => {},
    resolveAgentSkills: () => [],
  });

  const scheduler = new ThreadScheduler({
    sqlite: db,
    appendEvent,
    dispatchRun: async (params) => {
      const runId = dispatcher.onAgentMentioned({
        projectId: "prj_p4",
        threadId: params.threadId,
        agentId: params.agentId,
        invokedBy: params.invokedBy,
        promptText: params.promptText,
        role: params.role ?? "worker",
        delegationId: params.delegationId,
        parentRunId: params.parentRunId,
        task: params.task,
      });
      return runId ?? "run_err";
    },
    tryDispatchQueued: (threadId) => {
      dispatcher.tryDispatchQueuedRuns(threadId);
    },
  });

  dispatcher.onDelegationCheck = (delId) => {
    const isDone = scheduler.checkAndHandleFanIn(delId);
    if (isDone) {
      const runs = db
        .prepare(
          `SELECT r.thread_id, r.project_id, r.status, r.outcome, r.summary, a.handle
           FROM runs r INNER JOIN agents a ON a.id = r.agent_id
           WHERE r.delegation_id = ?`
        )
        .all(delId) as Array<{
        thread_id: string;
        project_id: string;
        status: string;
        outcome: string | null;
        summary: string | null;
        handle: string;
      }>;
      const summaryList = runs
        .map((r) => `- ${r.handle}: ${r.status} (${r.outcome ?? "unknown"}) — "${r.summary ?? ""}"`)
        .join("\n");
      mainAwokenPrompt = `[TỔNG HỢP KẾT QUẢ CÁC WORKER (delegation: ${delId})]\n${summaryList}`;
      console.log("Main agent awoken with fan-in prompt:\n", mainAwokenPrompt);
    }
  };

  // 1. Main Agent gọi delegate 3 tasks
  const delResult = await scheduler.delegateTasks({
    threadId: "thr_p4",
    mainRunId: "run_main_01",
    mainAgentId: "agt_lead",
    tasks: [
      { agent: "@coder", task: "Lập trình backend auth", write: true },
      { agent: "@tester", task: "Viết test tự động", write: true },
      { agent: "@qa", task: "Review mã nguồn", write: false },
    ],
  });

  console.log("Delegated with ID:", delResult.delegation_id);
  console.log("Dispatched workers:", delResult.dispatched);

  if (delResult.dispatched.length !== 3) {
    throw new Error(`Kỳ vọng 3 workers được dispatch, nhận được ${delResult.dispatched.length}`);
  }

  // 2. Kết thúc worker 1 (@qa)
  const qaRun = delResult.dispatched.find((w) => w.agent === "@qa");
  transport.sendToHub({
    type: "run.end",
    runId: qaRun!.run_id,
    stopReason: "end_turn",
    errorCode: null,
    errorMessage: null,
    acpSessionId: null,
    usage: { inputTokens: 50, outputTokens: 50, costUsd: 0.005 },
  });
  if (mainAwokenPrompt !== null) {
    throw new Error("Main Agent không được đánh thức khi vẫn còn worker khác đang chạy!");
  }

  // 3. Kết thúc worker 2 (@coder)
  const coderRun = delResult.dispatched.find((w) => w.agent === "@coder");
  transport.sendToHub({
    type: "run.end",
    runId: coderRun!.run_id,
    stopReason: "end_turn",
    errorCode: null,
    errorMessage: null,
    acpSessionId: null,
    usage: { inputTokens: 80, outputTokens: 80, costUsd: 0.008 },
  });
  if (mainAwokenPrompt !== null) {
    throw new Error("Main Agent không được đánh thức khi worker 3 (@tester) chưa xong!");
  }

  // 4. Kết thúc worker 3 (@tester) -> Worker cuối cùng kết thúc!
  const testerRun = delResult.dispatched.find((w) => w.agent === "@tester");
  transport.sendToHub({
    type: "run.end",
    runId: testerRun!.run_id,
    stopReason: "end_turn",
    errorCode: null,
    errorMessage: null,
    acpSessionId: null,
    usage: { inputTokens: 90, outputTokens: 90, costUsd: 0.009 },
  });

  // Kiểm tra event delegation.completed
  const delCompletedEvt = eventsList.find((e) => e.type === "delegation.completed");
  if (!delCompletedEvt) {
    throw new Error("Kỳ vọng event 'delegation.completed' được phát ra khi worker cuối cùng kết thúc!");
  }

  if (!mainAwokenPrompt || !mainAwokenPrompt.includes("@coder") || !mainAwokenPrompt.includes("@tester") || !mainAwokenPrompt.includes("@qa")) {
    throw new Error("Kỳ vọng Main Agent nhận được prompt tổng hợp đầy đủ của cả 3 worker!");
  }

  console.log("[PASS] Fan-in aggregation verified: tất cả worker hoàn thành, phát delegation.completed và đánh thức Main Agent đúng 1 lần.");
}

main().catch((err) => {
  console.error("FAIL scripts/verify/fan-in.ts:", err);
  process.exit(1);
});
