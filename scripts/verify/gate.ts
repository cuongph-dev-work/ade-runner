import { openHubDatabase } from "../../apps/hub/src/db/client.js";
import { applyEventToProjection } from "../../apps/hub/src/db/projector.js";
import { GateService } from "../../apps/hub/src/orchestration/gate-service.js";
import { McpServer } from "../../apps/hub/src/mcp/mcp-server.js";
import { GrantService } from "../../apps/hub/src/trigger/grant-service.js";

async function main() {
  console.log("=== BẮT ĐẦU KIỂM CHỨNG: scripts/verify/gate.ts ===");
  const hubDb = openHubDatabase(":memory:");
  const db = hubDb.sqlite;

  let seq = 1;
  const eventsList: any[] = [];
  let agentWakePrompt: string | null = null;

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

  // Seed DB
  db.prepare(
    `INSERT INTO projects (id, name, repo_path, default_branch, workflow_id, memory_path, created_at, updated_at)
     VALUES ('prj_gate', 'Gate Test', '/tmp/gate', 'main', 'feature', '.ade/memory', datetime('now'), datetime('now'))`
  ).run();
  db.prepare(
    `INSERT INTO channels (id, project_id, name, created_at, updated_at)
     VALUES ('chn_gate', 'prj_gate', 'general', datetime('now'), datetime('now'))`
  ).run();
  db.prepare(
    `INSERT INTO threads (id, channel_id, project_id, root_message_id, title, state, workflow_id, main_agent_id, created_by, engine_halted, budget_usd, spent_usd, created_at, updated_at)
     VALUES ('thr_gate', 'chn_gate', 'prj_gate', 'msg_root', 'Thread Gate Test', 'planning', 'feature', 'agt_lead', 'usr_local', 0, 100, 0, datetime('now'), datetime('now'))`
  ).run();

  db.prepare(
    `INSERT INTO agents (id, project_id, handle, display_name, role, harness, model, credential_profile, mcp_allow_json, write, can_be_main, enabled, max_depth, timeout_s, source_file, updated_at)
     VALUES
     ('agt_lead', 'prj_gate', '@lead', 'Tech Lead', 'main', 'claude-code', 'claude-3-5-sonnet', 'sub-claude', '[]', 0, 1, 1, 3, 600, 'lead.yaml', datetime('now')),
     ('agt_worker', 'prj_gate', '@worker', 'Worker', 'worker', 'claude-code', 'claude-3-5-sonnet', 'sub-claude', '[]', 1, 0, 1, 3, 600, 'worker.yaml', datetime('now'))`
  ).run();

  const grantService = new GrantService(db);
  grantService.grantAgent({
    threadId: "thr_gate",
    agentId: "agt_lead",
    role: "main",
    scope: "full",
    grantedBy: "usr_local",
  });

  const gateService = new GateService({
    sqlite: db,
    appendEvent,
    wakeAgent: (p) => {
      agentWakePrompt = p.prompt;
    },
  });

  const mcpServer = new McpServer({
    sqlite: db,
    grantService,
    gateService,
    appendEvent,
  });

  // 1. Tạo Cổng duyệt Plan v1 qua gateService
  const appr1 = gateService.createApproval({
    threadId: "thr_gate",
    runId: "run_lead_01",
    gate: "plan",
    summary: "Kế hoạch v1 cần duyệt",
    targetState: "spec_review",
    requestedByAgentId: "agt_lead",
  });
  console.log("Created approval 1:", appr1);
  if (appr1.version !== 1 || appr1.status !== "pending") {
    throw new Error("Kỳ vọng approval v1 pending");
  }

  // 2. Kiểm tra chặn đổi state khi đang có pending approval
  let stateChangeBlocked = false;
  try {
    await mcpServer.handleRpc(
      {
        run_id: "run_lead_01",
        thread_id: "thr_gate",
        project_id: "prj_gate",
        agent_id: "agt_lead",
        role: "main",
        iat: 0,
        exp: 9999999999,
      },
      {
        method: "tools/call",
        params: {
          name: "set_state",
          arguments: { to: "spec_review", reason: "Tự ý đổi state" },
        },
      }
    );
  } catch (err: any) {
    if (err.code === "ERR_APPROVAL_REQUIRED") {
      stateChangeBlocked = true;
    }
  }

  if (!stateChangeBlocked) {
    throw new Error("Kỳ vọng MCP set_state bị chặn với mã ERR_APPROVAL_REQUIRED khi approval pending!");
  }
  console.log("Chặn set_state khi approval pending: OK");

  // 3. Người dùng yêu cầu sửa qua slash command: /revise Cần bổ sung kiến trúc
  const revised = await gateService.handleSlashCommand("thr_gate", "usr_local", "/revise Cần bổ sung sơ đồ kiến trúc");
  if (!revised) throw new Error("handleSlashCommand /revise thất bại");

  const row1 = db.prepare("SELECT status, feedback FROM approvals WHERE id = ?").get(appr1.approval_id) as any;
  if (row1.status !== "changes_requested" || !row1.feedback.includes("sơ đồ kiến trúc")) {
    throw new Error(`Kỳ vọng approval 1 status 'changes_requested', nhận được '${row1.status}'`);
  }
  if (!agentWakePrompt || !agentWakePrompt.includes("sơ đồ kiến trúc")) {
    throw new Error("Kỳ vọng Main Agent được đánh thức kèm phản hồi yêu cầu sửa");
  }
  console.log("Slash command /revise -> changes_requested & wake agent: OK");

  // 4. Main Agent trình lại Cổng duyệt Plan v2
  const appr2 = gateService.createApproval({
    threadId: "thr_gate",
    runId: "run_lead_02",
    gate: "plan",
    summary: "Kế hoạch v2 đã có sơ đồ kiến trúc",
    targetState: "spec_review",
    requestedByAgentId: "agt_lead",
  });
  console.log("Created approval 2:", appr2);
  if (appr2.version !== 2 || appr2.status !== "pending") {
    throw new Error(`Kỳ vọng approval 2 version 2 pending, nhận được version ${appr2.version}`);
  }

  // 5. Người dùng phê duyệt qua slash command: /approve
  const approved = await gateService.handleSlashCommand("thr_gate", "usr_local", "/approve");
  if (!approved) throw new Error("handleSlashCommand /approve thất bại");

  const row2 = db.prepare("SELECT status FROM approvals WHERE id = ?").get(appr2.approval_id) as any;
  if (row2.status !== "approved") {
    throw new Error(`Kỳ vọng approval 2 status 'approved', nhận được '${row2.status}'`);
  }

  const threadRow = db.prepare("SELECT state FROM threads WHERE id = 'thr_gate'").get() as any;
  if (threadRow.state !== "spec_review") {
    throw new Error(`Kỳ vọng thread state chuyển sang 'spec_review', nhận được '${threadRow.state}'`);
  }
  console.log("Slash command /approve -> approved & thread state changed to spec_review: OK");

  // 6. Đổi Main Agent qua slash command: /main @lead
  const mainChanged = await gateService.handleSlashCommand("thr_gate", "usr_local", "/main @lead");
  if (!mainChanged) throw new Error("handleSlashCommand /main thất bại");

  const mainChangedEvt = eventsList.find((e) => e.type === "main.changed");
  if (!mainChangedEvt) {
    throw new Error("Kỳ vọng event 'main.changed' được phát ra khi gõ /main @lead");
  }
  console.log("Slash command /main @handle: OK");

  console.log("[PASS] Workflow gates verified: chặn khi pending, tăng version v1 -> v2, xử lý /revise và /approve chính xác.");
}

main().catch((err) => {
  console.error("FAIL scripts/verify/gate.ts:", err);
  process.exit(1);
});
