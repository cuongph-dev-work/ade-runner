import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { buildHubApp } from "../../apps/hub/src/app.js";
import { InProcessRunnerTransport } from "../../packages/runner/src/index.js";

async function main() {
  console.log("=== BẮT ĐẦU KIỂM CHỨNG: scripts/verify/summary.ts ===");
  const sandbox = mkdtempSync(join(tmpdir(), "ade-summary-"));
  const repoDir = join(sandbox, "repo");
  execSync(`mkdir -p "${repoDir}/.ade/agents"`, { stdio: "pipe" });
  execSync("git init -b main", { cwd: repoDir, stdio: "pipe" });
  execSync("git config user.email 'dev@ade.local'", { cwd: repoDir, stdio: "pipe" });
  execSync("git config user.name 'ADE Dev'", { cwd: repoDir, stdio: "pipe" });

  writeFileSync(
    join(repoDir, ".ade", "project.yaml"),
    "name: summary-test\ndefault_branch: main\ndefault_workflow: feature\n"
  );
  writeFileSync(
    join(repoDir, ".ade", "agents", "coder.yaml"),
    "handle: \"@coder\"\ndisplay_name: \"Coder\"\nrole: \"worker\"\nharness: \"claude-code\"\ncredential_profile: \"sub-claude\"\nwrite: true\n"
  );
  writeFileSync(join(repoDir, "README.md"), "# Test Summary\n");
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
    const agent = db.prepare("SELECT id, handle FROM agents WHERE project_id = ? LIMIT 1").get(project.id) as { id: string; handle: string };

    // 1. Tạo thread
    const threadId = "thr_sum_test_01";
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO threads (id, project_id, channel_id, root_message_id, title, state, workflow_id, created_by, created_at, updated_at)
       VALUES (?, ?, ?, 'msg_root', 'Triển khai tính năng Auth', 'building', 'feature', 'usr_local', ?, ?)`
    ).run(threadId, project.id, channel.id, now, now);

    // Run 1: Hoàn thành với report_outcome
    const run1Id = "run_sum_01";
    db.prepare(
      `INSERT INTO runs (id, project_id, thread_id, agent_id, invoked_by, credential_profile, role, status, cost_usd, created_at)
       VALUES (?, ?, ?, ?, 'usr_local', 'sub-claude', 'worker', 'running', 0.05, ?)`
    ).run(run1Id, project.id, threadId, agent.id, now);

    // Dispatcher nhận run.end với outcome = done và summary
    bundle.runDispatcher.onRunCompleted?.({
      runId: run1Id,
      threadId,
      agentHandle: agent.handle,
      outcome: "done",
      summary: "Đã hoàn thành module A",
      decisions: ["Chọn PostgreSQL", "Dùng JWT"]
    });

    const threadAfterRun1 = db.prepare("SELECT summary FROM threads WHERE id = ?").get(threadId) as { summary: string };
    console.log("Summary sau Run 1:\n" + threadAfterRun1.summary);

    if (!threadAfterRun1.summary.includes("Mục tiêu: Triển khai tính năng Auth")) {
      throw new Error("FAIL: Thiếu tiền tố Mục tiêu");
    }
    if (!threadAfterRun1.summary.includes("[@coder · done] Đã hoàn thành module A")) {
      throw new Error("FAIL: Thiếu bản ghi report_outcome của Run 1");
    }
    if (!threadAfterRun1.summary.includes("Quyết định: Chọn PostgreSQL; Dùng JWT")) {
      throw new Error("FAIL: Thiếu quyết định của Run 1");
    }

    // Run 2: Không gọi report_outcome, chỉ có tin nhắn phản hồi text
    const run2Id = "run_sum_02";
    db.prepare(
      `INSERT INTO runs (id, project_id, thread_id, agent_id, invoked_by, credential_profile, role, status, cost_usd, created_at)
       VALUES (?, ?, ?, ?, 'usr_local', 'sub-claude', 'worker', 'running', 0.05, ?)`
    ).run(run2Id, project.id, threadId, agent.id, now);

    // Ghi tin nhắn của run 2
    db.prepare(
      `INSERT INTO messages (id, thread_id, is_root, author_type, author_id, kind, body, run_id, created_at, updated_at)
       VALUES ('msg_r2', ?, 0, 'agent', ?, 'text', 'Triển khai tiếp module B', ?, ?, ?)`
    ).run(threadId, agent.id, run2Id, now, now);

    // Dispatcher nhận run.end với outcome unknown (fallback)
    bundle.runDispatcher.onRunCompleted?.({
      runId: run2Id,
      threadId,
      agentHandle: agent.handle,
      outcome: "unknown",
      summary: null,
      decisions: []
    });

    const threadAfterRun2 = db.prepare("SELECT summary FROM threads WHERE id = ?").get(threadId) as { summary: string };
    console.log("Summary sau Run 2:\n" + threadAfterRun2.summary);

    if (!threadAfterRun2.summary.includes("[@coder · done] Đã hoàn thành module A")) {
      throw new Error("FAIL: Mất dữ liệu Run 1");
    }
    if (!threadAfterRun2.summary.includes("[@coder · fallback] Triển khai tiếp module B")) {
      throw new Error("FAIL: Fallback không hoạt động chính xác khi thiếu report_outcome");
    }

    console.log("[PASS] Thread summary verified: report_outcome và fallback hoạt động chính xác!");
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
