#!/usr/bin/env node
import { createInterface } from "node:readline";
import { loadScenarioFromFile } from "./scenario-loader.js";

interface JsonRpcMessage {
  jsonrpc: "2.0";
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string };
}

function resolveScenarioPath(argv: string[]): string {
  const idx = argv.indexOf("--scenario");
  if (idx !== -1 && argv[idx + 1]) {
    return argv[idx + 1];
  }
  if (process.env.ADE_FAKE_SCENARIO) {
    return process.env.ADE_FAKE_SCENARIO;
  }
  throw new Error("Missing --scenario <path> or ADE_FAKE_SCENARIO");
}

function sendJsonRpc(msg: JsonRpcMessage): void {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
}

async function main(): Promise<void> {
  const scenarioPath = resolveScenarioPath(process.argv.slice(2));
  const scenario = loadScenarioFromFile(scenarioPath);

  let nextServerReqId = 1000;
  let activeSessionId = "ses_fake_default";
  const pendingClientResponses = new Map<
    number | string,
    (result: Record<string, unknown>) => void
  >();

  const requestClient = (
    method: string,
    params: Record<string, unknown>
  ): Promise<Record<string, unknown>> => {
    const id = nextServerReqId++;
    return new Promise((resolve) => {
      pendingClientResponses.set(id, resolve);
      sendJsonRpc({ jsonrpc: "2.0", id, method, params });
    });
  };

  const handlePrompt = async (reqId: number | string): Promise<void> => {
    for (const step of scenario.steps) {
      if ("plan" in step) {
        sendJsonRpc({
          jsonrpc: "2.0",
          method: "session/update",
          params: {
            sessionId: activeSessionId,
            update: {
              sessionUpdate: "plan",
              entries: step.plan.map((content) => ({ content, status: "in_progress" }))
            }
          }
        });
      } else if ("tool_call" in step) {
        sendJsonRpc({
          jsonrpc: "2.0",
          method: "session/update",
          params: {
            sessionId: activeSessionId,
            update: {
              sessionUpdate: "tool_call",
              title: step.tool_call.name,
              path: step.tool_call.path ?? null,
              args: step.tool_call.args ?? {}
            }
          }
        });
      } else if ("message" in step) {
        sendJsonRpc({
          jsonrpc: "2.0",
          method: "session/update",
          params: {
            sessionId: activeSessionId,
            update: {
              sessionUpdate: "agent_message_chunk",
              content: { type: "text", text: step.message }
            }
          }
        });
      } else if ("sleep" in step) {
        await new Promise((resolve) => setTimeout(resolve, step.sleep * 1000));
      } else if ("request_permission" in step) {
        const reply = await requestClient("session/request_permission", {
          sessionId: activeSessionId,
          toolCall: {
            title: step.request_permission.tool,
            command: step.request_permission.command ?? null
          },
          options: [
            { optionId: "allow", name: "Allow", kind: "allow_once" },
            { optionId: "deny", name: "Deny", kind: "reject_once" }
          ]
        });
        const outcome = (reply.outcome ?? {}) as { optionId?: string };
        const selected = outcome.optionId ?? "deny";
        if (selected !== step.request_permission.expect) {
          sendJsonRpc({
            jsonrpc: "2.0",
            id: reqId,
            error: {
              code: -32001,
              message: `Expected permission ${step.request_permission.expect}, got ${selected}`
            }
          });
          return;
        }
        if (selected === "deny") {
          sendJsonRpc({
            jsonrpc: "2.0",
            id: reqId,
            result: { stopReason: "cancelled" }
          });
          return;
        }
      } else if ("mcp" in step) {
        sendJsonRpc({
          jsonrpc: "2.0",
          method: "session/update",
          params: {
            sessionId: activeSessionId,
            update: {
              sessionUpdate: "mcp_call",
              tool: step.mcp.tool,
              args: step.mcp.args
            }
          }
        });
      }
    }

    sendJsonRpc({
      jsonrpc: "2.0",
      id: reqId,
      result: { stopReason: "end_turn" }
    });
  };

  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const msg = JSON.parse(trimmed) as JsonRpcMessage;

    if (msg.method === undefined && msg.id !== undefined) {
      const resolver = pendingClientResponses.get(msg.id);
      if (resolver) {
        pendingClientResponses.delete(msg.id);
        resolver((msg.result ?? {}) as Record<string, unknown>);
      }
      return;
    }

    if (msg.method === "initialize" && msg.id !== undefined) {
      sendJsonRpc({
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          protocolVersion: 1,
          agentInfo: { name: "ade-fake-agent", version: "0.1.0" },
          agentCapabilities: {}
        }
      });
    } else if (msg.method === "session/new" && msg.id !== undefined) {
      activeSessionId = `ses_fake_${Date.now()}`;
      sendJsonRpc({
        jsonrpc: "2.0",
        id: msg.id,
        result: { sessionId: activeSessionId }
      });
    } else if (msg.method === "session/prompt" && msg.id !== undefined) {
      void handlePrompt(msg.id);
    }
  });
}

void main();
