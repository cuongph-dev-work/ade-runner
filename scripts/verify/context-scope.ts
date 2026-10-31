import { openHubDatabase } from "../../apps/hub/src/db/client.js";
import { applyEventToProjection } from "../../apps/hub/src/db/projector.js";
import { McpServer } from "../../apps/hub/src/mcp/mcp-server.js";
import { GrantService } from "../../apps/hub/src/trigger/grant-service.js";

async function main() {
  console.log("=== BẮT ĐẦU KIỂM CHỨNG: scripts/verify/context-scope.ts ===");
  const hubDb = openHubDatabase(":memory:");
  const db = hubDb.sqlite;

  let seq = 1;
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
    applyEventToProjection(db, full as any);
    return full;
  };

  // Seed DB
  db.prepare(
    `INSERT INTO projects (id, name, repo_path, default_branch, workflow_id, memory_path, created_at, updated_at)
     VALUES ('prj_cs', 'Scope Test', '/tmp/cs', 'main', 'feature', '.ade/memory', datetime('now'), datetime('now'))`
  ).run();
  db.prepare(
    `INSERT INTO channels (id, project_id, name, created_at, updated_at)
     VALUES ('chn_cs', 'prj_cs', 'general', datetime('now'), datetime('now'))`
  ).run();
  db.prepare(
    `INSERT INTO threads (id, channel_id, project_id, root_message_id, title, state, workflow_id, main_agent_id, created_by, engine_halted, budget_usd, spent_usd, created_at, updated_at)
     VALUES ('thr_cs', 'chn_cs', 'prj_cs', 'msg_root', 'Scope Thread', 'planning', 'feature', 'agt_lead', 'usr_local', 0, 100, 0, datetime('now'), datetime('now'))`
  ).run();

  db.prepare(
    `INSERT INTO agents (id, project_id, handle, display_name, role, harness, model, credential_profile, mcp_allow_json, write, can_be_main, enabled, max_depth, timeout_s, source_file, updated_at)
     VALUES
     ('agt_coder', 'prj_cs', '@coder', 'Coder', 'worker', 'claude-code', 'claude-3-5-sonnet', 'sub-claude', '[]', 1, 0, 1, 3, 600, 'coder.yaml', datetime('now')),
     ('agt_tester', 'prj_cs', '@tester', 'Tester', 'worker', 'claude-code', 'claude-3-5-sonnet', 'sub-claude', '[]', 1, 0, 1, 3, 600, 'tester.yaml', datetime('now'))`
  ).run();

  // Tạo messages: 1 root text, 1 technical approval_card, 1 technical explorer_card, 1 human chat
  db.prepare(
    `INSERT INTO messages (id, thread_id, author_type, author_id, kind, body, is_root, mentions_json, human_mentions_json, reactions_json, card_json, created_at, updated_at)
     VALUES
     ('msg_root', 'thr_cs', 'human', 'usr_local', 'text', 'Tin nhắn khởi tạo thread', 1, '[]', '[]', '[]', NULL, '2026-01-01T10:00:00Z', '2026-01-01T10:00:00Z'),
     ('msg_card1', 'thr_cs', 'agent', 'agt_coder', 'approval_card', 'Technical gate payload', 0, '[]', '[]', '[]', '{"status":"pending"}', '2026-01-01T10:01:00Z', '2026-01-01T10:01:00Z'),
     ('msg_card2', 'thr_cs', 'agent', 'agt_coder', 'explorer_card', 'Technical explorer trace', 0, '[]', '[]', '[]', '{"topic":"auth"}', '2026-01-01T10:02:00Z', '2026-01-01T10:02:00Z'),
     ('msg_chat', 'thr_cs', 'human', 'usr_local', 'text', 'Phản hồi từ người dùng', 0, '[]', '[]', '[]', NULL, '2026-01-01T10:03:00Z', '2026-01-01T10:03:00Z')`
  ).run();

  const grantService = new GrantService(db);
  grantService.grantAgent({
    threadId: "thr_cs",
    agentId: "agt_coder",
    role: "worker",
    scope: "full",
    grantedBy: "usr_local",
  });
  grantService.grantAgent({
    threadId: "thr_cs",
    agentId: "agt_tester",
    role: "worker",
    scope: "full",
    grantedBy: "usr_local",
  });

  const mcpServer = new McpServer({
    sqlite: db,
    grantService,
    appendEvent,
  });

  // 1. Kiểm tra get_thread scope: "brief"
  const briefRes = (await mcpServer.handleRpc(
    { run_id: "r1", thread_id: "thr_cs", project_id: "prj_cs", agent_id: "agt_coder", role: "worker", iat: 0, exp: 9999999999 },
    { method: "tools/call", params: { name: "get_thread", arguments: { scope: "brief" } } }
  )) as any;

  const briefData = briefRes.result.structuredContent;
  console.log("Brief messages count:", briefData.messages.length);
  console.log("Brief messages_hidden:", briefData.messages_hidden);

  if (!briefData.messages_hidden) {
    throw new Error("Kỳ vọng scope 'brief' trả về messages_hidden = true");
  }
  // Brief chỉ lấy root hoặc text human (2 messages: msg_root và msg_chat), loại bỏ msg_card1, msg_card2
  if (briefData.messages.length !== 2) {
    throw new Error(`Kỳ vọng scope brief có 2 messages, nhận được ${briefData.messages.length}`);
  }

  // 2. Kiểm tra get_thread scope: "full"
  const fullRes = (await mcpServer.handleRpc(
    { run_id: "r1", thread_id: "thr_cs", project_id: "prj_cs", agent_id: "agt_coder", role: "worker", iat: 0, exp: 9999999999 },
    { method: "tools/call", params: { name: "get_thread", arguments: { scope: "full" } } }
  )) as any;

  const fullData = fullRes.result.structuredContent;
  console.log("Full messages count:", fullData.messages.length);
  if (fullData.messages.length !== 4) {
    throw new Error(`Kỳ vọng scope full có 4 messages, nhận được ${fullData.messages.length}`);
  }

  // 3. Kiểm tra write_scratchpad cho @coder
  await mcpServer.handleRpc(
    { run_id: "r1", thread_id: "thr_cs", project_id: "prj_cs", agent_id: "agt_coder", role: "worker", iat: 0, exp: 9999999999 },
    { method: "tools/call", params: { name: "write_scratchpad", arguments: { content: "Coder secret notes" } } }
  );

  // 4. @coder đọc lại sổ nháp của chính mình
  const readOwn = (await mcpServer.handleRpc(
    { run_id: "r1", thread_id: "thr_cs", project_id: "prj_cs", agent_id: "agt_coder", role: "worker", iat: 0, exp: 9999999999 },
    { method: "tools/call", params: { name: "read_scratchpad", arguments: {} } }
  )) as any;

  if (readOwn.result.structuredContent.content !== "Coder secret notes") {
    throw new Error("Kỳ vọng đọc lại đúng nội dung vừa ghi vào scratchpad");
  }
  console.log("@coder đọc sổ nháp của mình: OK");

  // 5. @tester cố tình đọc sổ nháp của @coder -> Phải bị chặn 403 ERR_SCRATCHPAD_ISOLATED!
  let isolationEnforced = false;
  try {
    await mcpServer.handleRpc(
      { run_id: "r2", thread_id: "thr_cs", project_id: "prj_cs", agent_id: "agt_tester", role: "worker", iat: 0, exp: 9999999999 },
      { method: "tools/call", params: { name: "read_scratchpad", arguments: { agent_id: "agt_coder" } } }
    );
  } catch (err: any) {
    if (err.code === "ERR_SCRATCHPAD_ISOLATED") {
      isolationEnforced = true;
    }
  }

  if (!isolationEnforced) {
    throw new Error("Kỳ vọng chặn truy cập sổ nháp của agent khác với mã ERR_SCRATCHPAD_ISOLATED!");
  }
  console.log("Cô lập sổ nháp giữa các agent: OK");

  console.log("[PASS] Context scope and scratchpad isolation verified.");
}

main().catch((err) => {
  console.error("FAIL scripts/verify/context-scope.ts:", err);
  process.exit(1);
});
