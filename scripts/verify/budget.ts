import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { buildHubApp } from "../../apps/hub/src/app.js";
import { InProcessRunnerTransport } from "../../packages/runner/src/index.js";

async function main() {
  console.log("=== BẮT ĐẦU KIỂM CHỨNG: scripts/verify/budget.ts ===");
  const sandbox = mkdtempSync(join(tmpdir(), "ade-budget-"));
  const repoDir = join(sandbox, "repo");
  execSync(`mkdir -p "${repoDir}/.ade/agents"`, { stdio: "pipe" });
  execSync("git init -b main", { cwd: repoDir, stdio: "pipe" });
  execSync("git config user.email 'dev@ade.local'", { cwd: repoDir, stdio: "pipe" });
  execSync("git config user.name 'ADE Dev'", { cwd: repoDir, stdio: "pipe" });

  writeFileSync(
    join(repoDir, ".ade", "project.yaml"),
    "name: budget-test\ndefault_branch: main\ndefault_workflow: feature\n"
  );
  writeFileSync(
    join(repoDir, ".ade", "agents", "coder.yaml"),
    "handle: \"@coder\"\ndisplay_name: \"Coder\"\nrole: \"worker\"\nharness: \"claude-code\"\ncredential_profile: \"sub-claude\"\nwrite: true\nbudget_usd: 0.10\n"
  );
  writeFileSync(join(repoDir, "README.md"), "# Test Budget\n");
  execSync("git add . && git commit -m 'init'", { cwd: repoDir, stdio: "pipe" });

  const transport = new InProcessRunnerTransport();
  const bundle = await buildHubApp({
    dbPath: join(sandbox, "ade.db"),
    mode: "solo",
    runnerTransport: transport,
    defaultRepoPath: repoDir
  });

  try {
    const db = bundle.hubDb.sqlite;
    const project = db.prepare("SELECT id FROM projects LIMIT 1").get() as { id: string };
    const channel = db.prepare("SELECT id FROM channels WHERE project_id = ? LIMIT 1").get(project.id) as { id: string };
    const agent = db.prepare("SELECT id, handle, budget_usd FROM agents WHERE project_id = ? LIMIT 1").get(project.id) as {
      id: string;
      handle: string;
      budget_usd: number;
    };

    if (Number(agent.budget_usd) !== 0.10) {
      throw new Error(`FAIL: budget_usd của agent không phải 0.10, nhận ${agent.budget_usd}`);
    }

    // 1. Tạo thread có budget_usd = 0.20
    const threadId = "thr_budget_test_01";
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO threads (id, project_id, channel_id, root_message_id, title, state, workflow_id, budget_usd, spent_usd, created_by, created_at, updated_at)
       VALUES (?, ?, ?, 'msg_root', 'Thread kiểm tra ngân sách', 'building', 'feature', 0.20, 0, 'usr_local', ?, ?)`
    ).run(threadId, project.id, channel.id, now, now);

    // 2. Chạy Run 1
    const run1Id = "run_bgt_01";
    db.prepare(
      `INSERT INTO runs (id, project_id, thread_id, agent_id, invoked_by, credential_profile, role, status, cost_usd, created_at)
       VALUES (?, ?, ?, ?, 'usr_local', 'sub-claude', 'worker', 'running', 0, ?)`
    ).run(run1Id, project.id, threadId, agent.id, now);

    // Giả lập Runner gửi usage cập nhật giữa chừng: cost_usd = 0.085 (85% budget của agent -> chạm ngưỡng warning <= 20%)
    let receivedWarning = false;
    bundle.eventBus.subscribe((frame: any) => {
      if (frame.type === "budget.warning") {
        receivedWarning = true;
        console.log("Đã nhận WebSocket budget.warning:", frame.data);
      }
    });

    bundle.runDispatcher.onUsageUpdate?.(run1Id, 0.085, 100, 200);

    const warnEvents = db.prepare("SELECT * FROM events WHERE type = 'budget.warning'").all();
    if (warnEvents.length === 0) {
      throw new Error("FAIL: Không ghi event budget.warning khi chạm ngưỡng 80% hạn mức");
    }
    console.log("Cảnh báo sớm: OK!");

    // Giả lập Runner gửi tiếp usage vượt trần: cost_usd = 0.12 > agent_budget 0.10
    bundle.runDispatcher.onUsageUpdate?.(run1Id, 0.12, 150, 300);

    // Kiểm tra Run 1 đã bị dừng cưỡng bức (Run/T-14)
    const run1Row = db.prepare("SELECT status, stop_reason, cost_usd FROM runs WHERE id = ?").get(run1Id) as {
      status: string;
      stop_reason: string;
      cost_usd: number;
    };
    console.log("Trạng thái Run 1 sau khi vượt trần:", run1Row);

    if (run1Row.status !== "failed" || run1Row.stop_reason !== "budget_exceeded") {
      throw new Error("FAIL: Run 1 không bị chuyển sang failed với stop_reason budget_exceeded");
    }

    // Kiểm tra tin nhắn cảnh báo system trong thread
    const sysMsg = db.prepare("SELECT body FROM messages WHERE thread_id = ? AND kind = 'system'").get(threadId) as { body: string };
    if (!sysMsg || !sysMsg.body.includes("Cảnh báo: Tiến trình đã bị dừng cưỡng bức do vượt trần ngân sách")) {
      throw new Error("FAIL: Thiếu tin nhắn cảnh báo system trong thread");
    }
    console.log("Tin nhắn system trong thread: " + sysMsg.body);

    console.log("[PASS] Budget control verified: cảnh báo sớm và dừng cưỡng bức khi vượt trần ngân sách hoạt động chính xác!");
    process.exit(0);
  } finally {
    await bundle.app.close();
    rmSync(sandbox, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
