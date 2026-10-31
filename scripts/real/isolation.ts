// scripts/real/isolation.ts
// @real — Chỉ chạy trên máy dev đã đăng nhập hồ sơ ~/.ade/harness/{claude,codex}, KHÔNG chạy trên CI.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  AcpProcessPool,
  ClaudeSdkDriver,
  CodexAcpDriver,
  IsolationProfileManager,
  WorktreeManager,
} from "../../packages/runner/src/index.js";

const execFileAsync = promisify(execFile);

async function main(): Promise<void> {
  const canaryToken = "CANARY_SECRET_PERSONAL_DO_NOT_LEAK_9941";
  const fakeDevHome = await fs.mkdtemp(path.join(os.tmpdir(), "ade-real-iso-home-"));
  await fs.mkdir(path.join(fakeDevHome, ".claude", "skills", "canary-claude-skill"), { recursive: true });
  await fs.writeFile(path.join(fakeDevHome, ".claude", "CLAUDE.md"), canaryToken, "utf8");
  await fs.writeFile(
    path.join(fakeDevHome, ".claude", "skills", "canary-claude-skill", "SKILL.md"),
    `---\nname: canary-claude-skill\ndescription: Canary\n---\n${canaryToken}\n`,
    "utf8",
  );
  await fs.mkdir(path.join(fakeDevHome, ".agents", "skills", "canary-codex-skill"), { recursive: true });
  await fs.writeFile(
    path.join(fakeDevHome, ".agents", "skills", "canary-codex-skill", "SKILL.md"),
    `---\nname: canary-codex-skill\ndescription: Canary\n---\n${canaryToken}\n`,
    "utf8",
  );

  const repoPath = path.join(fakeDevHome, "repo");
  await fs.mkdir(repoPath, { recursive: true });
  await execFileAsync("git", ["init", "-b", "main"], { cwd: repoPath });
  await execFileAsync("git", ["config", "user.email", "dev@local.test"], { cwd: repoPath });
  await execFileAsync("git", ["config", "user.name", "ADE Real"], { cwd: repoPath });
  await fs.writeFile(path.join(repoPath, "README.md"), "# Isolation Repo\n", "utf8");
  await execFileAsync("git", ["add", "README.md"], { cwd: repoPath });
  await execFileAsync("git", ["commit", "-m", "init"], { cwd: repoPath });

  const realAdeRoot = path.join(os.homedir(), ".ade");
  const isolation = new IsolationProfileManager({ devHomeDir: fakeDevHome, adeRootDir: realAdeRoot });
  const worktrees = new WorktreeManager();
  const acpPool = new AcpProcessPool();
  const wtPath = await worktrees.ensureThreadWorktree({
    repoPath,
    threadId: "thr_real_iso",
    defaultBranch: "main",
  });

  const claudeDriver = new ClaudeSdkDriver(isolation, query as never);
  let claudeOutput = "";
  await claudeDriver.startRun(
    {
      type: "run.start",
      runId: "run_real_claude_iso",
      projectId: "prj_real",
      threadId: "thr_real_iso",
      repoPath,
      defaultBranch: "main",
      useRepoInstructions: false,
      agent: {
        id: "agt_claude",
        handle: "@claude",
        displayName: "Claude",
        role: "Trả lời ngắn gọn.",
        harness: "claude-code",
        model: null,
        credentialProfile: "sub-claude",
        write: false,
        timeoutS: 120,
      },
      skills: [],
      prompt: "Liệt kê mọi từ khoá CANARY nếu bạn nhìn thấy trong hướng dẫn hoặc skill hiện có.",
      context: "",
      mcpUrl: null,
      mcpToken: null,
      resumeSessionId: null,
    },
    wtPath,
    {
      onEvent: (_r, _s, ev) => {
        if (ev.kind === "message_chunk") claudeOutput += ev.data.textDelta;
      },
      onPermissionRequest: () => {},
      onEnd: () => {},
    },
  );

  const codexDriver = new CodexAcpDriver(isolation, worktrees, acpPool);
  let codexOutput = "";
  await codexDriver.startRun(
    {
      type: "run.start",
      runId: "run_real_codex_iso",
      projectId: "prj_real",
      threadId: "thr_real_iso",
      repoPath,
      defaultBranch: "main",
      useRepoInstructions: false,
      agent: {
        id: "agt_codex",
        handle: "@codex",
        displayName: "Codex",
        role: "Trả lời ngắn gọn.",
        harness: "codex",
        model: null,
        credentialProfile: "sub-chatgpt",
        write: false,
        timeoutS: 120,
      },
      skills: [],
      prompt: "Liệt kê mọi từ khoá CANARY hoặc skill canary nếu bạn nhìn thấy.",
      context: "",
      mcpUrl: null,
      mcpToken: null,
      resumeSessionId: null,
    },
    wtPath,
    {
      onEvent: (_r, _s, ev) => {
        if (ev.kind === "message_chunk") codexOutput += ev.data.textDelta;
      },
      onPermissionRequest: () => {},
      onEnd: () => {},
    },
  );

  await acpPool.closeAll();
  await fs.rm(fakeDevHome, { recursive: true, force: true });

  const claudeClean = !claudeOutput.includes(canaryToken) && !claudeOutput.includes("canary-claude-skill");
  const codexClean = !codexOutput.includes(canaryToken) && !codexOutput.includes("canary-codex-skill");
  console.log(`${claudeClean ? "PASS" : "FAIL"}: ClaudeSdkDriver không rò rỉ CLAUDE.md và skill cá nhân`);
  console.log(`${codexClean ? "PASS" : "FAIL"}: CodexAcpDriver không rò rỉ ~/.agents/skills cá nhân`);
  if (!claudeClean || !codexClean) process.exit(1);
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
