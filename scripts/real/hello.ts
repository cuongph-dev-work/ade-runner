// scripts/real/hello.ts
// @real — Mention agent Claude thật và agent Codex thật trên repo mẫu qua Hub Dispatcher; xác nhận run.completed + live_card.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { buildHubApp } from "../../apps/hub/src/index.js";
import {
  AcpProcessPool,
  ClaudeSdkDriver,
  CodexAcpDriver,
  InProcessRunnerTransport,
  IsolationProfileManager,
  LocalRunnerDaemon,
  WorktreeManager,
} from "../../packages/runner/src/index.js";

const execFileAsync = promisify(execFile);

async function main(): Promise<void> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ade-real-hello-"));
  const repoPath = path.join(tmpDir, "repo");
  await fs.mkdir(path.join(repoPath, ".ade", "agents"), { recursive: true });
  await fs.mkdir(path.join(repoPath, ".ade", "workflows"), { recursive: true });

  await execFileAsync("git", ["init", "-b", "main"], { cwd: repoPath });
  await execFileAsync("git", ["config", "user.email", "dev@local.test"], { cwd: repoPath });
  await execFileAsync("git", ["config", "user.name", "ADE Real"], { cwd: repoPath });

  await fs.writeFile(
    path.join(repoPath, ".ade", "project.yaml"),
    'name: "Real Hello"\ndefault_branch: "main"\nworkflow: "feature"\n',
    "utf8"
  );
  await fs.writeFile(
    path.join(repoPath, ".ade", "workflows", "feature.yaml"),
    'id: "feature"\ninitial: "open"\nstates:\n  - open\n  - done\n',
    "utf8"
  );
  await fs.writeFile(
    path.join(repoPath, ".ade", "agents", "claude.yaml"),
    'handle: "@claude"\ndisplay_name: "Claude"\nharness: "claude-code"\ncredential_profile: "sub-claude"\nwrite: false\n',
    "utf8"
  );
  await fs.writeFile(
    path.join(repoPath, ".ade", "agents", "codex.yaml"),
    'handle: "@codex"\ndisplay_name: "Codex"\nharness: "codex"\ncredential_profile: "sub-chatgpt"\nwrite: false\n',
    "utf8"
  );
  await fs.writeFile(path.join(repoPath, "README.md"), "# Real Hello Repo\n", "utf8");

  await execFileAsync("git", ["add", "."], { cwd: repoPath });
  await execFileAsync("git", ["commit", "-m", "init real hello"], { cwd: repoPath });

  const isolation = new IsolationProfileManager();
  const worktrees = new WorktreeManager();
  const acpPool = new AcpProcessPool();
  const claudeDriver = new ClaudeSdkDriver(isolation, query as never);
  const codexDriver = new CodexAcpDriver(isolation, worktrees, acpPool);

  const transport = new InProcessRunnerTransport();
  const daemon = new LocalRunnerDaemon({
    runnerId: "rnr_real_hello",
    mode: "solo",
    transport,
    worktrees,
    claudeDriver,
    codexDriver,
  });

  const bundle = await buildHubApp({
    dbPath: path.join(tmpDir, "ade.db"),
    mode: "solo",
    defaultRepoPath: repoPath,
    runnerTransport: transport,
  });

  await bundle.app.listen({ host: "127.0.0.1", port: 0 });
  daemon.connect();

  try {
    const project = bundle.hubDb.sqlite
      .prepare("SELECT id FROM projects LIMIT 1")
      .get() as { id: string };
    const channel = bundle.hubDb.sqlite
      .prepare("SELECT id FROM channels WHERE project_id = ? LIMIT 1")
      .get(project.id) as { id: string };

    const humanMsg = await bundle.chatService.postMessage({
      channelId: channel.id,
      authorType: "human",
      authorId: "usr_cuong",
      body: "@claude @codex Chào ngắn gọn 1 câu bằng tiếng Việt.",
    });

    const deadline = Date.now() + 120_000;
    let allCompleted = false;

    while (Date.now() < deadline) {
      const runs = bundle.hubDb.sqlite
        .prepare("SELECT id, status, live_card_message_id FROM runs WHERE thread_id = ?")
        .all(humanMsg.threadId) as Array<{
        id: string;
        status: string;
        live_card_message_id: string | null;
      }>;

      if (
        runs.length >= 2 &&
        runs.every((r) => r.status === "completed" && r.live_card_message_id !== null)
      ) {
        allCompleted = true;
        break;
      }
      if (runs.some((r) => r.status === "failed" || r.status === "cancelled")) {
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    console.log(
      `${allCompleted ? "PASS" : "FAIL"}: Cả hai run Claude và Codex kết thúc completed kèm Live Card`
    );
    if (!allCompleted) process.exit(1);
  } finally {
    daemon.disconnect();
    await bundle.app.close();
    await acpPool.closeAll();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
