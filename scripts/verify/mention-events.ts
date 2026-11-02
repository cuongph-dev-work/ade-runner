import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildHubApp } from "../../apps/hub/src/index.js";

async function main(): Promise<void> {
  const sandbox = mkdtempSync(join(tmpdir(), "ade-verify-mention-"));
  const repoDir = join(sandbox, "repo");
  mkdirSync(join(repoDir, ".ade", "agents"), { recursive: true });
  execFileSync("git", ["init"], { cwd: repoDir, stdio: "ignore" });

  writeFileSync(
    join(repoDir, ".ade", "project.yaml"),
    `name: "Mention Repo"\ndefault_branch: "main"\nworkflow: "feature"\n`
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

    // Tạo thread không mention để lấy threadId
    const created = await bundle.app.inject({
      method: "POST",
      url: `/api/channels/${general.id}/threads`,
      headers: { host: "127.0.0.1:3000" },
      payload: { body: "Mở thread kiểm tra mention" }
    });
    const threadId = created.json().thread.id as string;

    // Tin nhắn 1: 1 mention hợp lệ (@planner) + 1 mention đồng nghiệp (@owner, không sinh agent.mentioned)
    const msg1 = await bundle.app.inject({
      method: "POST",
      url: `/api/threads/${threadId}/messages`,
      headers: { host: "127.0.0.1:3000" },
      payload: { body: "Tin 1 gọi @planner và đồng nghiệp @owner" }
    });

    // Tin nhắn 2: 2 mention hợp lệ (@planner và @coder)
    const msg2 = await bundle.app.inject({
      method: "POST",
      url: `/api/threads/${threadId}/messages`,
      headers: { host: "127.0.0.1:3000" },
      payload: { body: "Tin 2 gọi cả @planner lẫn @coder cùng xem" }
    });

    // Tin nhắn 3: mention agent không tồn tại (@ghost)
    const msg3 = await bundle.app.inject({
      method: "POST",
      url: `/api/threads/${threadId}/messages`,
      headers: { host: "127.0.0.1:3000" },
      payload: { body: "Tin 3 gọi @ghost không tồn tại" }
    });

    const mentionEvents = bundle.hubDb.sqlite
      .prepare(
        `SELECT payload FROM events WHERE type = 'agent.mentioned' ORDER BY seq ASC`
      )
      .all() as Array<{ payload: string }>;
    const agentsMentioned = mentionEvents.map(
      (r) => (JSON.parse(r.payload) as { agent: string }).agent
    );

    const checkCount =
      mentionEvents.length === 3 &&
      JSON.stringify(agentsMentioned) ===
        JSON.stringify(["@planner", "@planner", "@coder"]);
    const msg3Json = msg3.json();
    const checkWarning =
      msg1.statusCode === 201 &&
      msg2.statusCode === 201 &&
      msg3.statusCode === 201 &&
      Array.isArray(msg3Json.unknownMentions) &&
      msg3Json.unknownMentions.includes("@ghost") &&
      msg3Json.systemMessage !== null &&
      String(msg3Json.systemMessage.body).includes("@ghost");

    console.log(
      `[${checkCount ? "PASS" : "FAIL"}] AC-API-CH-01-17 (1/2): Ghi đúng 3 sự kiện agent.mentioned cho agent hợp lệ (${agentsMentioned.join(", ")})`
    );
    console.log(
      `[${checkWarning ? "PASS" : "FAIL"}] AC-API-CH-01-17 (2/2): Agent không tồn tại (@ghost) sinh cảnh báo hệ thống, không sinh agent.mentioned`
    );

    if (!checkCount || !checkWarning) {
      process.exitCode = 1;
    }
  } finally {
    await bundle.app.close();
    rmSync(sandbox, { recursive: true, force: true });
  }
}

void main();
