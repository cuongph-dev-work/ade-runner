import { openHubDatabase } from "../../apps/hub/src/db/client.js";
import { applyEventToProjection } from "../../apps/hub/src/db/projector.js";
import { GrantService } from "../../apps/hub/src/trigger/grant-service.js";
import { McpTokenService } from "../../apps/hub/src/mcp/mcp-token-service.js";
import { McpServer } from "../../apps/hub/src/mcp/mcp-server.js";

async function main() {
  console.log("=== BẮT ĐẦU KIỂM CHỨNG: scripts/verify/mcp-contract.ts ===");
  const hubDb = openHubDatabase(":memory:");
  const db = hubDb.sqlite;

  let seq = 1;
  const eventsList: any[] = [];
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
    return full;
  };

  // Setup seed data
  db.prepare(
    `INSERT INTO projects (id, name, repo_path, default_branch, workflow_id, memory_path, created_at, updated_at)
     VALUES ('prj_mcp', 'MCP Test', '/tmp/mcp', 'main', 'feature', '.ade/memory', datetime('now'), datetime('now'))`
  ).run();
  db.prepare(
    `INSERT INTO channels (id, project_id, name, created_at, updated_at)
     VALUES ('chn_mcp', 'prj_mcp', 'general', datetime('now'), datetime('now'))`
  ).run();
  db.prepare(
    `INSERT INTO agents (id, project_id, handle, display_name, role, harness, model, credential_profile, source_file, updated_at)
     VALUES ('agt_lead', 'prj_mcp', '@lead', 'Lead Planner', 'planner', 'claude', 'sonnet', 'default', 'agents/lead.yaml', datetime('now'))`
  ).run();
  db.prepare(
    `INSERT INTO threads (id, channel_id, project_id, root_message_id, title, state, workflow_id, created_by, engine_halted, created_at, updated_at)
     VALUES ('thr_mcp', 'chn_mcp', 'prj_mcp', 'msg_01', 'Thread MCP', 'planning', 'feature', 'usr_local', 0, datetime('now'), datetime('now'))`
  ).run();
  db.prepare(
    `INSERT INTO messages (id, thread_id, author_type, author_id, kind, body, is_root, created_at, updated_at)
     VALUES ('msg_01', 'thr_mcp', 'user', 'usr_local', 'text', 'Xin chào team', 1, datetime('now'), datetime('now'))`
  ).run();

  const grantService = new GrantService(db);
  const tokenService = new McpTokenService();
  const mcpServer = new McpServer({
    sqlite: db,
    grantService,
    appendEvent,
  });

  const agentId = "agt_lead";
  const threadId = "thr_mcp";
  const token = tokenService.issueToken({
    agentId,
    threadId,
    projectId: "prj_mcp",
    runId: "run_mcp_01",
  });

  const claims = tokenService.verifyToken(`Bearer ${token}`, () => ({
    status: "running",
    thread_id: threadId,
    project_id: "prj_mcp",
    agent_id: agentId,
  }));

  async function callTool(name: string, args: Record<string, unknown>) {
    try {
      const res = await mcpServer.handleRpc(claims, {
        method: "tools/call",
        params: { name, arguments: args },
      });
      return { status: 200, data: (res.result as any)?.structuredContent };
    } catch (err: any) {
      return { status: err.httpStatus ?? 500, data: { code: err.code, message: err.message } };
    }
  }

  // Test 1: get_thread khi chưa có grant -> 403 ERR_PERMISSION_DENIED
  console.log("[1] Kiểm tra get_thread khi chưa được mention (thiếu grant)");
  const res1 = await callTool("get_thread", {});
  if (res1.status !== 403 || res1.data?.code !== "ERR_PERMISSION_DENIED") {
    console.error(`FAIL: Mong đợi 403 ERR_PERMISSION_DENIED, nhận được:`, res1);
    process.exit(1);
  }
  console.log("PASS: Chặn 403 thành công khi thiếu grant");

  // Test 2: Cấp grant qua mention và gọi lại get_thread -> 200
  console.log("[2] Cấp grant cho agent và gọi lại get_thread");
  grantService.grantAgent({
    threadId,
    agentId,
    grantedBy: "mention",
  });

  const res2 = await callTool("get_thread", {});
  if (res2.status !== 200 || !Array.isArray(res2.data?.messages)) {
    console.error(`FAIL: Mong đợi 200 với danh sách messages, nhận được:`, res2);
    process.exit(1);
  }
  console.log(`PASS: get_thread thành công (đọc được ${res2.data.messages.length} messages)`);

  // Test 3: Agent gọi set_state qua MCP -> Phải bị chặn 403 (Quy tắc số 4)
  console.log("[3] Kiểm tra agent gọi set_state qua MCP (Quy tắc kiến trúc số 4)");
  const res3 = await callTool("set_state", { state: "building" });
  if (res3.status !== 403 || res3.data?.code !== "ERR_SET_STATE_FORBIDDEN") {
    console.error(`FAIL: Mong đợi 403 ERR_SET_STATE_FORBIDDEN, nhận được:`, res3);
    process.exit(1);
  }
  console.log("PASS: Chặn thành công hành vi tự đổi state của agent qua MCP");

  // Test 4: Agent báo kết quả qua report_outcome -> 200
  console.log("[4] Agent gửi report_outcome");
  const res4 = await callTool("report_outcome", {
    status: "done",
    summary: "Đã xong việc",
  });
  if (res4.status !== 200 || !res4.data?.ok) {
    console.error(`FAIL: report_outcome thất bại:`, res4);
    process.exit(1);
  }
  console.log("PASS: report_outcome thành công");

  console.log("=== KẾT QUẢ: TOÀN BỘ KIỂM CHỨNG HỢP ĐỒNG MCP ĐÃ PASS ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL ERROR in mcp-contract verify script:", err);
  process.exit(1);
});
