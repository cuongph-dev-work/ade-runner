import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AcpStdioClient, LegacyFakeClaudeDriver } from "../src/index.js";

const repoRoot = resolve(import.meta.dirname, "../../..");
const fakeAgentEntry = resolve(repoRoot, "packages/runner/src/fake/ade-fake-agent.ts");
const tsxBin = resolve(repoRoot, "node_modules/.bin/tsx");

describe("ade-fake-agent over ACP stdio & FakeClaudeDriver", () => {
  it("streams updates and permission request in exact YAML order for planner-done.yaml", async () => {
    const scenarioPath = resolve(repoRoot, "tests/scenarios/planner-done.yaml");
    const trace: string[] = [];

    const client = new AcpStdioClient({
      command: tsxBin,
      args: [fakeAgentEntry, "--scenario", scenarioPath],
      onUpdate: (params) => {
        const update = params.update as { sessionUpdate: string; title?: string; tool?: string };
        if (update.sessionUpdate === "tool_call") {
          trace.push(`tool_call:${update.title}`);
        } else if (update.sessionUpdate === "mcp_call") {
          trace.push(`mcp:${update.tool}`);
        } else {
          trace.push(`update:${update.sessionUpdate}`);
        }
      },
      onPermissionRequest: async (params) => {
        const toolCall = params.toolCall as { title: string; command: string };
        trace.push(`permission:${toolCall.title}:${toolCall.command}`);
        return "allow";
      }
    });

    try {
      const initRes = await client.request<{ protocolVersion: number }>("initialize", {
        protocolVersion: 1
      });
      expect(initRes.protocolVersion).toBe(1);

      const sessionRes = await client.request<{ sessionId: string }>("session/new", {
        cwd: repoRoot,
        mcpServers: []
      });
      expect(sessionRes.sessionId).toMatch(/^ses_fake_/);

      const promptRes = await client.request<{ stopReason: string }>("session/prompt", {
        sessionId: sessionRes.sessionId,
        prompt: [{ type: "text", text: "Hãy lập kế hoạch login" }]
      });

      expect(promptRes.stopReason).toBe("end_turn");
      expect(trace).toEqual([
        "update:plan",
        "tool_call:Write",
        "permission:Bash:npm test",
        "mcp:post_progress",
        "mcp:report_outcome"
      ]);
    } finally {
      await client.close();
    }
  });

  it("stops with cancelled when permission-bash.yaml receives deny as expected", async () => {
    const scenarioPath = resolve(repoRoot, "tests/scenarios/permission-bash.yaml");
    const trace: string[] = [];

    const client = new AcpStdioClient({
      command: tsxBin,
      args: [fakeAgentEntry, "--scenario", scenarioPath],
      onUpdate: (params) => {
        const update = params.update as { sessionUpdate: string };
        trace.push(`update:${update.sessionUpdate}`);
      },
      onPermissionRequest: async () => {
        trace.push("permission:deny");
        return "deny";
      }
    });

    try {
      await client.request("initialize", { protocolVersion: 1 });
      const { sessionId } = await client.request<{ sessionId: string }>("session/new", {
        cwd: repoRoot,
        mcpServers: []
      });
      const promptRes = await client.request<{ stopReason: string }>("session/prompt", {
        sessionId,
        prompt: [{ type: "text", text: "Chạy test" }]
      });

      expect(promptRes.stopReason).toBe("cancelled");
      expect(trace).toEqual(["update:plan", "permission:deny"]);
    } finally {
      await client.close();
    }
  });

  it("runs FakeClaudeDriver in identical event order for planner-done.yaml", async () => {
    const scenarioPath = resolve(repoRoot, "tests/scenarios/planner-done.yaml");
    const driver = new LegacyFakeClaudeDriver(scenarioPath);
    const trace: string[] = [];

    const result = await driver.run(
      {
        runId: "run_test_01",
        agentHandle: "@planner",
        cwd: repoRoot,
        prompt: "Lập kế hoạch"
      },
      {
        onEvent: (evt) => {
          trace.push(evt.kind === "mcp_call" ? `mcp:${evt.tool}` : `event:${evt.kind}`);
        },
        onPermissionRequest: async (req) => {
          trace.push(`permission:${req.tool}`);
          return "allow";
        }
      }
    );

    expect(result.stopReason).toBe("end_turn");
    expect(trace).toEqual([
      "event:plan",
      "event:tool_call",
      "permission:Bash",
      "mcp:post_progress",
      "mcp:report_outcome"
    ]);
  });
});
