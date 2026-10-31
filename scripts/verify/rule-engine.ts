import { RuleEngine } from "../../apps/hub/src/trigger/rule-engine.js";
import { openHubDatabase } from "../../apps/hub/src/db/client.js";
import { applyEventToProjection } from "../../apps/hub/src/db/projector.js";
import { BUILTIN_FEATURE_WORKFLOW } from "../../apps/hub/src/config/ade-loader.js";

async function main() {
  console.log("=== BẮT ĐẦU KIỂM CHỨNG: scripts/verify/rule-engine.ts ===");
  const hubDb = openHubDatabase(":memory:");
  const db = hubDb.sqlite;

  let seq = 1;
  const eventsList: any[] = [];
  let engineInstance: RuleEngine | null = null;

  const appendEvent = (evt: any) => {
    const full = {
      seq: seq++,
      event_id: `evt_${seq}`,
      type: evt.type,
      project_id: evt.projectId ?? evt.project_id ?? null,
      thread_id: evt.threadId ?? evt.thread_id ?? null,
      run_id: evt.runId ?? evt.run_id ?? null,
      actor_type: evt.actorType ?? evt.actor_type ?? "system",
      actor_id: evt.actorId ?? evt.actor_id ?? "sys",
      payload: evt.payload,
      ts: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    eventsList.push(full);
    applyEventToProjection(db, full as any);
    if (engineInstance) {
      engineInstance.onEvent({
        type: full.type,
        projectId: full.project_id,
        threadId: full.thread_id,
        runId: full.run_id,
        actorId: full.actor_id,
        payload: full.payload,
      });
    }
    return full;
  };

  // Tạo project, channel, thread
  db.prepare(
    `INSERT INTO projects (id, name, repo_path, default_branch, workflow_id, memory_path, created_at, updated_at)
     VALUES ('prj_p3', 'P3 Test', '/tmp/p3', 'main', 'feature', '.ade/memory', datetime('now'), datetime('now'))`
  ).run();
  db.prepare(
    `INSERT INTO channels (id, project_id, name, created_at, updated_at)
     VALUES ('chn_p3', 'prj_p3', 'general', datetime('now'), datetime('now'))`
  ).run();
  db.prepare(
    `INSERT INTO threads (id, channel_id, project_id, root_message_id, title, state, workflow_id, created_by, engine_halted, created_at, updated_at)
     VALUES ('thr_p3', 'chn_p3', 'prj_p3', 'msg_root', 'Thread Test', 'planning', 'feature', 'usr_local', 0, datetime('now'), datetime('now'))`
  ).run();
  db.prepare(
    `INSERT INTO messages (id, thread_id, author_type, author_id, kind, body, is_root, created_at, updated_at)
     VALUES ('msg_root', 'thr_p3', 'user', 'usr_local', 'text', 'Khởi tạo thread', 1, datetime('now'), datetime('now'))`
  ).run();

  const customWorkflow = {
    ...BUILTIN_FEATURE_WORKFLOW,
    rules: [
      {
        id: "r1",
        on: "run.outcome_reported",
        when: { status: "done" },
        do: [{ set_state: "plan_review" }],
      },
      {
        id: "r_loop",
        on: "thread.state_changed",
        when: { to: "looping" },
        do: [{ set_state: "looping" }],
      },
    ],
  };

  const engine = new RuleEngine({
    sqlite: db,
    appendEvent,
    getWorkflow: () => customWorkflow as any,
  });
  engineInstance = engine;

  // Test 1: Outcome reported chuyển state
  console.log("[1] Kiểm tra RuleEngine đổi state khi nhận run.outcome_reported status: done");
  engine.onEvent({
    type: "run.outcome_reported",
    projectId: "prj_p3",
    threadId: "thr_p3",
    runId: "run_p3",
    actorId: "agt_lead",
    payload: {
      status: "done",
      summary: "Kế hoạch đã xong",
    },
  });

  const row1 = db.prepare("SELECT state, engine_halted FROM threads WHERE id = 'thr_p3'").get() as any;
  if (row1?.state !== "plan_review") {
    console.error(`FAIL: Mong đợi state = 'plan_review', nhận được '${row1?.state}'`);
    process.exit(1);
  }
  console.log("PASS: Thread đã chuyển thành công sang 'plan_review'");

  // Test 2: Loop Guard kích hoạt khi chuỗi đệ quy vượt 10
  console.log("[2] Kiểm tra Loop Guard: ngắt engine và đánh dấu engine_halted = 1 khi lặp đệ quy > 10");
  db.prepare("UPDATE threads SET state = 'planning', engine_halted = 0 WHERE id = 'thr_p3'").run();

  // Đổi state sang 'looping' để kích hoạt rule lặp đệ quy qua appendEvent
  engine.onEvent({
    type: "thread.state_changed",
    projectId: "prj_p3",
    threadId: "thr_p3",
    runId: null,
    actorId: "sys",
    payload: {
      from: "planning",
      to: "looping",
      reason: "Bắt đầu vòng lặp",
    },
  });

  const row2 = db.prepare("SELECT state, engine_halted FROM threads WHERE id = 'thr_p3'").get() as any;
  if (row2?.engine_halted !== 1) {
    console.error(`FAIL: Mong đợi engine_halted = 1, nhận được ${row2?.engine_halted}`);
    process.exit(1);
  }
  console.log("PASS: Loop guard đã chặn thành công và gắn cờ engine_halted = 1");

  console.log("=== KẾT QUẢ: TOÀN BỘ KIỂM CHỨNG RULE ENGINE ĐÃ PASS ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL ERROR in rule-engine verify script:", err);
  process.exit(1);
});
