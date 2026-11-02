import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { WorktreeManager } from "../../packages/runner/src/worktree.js";

const execFileAsync = promisify(execFile);

async function main(): Promise<void> {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ade-verify-wt-"));
  const repoPath = path.join(tmpRoot, "sample-repo");
  const skillSrc = path.join(tmpRoot, "skill-implement");
  await fs.mkdir(repoPath, { recursive: true });
  await fs.mkdir(skillSrc, { recursive: true });
  await fs.writeFile(
    path.join(skillSrc, "SKILL.md"),
    "---\nname: implement\ndescription: Implement feature\n---\n# Implement\n",
    "utf8",
  );

  await execFileAsync("git", ["init", "-b", "main"], { cwd: repoPath });
  await execFileAsync("git", ["config", "user.email", "dev@local.test"], { cwd: repoPath });
  await execFileAsync("git", ["config", "user.name", "ADE Verify"], { cwd: repoPath });
  await fs.writeFile(path.join(repoPath, "README.md"), "# Sample\n", "utf8");
  await execFileAsync("git", ["add", "README.md"], { cwd: repoPath });
  await execFileAsync("git", ["commit", "-m", "init"], { cwd: repoPath });

  const mgr = new WorktreeManager();
  const threadId = "thr_verify_wt_01";
  const wtPath = await mgr.ensureThreadWorktree({
    repoPath,
    threadId,
    defaultBranch: "main",
  });
  await mgr.syncCodexWorktreeSkills(repoPath, wtPath, [
    { name: "implement", sourceDir: skillSrc, contentHash: "sha256_demo" },
  ]);

  const expectedWt = path.join(repoPath, ".ade", "wt", threadId);
  const skillMdExists = await fs
    .stat(path.join(expectedWt, ".agents", "skills", "implement", "SKILL.md"))
    .then(() => true)
    .catch(() => false);

  const { stdout: rootStatus } = await execFileAsync("git", ["status", "--porcelain"], {
    cwd: repoPath,
  });
  const { stdout: wtStatus } = await execFileAsync("git", ["status", "--porcelain"], {
    cwd: expectedWt,
  });

  const checks = [
    { name: "Worktree tồn tại đúng đường dẫn .ade/wt/<thread_id>", ok: wtPath === expectedWt && skillMdExists },
    { name: "git status --porcelain tại repo gốc sạch (không chứa .agents/skills)", ok: rootStatus.trim() === "" },
    { name: "git status --porcelain tại worktree sạch (không chứa .agents/skills)", ok: wtStatus.trim() === "" },
  ];

  let failed = false;
  for (const c of checks) {
    console.log(`${c.ok ? "PASS" : "FAIL"}: ${c.name}`);
    if (!c.ok) failed = true;
  }

  await fs.rm(tmpRoot, { recursive: true, force: true });
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
