import { openHubDatabase } from "../apps/hub/src/db/client.js";

const ulid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

const dbPath = "/Users/cuongph/Workspace/ade-runner/.ade-data/ade.db";
const hubDb = openHubDatabase(dbPath);

const project = hubDb.sqlite.prepare("SELECT id FROM projects LIMIT 1").get() as { id: string };
const channel = hubDb.sqlite.prepare("SELECT id FROM channels WHERE project_id = ? LIMIT 1").get(project.id) as { id: string };

const leadAgent = hubDb.sqlite.prepare("SELECT id FROM agents WHERE handle = '@lead'").get() as { id: string };
const explorerAgent = hubDb.sqlite.prepare("SELECT id FROM agents WHERE handle = '@explorer'").get() as { id: string };
const coderAgent = hubDb.sqlite.prepare("SELECT id FROM agents WHERE handle = '@coder'").get() as { id: string };

const now = new Date().toISOString();

// THREAD 1: Main Work Thread with Plan Approval Gate & Permission Card
const thr1Id = "thr_01";
const rootMsg1Id = "msg_root_01";
hubDb.appendAndProject([
  {
    id: `evt_${ulid()}`,
    type: "thread.created",
    ts: now,
    project_id: project.id,
    thread_id: thr1Id,
    run_id: null,
    actor: { type: "human", id: "usr_local" },
    causation_id: null,
    correlation_id: thr1Id,
    payload: {
      thread_id: thr1Id,
      project_id: project.id,
      channel_id: channel.id,
      root_message_id: rootMsg1Id,
      title: "Triển khai xác thực JWT & MCP Permission",
      state: "planning",
      workflow_id: "feature",
      main_agent_id: leadAgent?.id ?? null,
      summary: "@lead: Đang soạn thảo plan v2 và chờ duyệt cổng",
      body: "Triển khai xác thực JWT và phân quyền ADE MCP nhé. Nhờ @lead lên phương án điều phối rồi kéo @coder với @tester làm song song luôn!",
      mentions: ["@lead", "@coder", "@tester"],
      human_mentions: ["@owner"]
    }
  },
  {
    id: `evt_${ulid()}`,
    type: "message.posted",
    ts: now,
    project_id: project.id,
    thread_id: thr1Id,
    run_id: null,
    actor: { type: "human", id: "usr_local" },
    causation_id: null,
    correlation_id: thr1Id,
    payload: {
      message_id: rootMsg1Id,
      kind: "text",
      body: "Triển khai xác thực JWT và phân quyền ADE MCP nhé. Nhờ @lead lên phương án điều phối rồi kéo @coder với @tester làm song song luôn!",
      is_root: true,
      mentions: ["@lead", "@coder", "@tester"],
      human_mentions: ["@owner"],
      card: null
    }
  },
  {
    id: `evt_${ulid()}`,
    type: "message.posted",
    ts: now,
    project_id: project.id,
    thread_id: thr1Id,
    run_id: null,
    actor: { type: "agent", id: leadAgent?.id ?? "agt_lead" },
    causation_id: null,
    correlation_id: thr1Id,
    payload: {
      message_id: "msg_gate_01",
      thread_id: thr1Id,
      is_root: false,
      kind: "approval_card",
      body: "Tôi đã lập kế hoạch phân rã 3 bước và xin mở Cổng duyệt Kế hoạch (Plan Gate v2):",
      mentions: ["@lead"],
      human_mentions: [],
      card: {
        kind: "approval_gate",
        gate_id: "gate_plan_01",
        gate_type: "plan",
        title: "Cổng duyệt Kế hoạch: JWT Authentication & MCP Permissions",
        description: "Phê duyệt kế hoạch chia tách 3 task độc lập: contracts -> backend -> runner",
        status: "pending",
        reviewer_checklist: [
          { id: "c1", label: "Kiểm tra token không rời máy dev", checked: true },
          { id: "c2", label: "Worktree độc lập theo từng task", checked: true },
          { id: "c3", label: "Bộ test E2E mô phỏng đầy đủ", checked: false }
        ],
        plan_summary: "Task 1: Zod schema @packages/shared\nTask 2: Fastify auth plugin\nTask 3: MCP grant check",
        diff_preview: "+++ packages/shared/src/schemas/auth.ts\n+ export const JwtTokenSchema = z.string();"
      }
    }
  },
  {
    id: `evt_${ulid()}`,
    type: "message.posted",
    ts: now,
    project_id: project.id,
    thread_id: thr1Id,
    run_id: "run_coder_01",
    actor: { type: "agent", id: coderAgent?.id ?? "agt_coder" },
    causation_id: null,
    correlation_id: thr1Id,
    payload: {
      message_id: "msg_perm_01",
      thread_id: thr1Id,
      is_root: false,
      kind: "live_card",
      body: "@coder xin quyền thực thi lệnh cài đặt thư viện vào worktree:",
      mentions: ["@coder"],
      human_mentions: [],
      card: {
        kind: "permission_request",
        request_id: "perm_req_01",
        run_id: "run_coder_01",
        command: "pnpm add jsonwebtoken @types/jsonwebtoken",
        status: "pending",
        timeout_ms: 300000
      }
    }
  }
]);

// THREAD 2: Explorer & Clarifier
const thr2Id = "thr_clarify_01";
const rootMsg2Id = "msg_root_02";
hubDb.appendAndProject([
  {
    id: `evt_${ulid()}`,
    type: "thread.created",
    ts: now,
    project_id: project.id,
    thread_id: thr2Id,
    run_id: null,
    actor: { type: "human", id: "usr_local" },
    causation_id: null,
    correlation_id: thr2Id,
    payload: {
      thread_id: thr2Id,
      project_id: project.id,
      channel_id: channel.id,
      root_message_id: rootMsg2Id,
      title: "Giải thích luồng kiểm quyền đọc MCP và chỗ chặn vòng lặp 20 bước",
      state: "open",
      workflow_id: "feature",
      main_agent_id: explorerAgent?.id ?? null,
      summary: "@explorer: Đã phân tích 3 tệp mã nguồn và trích xuất luồng kiểm quyền",
      body: "@explorer giải thích giúp mình luồng kiểm quyền MCP và chỗ chặn vòng lặp 20 bước trong rule engine với nhé!",
      mentions: ["@explorer"],
      human_mentions: ["@owner"]
    }
  },
  {
    id: `evt_${ulid()}`,
    type: "message.posted",
    ts: now,
    project_id: project.id,
    thread_id: thr2Id,
    run_id: null,
    actor: { type: "human", id: "usr_local" },
    causation_id: null,
    correlation_id: thr2Id,
    payload: {
      message_id: rootMsg2Id,
      kind: "text",
      body: "@explorer giải thích giúp mình luồng kiểm quyền MCP và chỗ chặn vòng lặp 20 bước trong rule engine với nhé!",
      is_root: true,
      mentions: ["@explorer"],
      human_mentions: ["@owner"],
      card: null
    }
  },
  {
    id: `evt_${ulid()}`,
    type: "message.posted",
    ts: now,
    project_id: project.id,
    thread_id: thr2Id,
    run_id: null,
    actor: { type: "agent", id: explorerAgent?.id ?? "agt_explorer" },
    causation_id: null,
    correlation_id: thr2Id,
    payload: {
      message_id: "msg_expl_01",
      thread_id: thr2Id,
      is_root: false,
      kind: "explorer_card",
      body: "Tôi đã tra cứu mã nguồn và phân tích chi tiết luồng xử lý:",
      mentions: ["@explorer"],
      human_mentions: [],
      card: {
        kind: "explorer_insight",
        query: "luồng kiểm quyền đọc MCP và chỗ chặn vòng lặp 20 bước",
        summary: "Luồng kiểm tra quyền diễn ra tại McpServer.checkGrant() trước mỗi lệnh đọc, và RuleEngine đếm bước lặp tối đa 20 trước khi ngắt engine_halted.",
        read_only_badge: "Chỉ đọc · 0 tệp sửa đổi",
        files_inspected: ["apps/hub/src/mcp/mcp-server.ts", "apps/hub/src/trigger/rule-engine.ts", "apps/hub/src/trigger/grant-service.ts"],
        flow_steps: [
          { step: 1, title: "Kiểm tra Mention Grant", desc: "Agent chỉ có thể đọc thread sau khi được @mention trong thread đó." },
          { step: 2, title: "Xác thực Session Token", desc: "Runner cung cấp bearer token tương ứng với session hiện hành." },
          { step: 3, title: "Chặn lặp vô tận (Loop Guard)", desc: "Mỗi chu kỳ phản ứng của RuleEngine tăng biến transition_count; chạm mốc 20 sẽ phát event thread.engine_halted." }
        ],
        citations: [
          { file: "apps/hub/src/trigger/rule-engine.ts", lines: "L85-L102", snippet: "if (thread.transitionCount >= 20) { this.haltEngine(thread.id); }" },
          { file: "apps/hub/src/mcp/mcp-server.ts", lines: "L140-L165", snippet: "const hasGrant = this.grantService.hasReadGrant(agentId, threadId);" }
        ]
      }
    }
  },
  {
    id: `evt_${ulid()}`,
    type: "message.posted",
    ts: now,
    project_id: project.id,
    thread_id: thr2Id,
    run_id: null,
    actor: { type: "agent", id: leadAgent?.id ?? "agt_lead" },
    causation_id: null,
    correlation_id: thr2Id,
    payload: {
      message_id: "msg_q_01",
      thread_id: thr2Id,
      is_root: false,
      kind: "question_card",
      body: "@owner vui lòng giải đáp 2 câu hỏi kỹ thuật để tôi chốt đặc tả luồng kiểm quyền:",
      mentions: ["@lead"],
      human_mentions: ["@owner"],
      card: {
        kind: "question_card",
        question_id: "q_auth_scope_01",
        thread_id: thr2Id,
        author: "@lead",
        prompt: "Làm rõ phạm vi quyền MCP và chính sách xử lý khi Rule Engine ngắt do quá 20 bước:",
        questions: [
          {
            id: "opt_mode",
            type: "single_choice",
            label: "Khi vượt 20 bước, trạng thái thread nên chuyển về đâu?",
            options: [
              { id: "o1", text: "Chuyển về trạng thái plan_review để người duyệt can thiệp (Khuyến nghị)" },
              { id: "o2", text: "Dừng hẳn thread và báo lỗi đỏ cho người dùng" }
            ],
            default_value: "o1"
          },
          {
            id: "opt_scope",
            type: "multi_choice",
            label: "Những công cụ MCP nào cần áp dụng kiểm quyền grant?",
            options: [
              { id: "s1", text: "read_thread_messages (Đọc lịch sử tin nhắn)" },
              { id: "s2", text: "read_memory (Đọc sổ tay dự án)" },
              { id: "s3", text: "report_outcome (Báo cáo kết quả run)" }
            ],
            default_value: ["s1", "s2"]
          },
          {
            id: "opt_note",
            type: "free_text",
            label: "Ghi chú bổ sung cho nhóm phát triển (tùy chọn):",
            placeholder: "Nhập yêu cầu đặc thù nếu có...",
            default_value: ""
          }
        ]
      }
    }
  }
]);

// THREAD 3: Memory Proposal Thread
const thr3Id = "thr_mem_01";
const rootMsg3Id = "msg_root_03";
hubDb.appendAndProject([
  {
    id: `evt_${ulid()}`,
    type: "thread.created",
    ts: now,
    project_id: project.id,
    thread_id: thr3Id,
    run_id: null,
    actor: { type: "human", id: "usr_local" },
    causation_id: null,
    correlation_id: thr3Id,
    payload: {
      thread_id: thr3Id,
      project_id: project.id,
      channel_id: channel.id,
      root_message_id: rootMsg3Id,
      title: "Cập nhật kiến trúc Memory và Sổ tay quyết định",
      state: "open",
      workflow_id: "feature",
      main_agent_id: leadAgent?.id ?? null,
      summary: "@lead: Đề xuất lưu quyết định thiết kế vào .ade/memory/decisions.md",
      body: "Đã thống nhất kiến trúc phân tầng event-sourcing và bộ nhớ dự án, nhờ @lead ghi chép vào sổ tay nhé.",
      mentions: ["@lead"],
      human_mentions: ["@owner"]
    }
  },
  {
    id: `evt_${ulid()}`,
    type: "message.posted",
    ts: now,
    project_id: project.id,
    thread_id: thr3Id,
    run_id: null,
    actor: { type: "human", id: "usr_local" },
    causation_id: null,
    correlation_id: thr3Id,
    payload: {
      message_id: rootMsg3Id,
      kind: "text",
      body: "Đã thống nhất kiến trúc phân tầng event-sourcing và bộ nhớ dự án, nhờ @lead ghi chép vào sổ tay nhé.",
      is_root: true,
      mentions: ["@lead"],
      human_mentions: ["@owner"],
      card: null
    }
  },
  {
    id: `evt_${ulid()}`,
    type: "message.posted",
    ts: now,
    project_id: project.id,
    thread_id: thr3Id,
    run_id: null,
    actor: { type: "agent", id: leadAgent?.id ?? "agt_lead" },
    causation_id: null,
    correlation_id: thr3Id,
    payload: {
      message_id: "msg_mem_01",
      thread_id: thr3Id,
      is_root: false,
      kind: "text",
      body: "Tôi đề xuất cập nhật tệp sổ tay kiến trúc quyết định sau phiên thảo luận:",
      mentions: ["@lead"],
      human_mentions: [],
      card: {
        kind: "memory_proposal",
        proposal_id: "prop_mem_01",
        target_file: "decisions.md",
        action: "append",
        content_diff: "## Quyết định V2 - MCP Grant\n- Agent chỉ đọc được thread sau khi được @mention.",
        reason: "Lưu vết quy tắc kiểm quyền grant để các worker sau không vi phạm.",
        status: "pending"
      }
    }
  }
]);

console.log("Seeding complete! 3 threads with all rich card types created.");
