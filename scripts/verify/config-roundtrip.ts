import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { openHubDatabase } from "../../apps/hub/src/db/client.js";
import { applyEventToProjection } from "../../apps/hub/src/db/projector.js";
import { SettingsService } from "../../apps/hub/src/config/settings-service.js";
import { syncProjectAdeConfig } from "../../apps/hub/src/config/ade-loader.js";

async function main() {
  console.log("=== BẮT ĐẦU KIỂM CHỨNG: scripts/verify/config-roundtrip.ts ===");

  const tempRepo = mkdtempSync(join(tmpdir(), "ade-roundtrip-"));
  execSync("git init -b main", { cwd: tempRepo, stdio: "pipe" });
  execSync('git config user.email "test@ade.local"', { cwd: tempRepo, stdio: "pipe" });
  execSync('git config user.name "Test Dev"', { cwd: tempRepo, stdio: "pipe" });
  writeFileSync(join(tempRepo, "README.md"), "# Test Repo\n", "utf8");
  execSync("git add . && git commit -m 'Initial commit'", { cwd: tempRepo, stdio: "pipe" });

  const hubDb = openHubDatabase(":memory:");
  const db = hubDb.sqlite;
  let seq = 1;

  const appendEvent = (type: string, payload: any, opts: any = {}) => {
    const full = {
      seq: seq++,
      id: `evt_${seq}`,
      type,
      project_id: opts.projectId ?? null,
      thread_id: null,
      run_id: null,
      actor: { type: opts.actorType ?? "human", id: opts.actorId ?? "usr_local" },
      payload,
      ts: new Date().toISOString()
    };
    applyEventToProjection(db, full as any);
  };

  const settingsService = new SettingsService({
    sqlite: db,
    publishEvent: appendEvent
  });

  try {
    // 1. Tạo dự án mới qua Wizard
    const initRes = settingsService.createProject({
      projectName: "Roundtrip App",
      repoPath: tempRepo,
      defaultBranch: "main",
      templateId: "lead_coder_tester_qa",
      useRepoInstructions: false
    });

    const projectId = initRes.project.id;
    console.log(`Dự án đã tạo: ${projectId} tại ${tempRepo}`);

    // Direction 1: Sửa tay coder.yaml trên đĩa -> Đọc lại qua SettingsService
    const coderYamlPath = join(tempRepo, ".ade", "agents", "coder.yaml");
    const coderData = parseYaml(readFileSync(coderYamlPath, "utf8"));
    coderData.display_name = "Super Coder";
    coderData.budget_usd = 25.5;
    coderData.skills.push("fast-code");
    writeFileSync(coderYamlPath, stringifyYaml(coderData), "utf8");

    // Đồng bộ lại từ đĩa (giả lập file watcher kích hoạt sync)
    syncProjectAdeConfig(db, projectId);

    const afterDiskEdit = settingsService.getSettings(projectId);
    const coderAgent1 = afterDiskEdit.agents.find((a) => a.handle === "@coder");
    if (!coderAgent1) {
      throw new Error("Không tìm thấy agent @coder sau khi đồng bộ!");
    }
    if (coderAgent1.displayName !== "Super Coder") {
      throw new Error(`Kỳ vọng displayName 'Super Coder', nhận được '${coderAgent1.displayName}'`);
    }
    if (coderAgent1.budgetUsd !== 25.5) {
      throw new Error(`Kỳ vọng budgetUsd 25.5, nhận được ${coderAgent1.budgetUsd}`);
    }
    console.log("Hướng 1 (File sửa tay -> DB/API): OK!");

    // Direction 2: Sửa qua SettingsService -> Đọc file trên đĩa
    settingsService.upsertAgent(projectId, {
      handle: "@coder",
      displayName: "Ultra Coder",
      role: "Lập trình viên full-stack cao cấp",
      harness: "codex",
      credentialProfile: "sub-chatgpt",
      skills: ["implement", "write-tests"],
      write: true,
      canBeMain: false,
      enabled: true,
      maxDepth: 4,
      budgetUsd: 50.0,
      timeoutS: 1200,
      mcpAllow: ["get_thread"]
    });

    const diskRaw = readFileSync(coderYamlPath, "utf8");
    const parsedDisk = parseYaml(diskRaw);
    if (parsedDisk.display_name !== "Ultra Coder") {
      throw new Error(`Kỳ vọng tệp đĩa có display_name 'Ultra Coder', nhận được '${parsedDisk.display_name}'`);
    }
    if (parsedDisk.role !== "Lập trình viên full-stack cao cấp") {
      throw new Error(`Kỳ vọng tệp đĩa có role mới, nhận được '${parsedDisk.role}'`);
    }
    if (parsedDisk.timeout_s !== 1200) {
      throw new Error(`Kỳ vọng tệp đĩa có timeout_s 1200, nhận được ${parsedDisk.timeout_s}`);
    }
    console.log("Hướng 2 (API sửa -> Tệp YAML trên đĩa): OK!");

    // Project General Config Roundtrip
    settingsService.updateProjectGeneral(projectId, {
      projectName: "Roundtrip App Renamed",
      defaultBranch: "main",
      defaultMainAgent: "@lead",
      defaultWorkflow: "feature",
      useRepoInstructions: true
    });

    const projectYamlPath = join(tempRepo, ".ade", "project.yaml");
    const projDisk = parseYaml(readFileSync(projectYamlPath, "utf8"));
    if (projDisk.name !== "Roundtrip App Renamed" || projDisk.use_repo_instructions !== true) {
      throw new Error("Tệp .ade/project.yaml không cập nhật đúng giá trị mới!");
    }
    console.log("Cấu hình chung dự án (General Roundtrip): OK!");

    console.log("[PASS] Config roundtrip verified: file sửa tay phản ánh vào API/DB và API cập nhật khớp 100% tệp YAML trên đĩa.");
  } finally {
    hubDb.close();
    rmSync(tempRepo, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("[FAIL] Config roundtrip thất bại:", err);
  process.exit(1);
});
