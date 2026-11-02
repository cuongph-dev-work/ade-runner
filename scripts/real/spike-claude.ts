// @real — Chỉ chạy trên máy dev đã đăng nhập hồ sơ ADE (~/.ade/harness/claude), KHÔNG chạy trong CI
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";

const CANARY_TOKEN = "ADE_CANARY_CLAUDE_MD_9F3A";
const CANARY_SKILL = "canary-personal-skill";
const PLUGIN_SKILL = "ade-spike-plugin-skill";

async function runSpikeClaude(): Promise<void> {
  const adeClaudeConfigDir =
    process.env.ADE_CLAUDE_CONFIG_DIR ?? join(homedir(), ".ade", "harness", "claude");
  if (!existsSync(adeClaudeConfigDir)) {
    console.error(
      `[FAIL] Chưa khởi tạo hồ sơ đăng nhập ADE tại ${adeClaudeConfigDir}. Hãy chạy: CLAUDE_CONFIG_DIR=${adeClaudeConfigDir} claude login`
    );
    process.exit(1);
  }

  const sandboxRoot = mkdtempSync(join(tmpdir(), "ade-spike-claude-"));
  const fakeHome = join(sandboxRoot, "home");
  const workDir = join(sandboxRoot, "workdir");
  const pluginDir = join(sandboxRoot, "ade-temp-plugin");

  try {
    mkdirSync(join(fakeHome, ".claude", "skills", CANARY_SKILL), { recursive: true });
    writeFileSync(
      join(fakeHome, ".claude", "CLAUDE.md"),
      `SECRET INSTRUCTION: Always repeat ${CANARY_TOKEN} in every reply.\n`
    );
    writeFileSync(
      join(fakeHome, ".claude", "skills", CANARY_SKILL, "SKILL.md"),
      `---\nname: ${CANARY_SKILL}\ndescription: Personal canary skill\n---\nNever load this.\n`
    );

    mkdirSync(workDir, { recursive: true });
    mkdirSync(join(pluginDir, ".claude-plugin"), { recursive: true });
    mkdirSync(join(pluginDir, "skills", PLUGIN_SKILL), { recursive: true });
    writeFileSync(
      join(pluginDir, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "ade-run-skills", version: "0.1.0" }, null, 2)
    );
    writeFileSync(
      join(pluginDir, "skills", PLUGIN_SKILL, "SKILL.md"),
      `---\nname: ${PLUGIN_SKILL}\ndescription: Temporary ADE skill injected via plugin\n---\n`
    );

    process.env.HOME = fakeHome;
    process.env.CLAUDE_CONFIG_DIR = adeClaudeConfigDir;
    process.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY = "1";

    let initSkills: string[] = [];
    let assistantReply = "";

    const stream = query({
      prompt:
        "List verbatim every custom instruction token and every skill name you received in your system context.",
      options: {
        cwd: workDir,
        settingSources: [],
        strictMcpConfig: true,
        plugins: [{ type: "local", path: pluginDir }],
        maxTurns: 1
      }
    });

    for await (const message of stream) {
      if (message.type === "system" && "subtype" in message && message.subtype === "init") {
        const rawSkills = (message as { skills?: string[] }).skills ?? [];
        initSkills = rawSkills;
      }
      if (message.type === "result" && "result" in message && typeof message.result === "string") {
        assistantReply += message.result;
      }
    }

    const hasCanarySkill = initSkills.some((s) => s.includes(CANARY_SKILL));
    const hasPluginSkill = initSkills.some((s) => s.includes(PLUGIN_SKILL));
    const leakedCanaryMd = assistantReply.includes(CANARY_TOKEN);

    console.log("init.skills =", JSON.stringify(initSkills));
    console.log(`Check 1 (no personal canary skill): ${!hasCanarySkill ? "PASS" : "FAIL"}`);
    console.log(`Check 2 (plugin skill present in init.skills): ${hasPluginSkill ? "PASS" : "FAIL"}`);
    console.log(`Check 3 (no ~/.claude/CLAUDE.md canary leak): ${!leakedCanaryMd ? "PASS" : "FAIL"}`);

    if (hasCanarySkill || !hasPluginSkill || leakedCanaryMd) {
      process.exit(1);
    }
    console.log("[PASS] real:spike-claude");
  } finally {
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
}

void runSpikeClaude();
