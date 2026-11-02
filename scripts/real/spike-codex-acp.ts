// @real — Chỉ chạy trên máy dev đã đăng nhập hồ sơ ADE (~/.ade/harness/codex), KHÔNG chạy trong CI
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { AcpStdioClient } from "../../packages/runner/src/fake/acp-stdio-client.js";

async function runSpikeCodexAcp(): Promise<void> {
  const adeCodexHome =
    process.env.ADE_CODEX_HOME ?? join(homedir(), ".ade", "harness", "codex");
  if (!existsSync(adeCodexHome)) {
    console.error(
      `[FAIL] Chưa có hồ sơ đăng nhập Codex tại ${adeCodexHome}. Hãy chạy: CODEX_HOME=${adeCodexHome} codex login`
    );
    process.exit(1);
  }

  const workDir = mkdtempSync(join(tmpdir(), "ade-spike-codex-acp-"));
  const markerPath = join(workDir, "acp-approved.txt");
  execFileSync("git", ["init"], { cwd: workDir, stdio: "ignore" });

  let sawSessionUpdate = false;
  let sawPermissionRequest = false;

  const acpCmd = process.env.ADE_CODEX_ACP_BIN ?? "npx";
  const acpArgs = process.env.ADE_CODEX_ACP_BIN
    ? []
    : ["-y", "@zed-industries/codex-acp"];

  const client = new AcpStdioClient({
    command: acpCmd,
    args: acpArgs,
    cwd: workDir,
    env: { CODEX_HOME: adeCodexHome },
    onUpdate: () => {
      sawSessionUpdate = true;
    },
    onPermissionRequest: async (params) => {
      sawPermissionRequest = true;
      const options = (params.options ?? []) as Array<{ optionId: string; kind?: string }>;
      const allowOpt =
        options.find((o) => o.kind?.startsWith("allow")) ?? options[0];
      return allowOpt ? allowOpt.optionId : "allow";
    }
  });

  try {
    await client.request("initialize", { protocolVersion: 1 });
    const { sessionId } = await client.request<{ sessionId: string }>("session/new", {
      cwd: workDir,
      mcpServers: []
    });

    await client.request("session/prompt", {
      sessionId,
      prompt: [
        {
          type: "text",
          text: `Run a shell command outside sandbox if needed to write the exact string "ACP_OK" into ${markerPath}`
        }
      ]
    });

    const markerCreated =
      existsSync(markerPath) && readFileSync(markerPath, "utf8").includes("ACP_OK");

    console.log(`Check 1 (received session/update): ${sawSessionUpdate ? "PASS" : "FAIL"}`);
    console.log(
      `Check 2 (received session/request_permission): ${sawPermissionRequest ? "PASS" : "FAIL"}`
    );
    console.log(`Check 3 (command executed after allow): ${markerCreated ? "PASS" : "FAIL"}`);

    if (!sawSessionUpdate || !sawPermissionRequest || !markerCreated) {
      process.exit(1);
    }
    console.log("[PASS] real:spike-codex-acp");
  } finally {
    await client.close();
    rmSync(workDir, { recursive: true, force: true });
  }
}

void runSpikeCodexAcp();
