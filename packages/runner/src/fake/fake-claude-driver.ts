import type {
  DriverRunCallbacks,
  DriverRunInput,
  DriverRunResult,
  LegacyHarnessDriver
} from "../driver.js";
import { loadScenarioFromFile } from "./scenario-loader.js";

export class LegacyFakeClaudeDriver implements LegacyHarnessDriver {
  public readonly name = "claude" as const;

  constructor(private readonly scenarioPath: string) {}

  async run(
    input: DriverRunInput,
    callbacks: DriverRunCallbacks
  ): Promise<DriverRunResult> {
    const scenario = loadScenarioFromFile(this.scenarioPath);
    const sessionId = `claude_fake_${input.runId}`;
    let permissionIndex = 0;

    for (const step of scenario.steps) {
      if (input.signal?.aborted) {
        return { sessionId, stopReason: "cancelled", costUsd: 0 };
      }

      if ("plan" in step) {
        await callbacks.onEvent({ kind: "plan", entries: step.plan });
      } else if ("tool_call" in step) {
        await callbacks.onEvent({
          kind: "tool_call",
          name: step.tool_call.name,
          path: step.tool_call.path,
          args: step.tool_call.args
        });
      } else if ("message" in step) {
        await callbacks.onEvent({ kind: "message_chunk", text: step.message });
      } else if ("sleep" in step) {
        await new Promise((resolve) => setTimeout(resolve, step.sleep * 1000));
      } else if ("request_permission" in step) {
        permissionIndex += 1;
        const decision = await callbacks.onPermissionRequest({
          requestId: `perm_${permissionIndex}`,
          tool: step.request_permission.tool,
          command: step.request_permission.command,
          args: step.request_permission.args,
          options: [
            { optionId: "allow", name: "Allow" },
            { optionId: "deny", name: "Deny" }
          ]
        });
        if (decision !== step.request_permission.expect) {
          return { sessionId, stopReason: "permission_mismatch", costUsd: 0.001 };
        }
        if (decision === "deny") {
          return { sessionId, stopReason: "cancelled", costUsd: 0.001 };
        }
      } else if ("mcp" in step) {
        await callbacks.onEvent({
          kind: "mcp_call",
          tool: step.mcp.tool,
          args: step.mcp.args
        });
        if (callbacks.onMcpCall) {
          await callbacks.onMcpCall(step.mcp.tool, step.mcp.args);
        }
      }
    }

    return { sessionId, stopReason: "end_turn", costUsd: 0.002 };
  }
}
