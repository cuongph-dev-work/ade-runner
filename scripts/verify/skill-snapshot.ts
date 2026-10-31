import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { openHubDatabase } from "../../apps/hub/src/db/client.js";
import { applyEventToProjection } from "../../apps/hub/src/db/projector.js";
import { SettingsService } from "../../apps/hub/src/config/settings-service.js";
import { RunDispatcher } from "../../apps/hub/src/runner/run-dispatcher.js";
import { FakeClaudeDriver, InProcessRunnerTransport, type RunnerTransport } from "../../packages/runner/src/index.js";

async function main() {
  console.log("=== BẮT ĐẦU KIỂM CHỨNG: scripts/verify/skill-snapshot.ts ===");

  const tempRepo = mkdtempSync(join(tmpdir(), "ade-skillsnap-"));
  execSync("git init -b main", { cwd: tempRepo, stdio: "pipe" });
  execSync('git config user.email "test@ade.local"', { cwd: tempRepo, stdio: "pipe" });
  execSync('git config user.name "Test Dev"', { cwd: tempRepo, stdio: "pipe" });
  writeFileSync(join(tempRepo, "README.md"), "# Skill Snapshot Test\n", "utf8");
  execSync("git add . && git commit -m 'Initial commit'", { cwd: tempRepo, stdio: "pipe" });

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
      actor: { type: evt.actorType ?? "human", id: evt.actorId ?? "usr_local" },
      payload: evt.payload,
      ts: new Date().toISOString()
    };
    applyEventToProjection(db, full as any);
  };

  const settingsService = new SettingsService({
    sqlite: db,
    publishEvent: (type, payload, opts) => appendEvent({ type, payload, ...opts })
  });

  try {
    // 1. Tạo dự án mới qua Wizard
    const initRes = settingsService.createProject({
      projectName: "Snapshot App",
      repoPath: tempRepo,
      defaultBranch: "main",
      templateId: "lead_coder_tester_qa",
      useRepoInstructions: false
    });

    const projectId = initRes.project.id;

    // Lấy thông tin kênh general và tạo thread
    const ch = db.prepare("SELECT id FROM channels WHERE project_id = ?").get(projectId) as { id: string };
    const threadId = "thr_snap_01";
    appendEvent({
      type: "thread.created",
      projectId,
      channelId: ch.id,
      threadId,
      actorType: "human",
      actorId: "usr_local",
      payload: {
        thread_id: threadId,
        channel_id: ch.id,
        title: "Test Thread",
        workflow_id: "feature",
        root_message_id: "msg_root_01"
      }
    });

    // Thêm runner giả lập
    db.prepare(
      `INSERT INTO runners (id, owner_user_id, machine_name, harnesses_available_json, status, last_seen)
       VALUES ('rnr_local', 'usr_local', 'local-mac', '["claude-code", "codex"]', 'online', datetime('now'))`
    ).run();

    const transport = new InProcessRunnerTransport();

    const dispatcher = new RunDispatcher({
      sqlite: db,
      mode: "solo",
      mcpUrl: "http://127.0.0.1:3000/mcp",
      transport,
      appendEvent,
      broadcastWs: () => {},
      resolveAgentSkills: (agentId: string) => {
        const skills = db
          .prepare(
            `SELECT s.name, s.scope, s.path, s.content_hash
             FROM skills s
             INNER JOIN agent_skills ask ON ask.skill_id = s.id
             WHERE ask.agent_id = ?`
          )
          .all(agentId) as Array<{
          name: string;
          scope: "project" | "global";
          path: string;
          content_hash: string;
        }>;
        return skills.map((s) => ({
          name: s.name,
          sourceDir: s.path,
          contentHash: s.content_hash
        }));
      }
    });

    const coderAgent = db.prepare("SELECT id FROM agents WHERE project_id = ? AND handle = '@coder'").get(projectId) as { id: string };

    // Initial skill hash for "implement"
    const skillBefore = db.prepare("SELECT content_hash FROM skills WHERE name = 'implement' AND project_id = ?").get(projectId) as { content_hash: string };
    const hash1 = skillBefore.content_hash;
    console.log(`Hash ban đầu của skill implement: ${hash1}`);

    // 2. Chạy Run 1 cho @coder
    const run1Id = await dispatcher.onAgentMentioned({
      projectId,
      threadId,
      agentId: coderAgent.id,
      invokedBy: "usr_local",
      promptText: "Viết mã chức năng lần 1"
    });
    if (!run1Id) throw new Error("Không thể khởi tạo run 1");

    const run1Row = db.prepare("SELECT skills_snapshot_json, status FROM runs WHERE id = ?").get(run1Id) as { skills_snapshot_json: string; status: string };
    const snap1 = JSON.parse(run1Row.skills_snapshot_json);
    const snapSkill1 = snap1.find((s: any) => s.name === "implement");
    if (!snapSkill1 || snapSkill1.hash !== hash1) {
      throw new Error(`Snapshot Run 1 không khớp hash ban đầu! Kỳ vọng ${hash1}, nhận được ${snapSkill1?.hash}`);
    }
    console.log("Run 1 đã snapshot hash1 thành công!");

    // 3. Trong khi Run 1 đang chạy, sửa nội dung SKILL.md của "implement" trên đĩa
    const updatedContent = "---\nname: implement\ndescription: Viết mã nguồn nâng cấp v2\n---\n\n# Implement v2\nThêm quy tắc mới.\n";
    settingsService.updateSkill(projectId, "implement", updatedContent);

    const skillAfter = db.prepare("SELECT content_hash FROM skills WHERE name = 'implement' AND project_id = ?").get(projectId) as { content_hash: string };
    const hash2 = skillAfter.content_hash;
    if (hash1 === hash2) {
      throw new Error("Hash không thay đổi sau khi cập nhật nội dung skill!");
    }
    console.log(`Hash mới sau khi sửa skill: ${hash2}`);

    // 4. Kiểm tra Run 1: snapshot CỦA RUN 1 VẪN GIỮ HASH1
    const run1RowCheck = db.prepare("SELECT skills_snapshot_json FROM runs WHERE id = ?").get(run1Id) as { skills_snapshot_json: string };
    const snap1After = JSON.parse(run1RowCheck.skills_snapshot_json);
    const snapSkill1After = snap1After.find((s: any) => s.name === "implement");
    if (snapSkill1After.hash !== hash1) {
      throw new Error(`Bất biến bị phá vỡ! Run 1 bị đổi hash thành ${snapSkill1After.hash}`);
    }
    console.log("Bất biến được bảo toàn: Run 1 vẫn giữ hash cũ (hash1)!");

    // 5. Chạy Run 2 cho @coder
    const run2Id = await dispatcher.onAgentMentioned({
      projectId,
      threadId,
      agentId: coderAgent.id,
      invokedBy: "usr_local",
      promptText: "Viết mã chức năng lần 2"
    });
    if (!run2Id) throw new Error("Không thể khởi tạo run 2");

    const run2Row = db.prepare("SELECT skills_snapshot_json FROM runs WHERE id = ?").get(run2Id) as { skills_snapshot_json: string };
    const snap2 = JSON.parse(run2Row.skills_snapshot_json);
    const snapSkill2 = snap2.find((s: any) => s.name === "implement");
    if (!snapSkill2 || snapSkill2.hash !== hash2) {
      throw new Error(`Run 2 không nhận hash mới! Kỳ vọng ${hash2}, nhận được ${snapSkill2?.hash}`);
    }
    console.log("Run 2 đã nhận hash mới (hash2) chính xác!");

    console.log("[PASS] Skill snapshot verified: run đang chạy giữ hash cũ; run kế tiếp dùng hash mới.");
  } finally {
    hubDb.close();
    rmSync(tempRepo, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("[FAIL] Skill snapshot verification thất bại:", err);
  process.exit(1);
});
