import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { IsolationProfileManager, validateCredentialForMode } from "../src/isolation.js";
import { normalizeAcpPermissionOptions } from "../src/drivers/codex-acp-driver.js";
import { AcpProcessPool } from "../src/acp-process-pool.js";

describe("packages/runner isolation, ACP options & process pool", () => {
  it("chặn sub-* ở ADE_MODE=vps (AC-API-RN-01-15)", () => {
    expect(() => validateCredentialForMode("sub-chatgpt", "codex", "vps")).toThrowError(
      /Hồ sơ xác thực/
    );
    expect(() => validateCredentialForMode("sub-claude", "claude-code", "solo")).not.toThrow();
  });

  it("sinh config.toml tắt skill cá nhân trong ~/.agents/skills và ẩn [mcp_servers.ade] khi mcpUrl = null (AC-API-RN-01-14)", async () => {
    const tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "ade-home-"));
    const canarySkill = path.join(tmpHome, ".agents", "skills", "canary-personal");
    await fs.mkdir(canarySkill, { recursive: true });
    await fs.writeFile(path.join(canarySkill, "SKILL.md"), "canary", "utf8");

    const mgr = new IsolationProfileManager({
      devHomeDir: tmpHome,
      adeRootDir: path.join(tmpHome, ".ade")
    });
    const tomlP2 = await mgr.prepareCodexConfigToml({
      model: "gpt-5-codex",
      mcpUrl: null,
      mcpToken: null,
      writeAllowed: true
    });
    const contentP2 = await fs.readFile(tomlP2, "utf8");
    expect(contentP2).toContain("[[skills.config]]");
    expect(contentP2).toContain("canary-personal");
    expect(contentP2).toContain("enabled = false");
    expect(contentP2).not.toContain("[mcp_servers.ade]");
  });

  it("chuẩn hoá options ACP allow_once/reject_once giữ nguyên optionId gốc (AC-API-RN-01-05, AC-API-RN-01-06)", () => {
    const normalized = normalizeAcpPermissionOptions([
      { optionId: "acp_allow_once", kind: "allow_once", name: "Allow once" },
      { optionId: "acp_allow_always", kind: "allow_always", name: "Allow always" },
      { optionId: "acp_reject_once", kind: "reject_once", name: "Reject once" }
    ]);
    expect(normalized).toEqual([
      { id: "acp_allow_once", label: "Cho phép", decision: "allow" },
      { id: "acp_reject_once", label: "Từ chối", decision: "deny" }
    ]);
  });

  it("quản lý tái sử dụng và xoá tiến trình theo cặp (threadId, agentId) trong AcpProcessPool (AC-API-RN-01-10)", () => {
    const pool = new AcpProcessPool();
    const fakeProc = { exitCode: null, killed: false } as never;
    const entry = pool.register("thr_01", "agt_codex", "run_01", fakeProc);
    expect(pool.getReusable("thr_01", "agt_codex")).toBeUndefined();
    pool.markFinishedTurn(entry);
    expect(pool.getReusable("thr_01", "agt_codex")).toBe(entry);
    pool.remove(entry);
    expect(pool.getReusable("thr_01", "agt_codex")).toBeUndefined();
  });
});
