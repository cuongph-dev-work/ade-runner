import { openHubDatabase } from "../apps/hub/src/db/client.js";

const dbPath = "/Users/cuongph/Workspace/ade-runner/.ade-data/ade.db";
const hubDb = openHubDatabase(dbPath);

const project = hubDb.sqlite.prepare("SELECT id FROM projects LIMIT 1").get() as { id: string };
const leadAgent = hubDb.sqlite.prepare("SELECT id FROM agents WHERE handle = '@lead'").get() as { id: string } | undefined;
const explorerAgent = hubDb.sqlite.prepare("SELECT id FROM agents WHERE handle = '@explorer'").get() as { id: string } | undefined;
const plannerAgent = hubDb.sqlite.prepare("SELECT id FROM agents WHERE handle = '@planner'").get() as { id: string } | undefined;
const coderAgent = hubDb.sqlite.prepare("SELECT id FROM agents WHERE handle = '@coder'").get() as { id: string } | undefined;

// Ensure chn_auth_feat channel exists and has correct description
hubDb.sqlite.prepare(`
  INSERT INTO channels (id, project_id, name, description, created_at, updated_at)
  VALUES ('chn_auth_feat', ?, 'auth-feature', 'Xác thực MCP, cô lập worktree và phân quyền đọc theo mention', '2026-11-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z')
  ON CONFLICT(id) DO UPDATE SET
    description = 'Xác thực MCP, cô lập worktree và phân quyền đọc theo mention'
`).run(project.id);

// Add 6 channel members
const members = [
  { type: "human", id: "usr_local" },
  { type: "human", id: "usr_minh" },
  { type: "human", id: "usr_lan" },
  { type: "agent", id: leadAgent?.id ?? "agt_lead" },
  { type: "agent", id: explorerAgent?.id ?? "agt_explorer" },
  { type: "agent", id: coderAgent?.id ?? "agt_coder" }
];

for (const m of members) {
  hubDb.sqlite.prepare(`
    INSERT OR IGNORE INTO channel_members (channel_id, member_type, member_id, added_at)
    VALUES ('chn_auth_feat', ?, ?, '2026-11-01T00:00:00.000Z')
  `).run(m.type, m.id);
}

// Clean old demo threads in chn_auth_feat if any
hubDb.sqlite.prepare("DELETE FROM messages WHERE thread_id IN ('thr_auth_01', 'thr_auth_02', 'thr_auth_03', 'thr_auth_04')").run();
hubDb.sqlite.prepare("DELETE FROM threads WHERE id IN ('thr_auth_01', 'thr_auth_02', 'thr_auth_03', 'thr_auth_04')").run();

// THREAD 1: Minh Tran asks Cuong PH about tokens (Figma 16:40)
hubDb.sqlite.prepare(`
  INSERT INTO threads (id, project_id, channel_id, root_message_id, title, state, workflow_id, main_agent_id, summary, budget_usd, spent_usd, engine_halted, created_by, created_at, updated_at)
  VALUES ('thr_auth_01', ?, 'chn_auth_feat', 'msg_auth_01', 'Khóa token Sáng 03 Coral và Tối 01 Console', 'open', 'feature', NULL, 'Trao đổi về token css', NULL, 0, 0, 'usr_minh', '2026-11-01T09:40:00.000Z', '2026-11-01T09:42:00.000Z')
`).run(project.id);

hubDb.sqlite.prepare(`
  INSERT INTO messages (id, thread_id, author_type, author_id, is_root, kind, body, mentions_json, human_mentions_json, reactions_json, card_json, run_id, created_at, updated_at)
  VALUES ('msg_auth_01', 'thr_auth_01', 'human', 'usr_minh', 1, 'text', 'Anh @cuong ơi, cặp token Sáng 03 Coral với Tối 01 Console mình khóa chung vào tokens.css cho toàn bộ các view luôn đúng không ạ?', '[]', '["@cuong"]', '[]', NULL, NULL, '2026-11-01T09:40:00.000Z', '2026-11-01T09:40:00.000Z')
`).run();

// 2 replies in thread 1 (Figma 16:41 - 16:42)
hubDb.sqlite.prepare(`
  INSERT INTO messages (id, thread_id, author_type, author_id, is_root, kind, body, mentions_json, human_mentions_json, reactions_json, card_json, run_id, created_at, updated_at)
  VALUES ('msg_auth_01_r1', 'thr_auth_01', 'human', 'usr_local', 0, 'text', 'Đúng rồi em, tokens.css là source of truth chung cho cả theme Light Coral và Dark Console nhé!', '[]', '["@minh"]', '[]', NULL, NULL, '2026-11-01T09:41:00.000Z', '2026-11-01T09:41:00.000Z'),
         ('msg_auth_01_r2', 'thr_auth_01', 'human', 'usr_minh', 0, 'text', 'Dạ vâng anh, em khóa luôn vào base components ạ.', '[]', '[]', '[]', NULL, NULL, '2026-11-01T09:42:00.000Z', '2026-11-01T09:42:00.000Z')
`).run();

// THREAD 2: Minh Tran asks @explorer (Figma 16:52)
hubDb.sqlite.prepare(`
  INSERT INTO threads (id, project_id, channel_id, root_message_id, title, state, workflow_id, main_agent_id, summary, budget_usd, spent_usd, engine_halted, created_by, created_at, updated_at)
  VALUES ('thr_auth_02', ?, 'chn_auth_feat', 'msg_auth_02', 'Kiểm tra logic verifyMcpGrant & causation loop', 'open', 'feature', ?, 'Chỉ đọc · 0 file sửa · Đã xong', NULL, 0, 0, 'usr_minh', '2026-11-01T09:52:00.000Z', '2026-11-01T09:55:00.000Z')
`).run(project.id, explorerAgent?.id ?? null);

hubDb.sqlite.prepare(`
  INSERT INTO messages (id, thread_id, author_type, author_id, is_root, kind, body, mentions_json, human_mentions_json, reactions_json, card_json, run_id, created_at, updated_at)
  VALUES ('msg_auth_02', 'thr_auth_02', 'human', 'usr_minh', 1, 'text', 'Nhờ @explorer tìm giúp trong project logic kiểm tra quyền đọc theo mention (verifyMcpGrant) và giải thích lại cơ chế chặn vòng lặp 20 bước nhân quả (causation_id) đang nằm ở đâu nhé?', '["@explorer"]', '[]', '[]', NULL, NULL, '2026-11-01T09:52:00.000Z', '2026-11-01T09:52:00.000Z')
`).run();

hubDb.sqlite.prepare(`
  INSERT INTO messages (id, thread_id, author_type, author_id, is_root, kind, body, mentions_json, human_mentions_json, reactions_json, card_json, run_id, created_at, updated_at)
  VALUES ('msg_auth_02_r1', 'thr_auth_02', 'agent', ?, 0, 'explorer_card', 'Tôi đã tra cứu mã nguồn và phân tích chi tiết luồng xử lý:', '[]', '[]', '[]', '{"citations":["apps/hub/src/trigger/grant-service.ts","apps/hub/src/trigger/rule-engine.ts"]}', NULL, '2026-11-01T09:55:00.000Z', '2026-11-01T09:55:00.000Z')
`).run(explorerAgent?.id ?? "agt_explorer");

// THREAD 3: Cuong PH asks @planner & @spec (Figma 17:02)
hubDb.sqlite.prepare(`
  INSERT INTO threads (id, project_id, channel_id, root_message_id, title, state, workflow_id, main_agent_id, summary, budget_usd, spent_usd, engine_halted, created_by, created_at, updated_at)
  VALUES ('thr_auth_03', ?, 'chn_auth_feat', 'msg_auth_03', 'Thiết kế cơ chế nhắc tự động khi cổng duyệt bị treo', 'open', 'feature', ?, '3 câu hỏi chờ trả lời', NULL, 0, 0, 'usr_local', '2026-11-01T10:02:00.000Z', '2026-11-01T10:05:00.000Z')
`).run(project.id, plannerAgent?.id ?? null);

hubDb.sqlite.prepare(`
  INSERT INTO messages (id, thread_id, author_type, author_id, is_root, kind, body, mentions_json, human_mentions_json, reactions_json, card_json, run_id, created_at, updated_at)
  VALUES ('msg_auth_03', 'thr_auth_03', 'human', 'usr_local', 1, 'text', 'Nhờ @planner cùng @spec lên thiết kế cho cơ chế nhắc tự động khi cổng duyệt bị treo quá hạn và dọn phiên chạy mất kết nối trong kênh nhé.', '["@planner", "@spec"]', '[]', '[]', NULL, NULL, '2026-11-01T10:02:00.000Z', '2026-11-01T10:02:00.000Z')
`).run();

for (let i = 1; i <= 3; i++) {
  hubDb.sqlite.prepare(`
    INSERT INTO messages (id, thread_id, author_type, author_id, is_root, kind, body, mentions_json, human_mentions_json, reactions_json, card_json, run_id, created_at, updated_at)
    VALUES ('msg_auth_03_r${i}', 'thr_auth_03', 'agent', ?, 0, 'question_card', 'Câu hỏi ${i}', '[]', '[]', '[]', '{"status":"pending","question":"Cần cấu hình timeout bao lâu trước khi kích hoạt cảnh báo?","options":["5 phút","15 phút","1 giờ"]}', NULL, '2026-11-01T10:05:00.000Z', '2026-11-01T10:05:00.000Z')
  `).run(plannerAgent?.id ?? "agt_planner");
}

// THREAD 4: Cuong PH calls @minh @lan-anh @lead @coder @tester (Figma 17:10)
hubDb.sqlite.prepare(`
  INSERT INTO threads (id, project_id, channel_id, root_message_id, title, state, workflow_id, main_agent_id, summary, budget_usd, spent_usd, engine_halted, created_by, created_at, updated_at)
  VALUES ('thr_auth_04', ?, 'chn_auth_feat', 'msg_auth_04', 'Triển khai cổng kiểm quyền đọc theo mention trên ADE MCP', 'planning', 'feature', ?, 'Cổng duyệt plan đang chờ duyệt', 5.0, 0.90, 0, 'usr_local', '2026-11-01T10:10:00.000Z', '2026-11-01T10:15:00.000Z')
`).run(project.id, leadAgent?.id ?? null);

hubDb.sqlite.prepare(`
  INSERT INTO messages (id, thread_id, author_type, author_id, is_root, kind, body, mentions_json, human_mentions_json, reactions_json, card_json, run_id, created_at, updated_at)
  VALUES ('msg_auth_04', 'thr_auth_04', 'human', 'usr_local', 1, 'text', 'Anh em @minh @lan-anh ơi, mình triển khai cổng kiểm quyền đọc theo mention trên ADE MCP nhé. Nhờ @lead lên phương án rồi kéo @coder với @tester làm song song luôn!', '["@minh", "@lan-anh", "@lead", "@coder", "@tester"]', '["@minh", "@lan-anh"]', '[]', NULL, NULL, '2026-11-01T10:10:00.000Z', '2026-11-01T10:10:00.000Z')
`).run();

hubDb.sqlite.prepare(`
  INSERT INTO messages (id, thread_id, author_type, author_id, is_root, kind, body, mentions_json, human_mentions_json, reactions_json, card_json, run_id, created_at, updated_at)
  VALUES ('msg_auth_04_r1', 'thr_auth_04', 'agent', ?, 0, 'approval_card', 'Đã soạn thảo phương án phân chia 3 module độc lập. Mời anh Cuong duyệt Cổng Kế hoạch.', '[]', '[]', '[]', '{"gate":{"gate_type":"plan","status":"pending"}}', NULL, '2026-11-01T10:15:00.000Z', '2026-11-01T10:15:00.000Z')
`).run(leadAgent?.id ?? "agt_lead");

console.log("Figma demo threads seeded into chn_auth_feat successfully!");
hubDb.close();
