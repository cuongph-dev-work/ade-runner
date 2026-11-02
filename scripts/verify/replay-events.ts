import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { buildHubApp, syncProjectAdeConfig } from "../../apps/hub/src/index.js";

function snapshotProjections(sqlite: Database.Database): Record<string, unknown[]> {
  return {
    projects: sqlite.prepare("SELECT * FROM projects ORDER BY id ASC").all(),
    projectMembers: sqlite
      .prepare("SELECT * FROM project_members ORDER BY project_id ASC, user_id ASC")
      .all(),
    channels: sqlite.prepare("SELECT * FROM channels ORDER BY id ASC").all(),
    channelMembers: sqlite
      .prepare(
        "SELECT * FROM channel_members ORDER BY channel_id ASC, member_type ASC, member_id ASC"
      )
      .all(),
    agents: sqlite.prepare("SELECT * FROM agents ORDER BY id ASC").all(),
    threads: sqlite.prepare("SELECT * FROM threads ORDER BY id ASC").all(),
    messages: sqlite.prepare("SELECT * FROM messages ORDER BY id ASC").all()
  };
}

async function main(): Promise<void> {
  const sandbox = mkdtempSync(join(tmpdir(), "ade-verify-replay-"));
  const repoDir = join(sandbox, "repo");
  mkdirSync(join(repoDir, ".ade", "agents"), { recursive: true });
  execFileSync("git", ["init"], { cwd: repoDir, stdio: "ignore" });

  writeFileSync(
    join(repoDir, ".ade", "project.yaml"),
    `name: "Replay Repo"\ndefault_branch: "main"\nworkflow: "feature"\n`
  );
  writeFileSync(
    join(repoDir, ".ade", "agents", "planner.yaml"),
    `handle: "planner"\ndisplay_name: "Planner"\nharness: "claude"\nenabled: true\n`
  );
  writeFileSync(
    join(repoDir, ".ade", "agents", "coder.yaml"),
    `handle: "coder"\ndisplay_name: "Coder"\nharness: "codex"\nenabled: true\n`
  );

  const bundle = await buildHubApp({
    dbPath: join(sandbox, "ade.db"),
    defaultRepoPath: repoDir,
    watchAdeFiles: false
  });

  try {
    const project = bundle.chatService.listProjects()[0]!;
    const general = bundle.chatService.listChannels(project.id)[0]!;

    const tempChannel = bundle.chatService.createChannel(project.id, {
      name: "design-temp",
      description: "Kênh thử nghiệm xóa mềm"
    });
    bundle.chatService.updateChannel(tempChannel.id, {
      name: "design-system",
      description: "Đã đổi tên",
      memberAgentIds: []
    });
    const histThread = bundle.chatService.createThread(tempChannel.id, {
      body: "Tin nhắn lịch sử trên kênh sắp xóa mềm @planner"
    });
    bundle.chatService.toggleReaction(histThread.rootMessage.id, { emoji: "👍" });
    bundle.chatService.deleteChannel(tempChannel.id);

    const activeThread = bundle.chatService.createThread(general.id, {
      body: "Khởi tạo kiến trúc Slack @planner @owner"
    });
    const reply = bundle.chatService.postMessage(activeThread.thread.id, {
      body: "Phản hồi kiểm tra @coder và cảnh báo @ghost"
    });
    bundle.chatService.toggleReaction(reply.message.id, { emoji: "🚀" });
    bundle.chatService.toggleReaction(activeThread.rootMessage.id, { emoji: "🔥" });
    bundle.chatService.toggleReaction(activeThread.rootMessage.id, { emoji: "🔥" });

    const before = snapshotProjections(bundle.hubDb.sqlite);

    bundle.hubDb.rebuildProjections((sqliteConn) => {
      const projectRows = sqliteConn
        .prepare("SELECT id FROM projects ORDER BY id ASC")
        .all() as Array<{ id: string }>;
      for (const p of projectRows) {
        syncProjectAdeConfig(sqliteConn, p.id);
      }
    });

    const after = snapshotProjections(bundle.hubDb.sqlite);
    const matched = JSON.stringify(before) === JSON.stringify(after);

    console.log(
      `[${matched ? "PASS" : "FAIL"}] AC-API-CH-01-24: Dựng lại toàn bộ projection từ events trùng khớp 100%`
    );
    if (!matched) {
      console.error("Before:", JSON.stringify(before, null, 2));
      console.error("After:", JSON.stringify(after, null, 2));
      process.exitCode = 1;
    }
  } finally {
    await bundle.app.close();
    rmSync(sandbox, { recursive: true, force: true });
  }
}

void main();
