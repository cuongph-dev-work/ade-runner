// @real — Chỉ chạy trên máy dev đã đăng nhập hồ sơ ADE (~/.ade/harness/codex), KHÔNG chạy trong CI
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const CANARY_SKILL = "canary-codex-personal";
const WORKTREE_SKILL = "ade-worktree-skill";
const CANARY_PHRASE = "CODEX_PERSONAL_CANARY_88B1";

function runSpikeCodex(): void {
  const baseAdeCodexHome =
    process.env.ADE_CODEX_HOME ?? join(homedir(), ".ade", "harness", "codex");
  if (!existsSync(baseAdeCodexHome)) {
    console.error(
      `[FAIL] Chưa khởi tạo hồ sơ đăng nhập Codex của ADE tại ${baseAdeCodexHome}. Hãy chạy: CODEX_HOME=${baseAdeCodexHome} codex login`
    );
    process.exit(1);
  }

  const sandboxRoot = mkdtempSync(join(tmpdir(), "ade-spike-codex-"));
  const fakeHome = join(sandboxRoot, "home");
  const runCodexHome = join(sandboxRoot, "codex-home");
  const worktreeDir = join(sandboxRoot, "worktree");

  try {
    const canarySkillFile = join(fakeHome, ".agents", "skills", CANARY_SKILL, "SKILL.md");
    mkdirSync(join(fakeHome, ".agents", "skills", CANARY_SKILL), { recursive: true });
    writeFileSync(
      canarySkillFile,
      `---\nname: ${CANARY_SKILL}\ndescription: ${CANARY_PHRASE}\n---\nPersonal canary.\n`
    );

    mkdirSync(worktreeDir, { recursive: true });
    execFileSync("git", ["init"], { cwd: worktreeDir, stdio: "ignore" });
    mkdirSync(join(worktreeDir, ".agents", "skills", WORKTREE_SKILL), { recursive: true });
    writeFileSync(
      join(worktreeDir, ".agents", "skills", WORKTREE_SKILL, "SKILL.md"),
      `---\nname: ${WORKTREE_SKILL}\ndescription: Worktree ADE skill for spike verification\n---\nAlways acknowledge ${WORKTREE_SKILL}.\n`
    );

    mkdirSync(runCodexHome, { recursive: true });
    cpSync(baseAdeCodexHome, runCodexHome, { recursive: true });
    writeFileSync(
      join(runCodexHome, "config.toml"),
      [
        `[[skills.config]]`,
        `path = ${JSON.stringify(canarySkillFile)}`,
        `enabled = false`,
        ``
      ].join("\n")
    );

    const execRes = spawnSync(
      "codex",
      [
        "exec",
        "--json",
        "List the exact names of all Agent Skills currently available to you in this session."
      ],
      {
        cwd: worktreeDir,
        env: {
          ...process.env,
          HOME: fakeHome,
          CODEX_HOME: runCodexHome
        },
        encoding: "utf8"
      }
    );

    if (execRes.status !== 0) {
      console.error("[FAIL] codex exec failed:", execRes.stderr);
      process.exit(1);
    }

    const stdout = execRes.stdout;
    const leakedPersonal =
      stdout.includes(CANARY_SKILL) || stdout.includes(CANARY_PHRASE);
    const loadedWorktreeSkill = stdout.includes(WORKTREE_SKILL);

    console.log(`Check 1 (subscription auth succeeded): PASS`);
    console.log(`Check 2 (personal canary skill disabled): ${!leakedPersonal ? "PASS" : "FAIL"}`);
    console.log(`Check 3 (worktree skill loaded): ${loadedWorktreeSkill ? "PASS" : "FAIL"}`);

    if (leakedPersonal || !loadedWorktreeSkill) {
      process.exit(1);
    }
    console.log("[PASS] real:spike-codex");
  } finally {
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
}

runSpikeCodex();
