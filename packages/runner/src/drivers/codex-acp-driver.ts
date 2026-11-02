import { spawn } from "node:child_process";
import crypto from "node:crypto";
import readline from "node:readline";
import type { PermissionOption, PermissionReplyMessage, RunStartMessage } from "@ade/shared";
import type { DriverCallbacks, HarnessDriver } from "./types.js";
import type { IsolationProfileManager } from "../isolation.js";
import type { WorktreeManager } from "../worktree.js";
import { type AcpProcessEntry, AcpProcessPool } from "../acp-process-pool.js";

interface PendingRpc {
  entryKey: string;
  resolve: (result: Record<string, unknown>) => void;
  reject: (err: Error) => void;
}

interface PendingAcpPermission {
  rpcId: number | string;
  entry: AcpProcessEntry;
}

export function normalizeAcpPermissionOptions(rawOpts: unknown[]): PermissionOption[] {
  const candidates = rawOpts.filter(
    (item): item is Record<string, unknown> => Boolean(item && typeof item === "object")
  );
  const allowOnce = candidates.find((o) => o.kind === "allow_once");
  const allowFallback = candidates.find(
    (o) => o.kind === "allow_always" || String(o.decision ?? o.kind ?? "").includes("allow")
  );
  const rejectOnce = candidates.find((o) => o.kind === "reject_once");
  const rejectFallback = candidates.find(
    (o) => o.kind === "reject_always" || String(o.decision ?? o.kind ?? "").includes("reject") || o.decision === "deny"
  );

  const chosenAllow = allowOnce ?? allowFallback;
  const chosenReject = rejectOnce ?? rejectFallback;

  return [
    {
      id: chosenAllow ? String(chosenAllow.optionId ?? chosenAllow.id ?? "allow") : "allow",
      label: "Cho phép",
      decision: "allow"
    },
    {
      id: chosenReject ? String(chosenReject.optionId ?? chosenReject.id ?? "deny") : "deny",
      label: "Từ chối",
      decision: "deny"
    }
  ];
}

export class CodexAcpDriver implements HarnessDriver {
  private rpcSeq = 1;
  private readonly pendingRpcs = new Map<number | string, PendingRpc>();
  private readonly pendingPermissions = new Map<string, PendingAcpPermission>();
  private readonly activeRunEntries = new Map<string, AcpProcessEntry>();

  constructor(
    private readonly isolation: IsolationProfileManager,
    private readonly worktrees: WorktreeManager,
    public readonly pool: AcpProcessPool,
    private readonly options?: { acpBinary?: string; acpArgs?: string[] }
  ) {}

  async startRun(
    msg: RunStartMessage,
    worktreePath: string,
    callbacks: DriverCallbacks
  ): Promise<void> {
    await this.isolation.prepareCodexConfigToml({
      model: msg.agent.model,
      mcpUrl: msg.mcpUrl,
      mcpToken: msg.mcpToken,
      writeAllowed: msg.agent.write
    });
    await this.worktrees.syncCodexWorktreeSkills(msg.repoPath, worktreePath, msg.skills);

    const env = this.isolation.buildCodexEnv(msg.agent.credentialProfile);
    if (msg.agent.scenarioFile) {
      env.ADE_FAKE_SCENARIO = msg.agent.scenarioFile;
    }

    let entry = this.pool.getReusable(msg.threadId, msg.agent.id);
    if (entry) {
      entry.currentRunId = msg.runId;
      entry.cancelledRunId = null;
    } else {
      const bin = this.options?.acpBinary ?? process.env.ADE_CODEX_ACP_BIN ?? "codex-acp";
      const args = this.options?.acpArgs ?? [];
      const proc = spawn(bin, args, {
        cwd: worktreePath,
        env,
        stdio: ["pipe", "pipe", "pipe"]
      });
      entry = this.pool.register(msg.threadId, msg.agent.id, msg.runId, proc);
      this.attachProcessListeners(entry, callbacks);

      try {
        await this.sendRpc(entry, "initialize", {
          protocolVersion: 1,
          clientInfo: { name: "ade-runner", version: "0.1.0" }
        });
        const mcpServers =
          msg.mcpUrl !== null && msg.mcpToken !== null
            ? [
                {
                  name: "ade",
                  type: "http",
                  url: msg.mcpUrl,
                  headers: [{ name: "Authorization", value: `Bearer ${msg.mcpToken}` }]
                }
              ]
            : [];
        const newSessionRes = await this.sendRpc(entry, "session/new", {
          cwd: worktreePath,
          mcpServers
        });
        entry.acpSessionId = String(newSessionRes.sessionId ?? `acp_${msg.runId}`);
      } catch (err) {
        const wasCancelled = entry.cancelledRunId === msg.runId;
        this.pool.remove(entry);
        proc.kill("SIGTERM");
        if (!wasCancelled) {
          callbacks.onEnd({
            runId: msg.runId,
            stopReason: "error",
            errorCode: "ERR_DRIVER_EXECUTION",
            errorMessage: err instanceof Error ? err.message : String(err),
            acpSessionId: null,
            usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 }
          });
        }
        return;
      }
    }

    this.activeRunEntries.set(msg.runId, entry);

    try {
      const fullPrompt = msg.context ? `${msg.context}\n\n${msg.prompt}` : msg.prompt;
      const promptRes = await this.sendRpc(entry, "session/prompt", {
        sessionId: entry.acpSessionId,
        prompt: [{ type: "text", text: fullPrompt }]
      });

      if (entry.cancelledRunId === msg.runId) {
        return;
      }

      const usageObj = (promptRes.usage as Record<string, number> | undefined) ?? {};
      if (entry.proc.exitCode === null) {
        this.pool.markFinishedTurn(entry);
      } else {
        this.pool.remove(entry);
      }
      callbacks.onEnd({
        runId: msg.runId,
        stopReason: promptRes.stopReason === "max_tokens" ? "max_tokens" : "end_turn",
        errorCode: null,
        errorMessage: null,
        acpSessionId: entry.acpSessionId,
        usage: {
          inputTokens: usageObj.inputTokens ?? 0,
          outputTokens: usageObj.outputTokens ?? 0,
          costUsd: usageObj.costUsd ?? 0
        }
      });
    } catch (err) {
      const wasCancelled = entry.cancelledRunId === msg.runId;
      this.pool.remove(entry);
      if (!wasCancelled) {
        callbacks.onEnd({
          runId: msg.runId,
          stopReason: "error",
          errorCode: "ERR_DRIVER_EXECUTION",
          errorMessage: err instanceof Error ? err.message : String(err),
          acpSessionId: entry.acpSessionId,
          usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 }
        });
      }
    } finally {
      this.activeRunEntries.delete(msg.runId);
    }
  }

  private attachProcessListeners(entry: AcpProcessEntry, callbacks: DriverCallbacks): void {
    const proc = entry.proc;
    const rl = readline.createInterface({ input: proc.stdout });
    rl.on("line", (line) => {
      if (!line.trim()) return;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(line) as Record<string, unknown>;
      } catch {
        return;
      }

      if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
        const pending = this.pendingRpcs.get(msg.id as number | string);
        if (pending) {
          this.pendingRpcs.delete(msg.id as number | string);
          if (msg.error) {
            const errObj = msg.error as { message?: string };
            pending.reject(new Error(errObj.message ?? "ACP JSON-RPC error"));
          } else {
            pending.resolve((msg.result as Record<string, unknown>) ?? {});
          }
        }
        return;
      }

      const runId = entry.currentRunId;
      if (!runId || entry.cancelledRunId === runId) return;

      if (msg.method === "session/update" && msg.params && typeof msg.params === "object") {
        const params = msg.params as { update?: Record<string, unknown> };
        const update = params.update ?? (msg.params as Record<string, unknown>);
        const kind = update.sessionUpdate;
        if (kind === "plan" && Array.isArray(update.entries)) {
          callbacks.onEvent(runId, entry.acpSessionId, {
            kind: "plan",
            data: {
              items: update.entries.map((e: Record<string, unknown>, idx: number) => ({
                id: String(e.id ?? `p_${idx + 1}`),
                text: String(e.content ?? e.text ?? ""),
                status:
                  e.status === "completed" || e.status === "in_progress" ? e.status : "pending"
              }))
            }
          });
        } else if (kind === "tool_call" || kind === "tool_call_update") {
          const callId = String(update.toolCallId ?? update.callId ?? "call_1");
          const tool = String(update.title ?? update.tool ?? "Tool");
          const rawStatus = String(update.status ?? "completed");
          const status =
            rawStatus === "failed"
              ? "failed"
              : rawStatus === "in_progress" || rawStatus === "running"
                ? "running"
                : "completed";
          const suffix = status === "completed" ? " ✓" : "";
          callbacks.onEvent(runId, entry.acpSessionId, {
            kind: "tool_call",
            data: {
              callId,
              tool,
              summary: `${tool}${suffix}`,
              status
            }
          });
        } else if (kind === "agent_message_chunk") {
          const content =
            (update.content as { text?: string } | undefined)?.text ?? String(update.text ?? "");
          callbacks.onEvent(runId, entry.acpSessionId, {
            kind: "message_chunk",
            data: { textDelta: content }
          });
        } else if (kind === "step") {
          callbacks.onEvent(runId, entry.acpSessionId, {
            kind: "step",
            data: {
              text: String(update.text ?? ""),
              step: typeof update.step === "number" ? update.step : null,
              percent: typeof update.percent === "number" ? update.percent : null
            }
          });
        }
      } else if (msg.method === "session/request_permission" && msg.id !== undefined) {
        const params = (msg.params as Record<string, unknown>) ?? {};
        const toolCall = (params.toolCall as Record<string, unknown>) ?? {};
        const tool = String(toolCall.title ?? params.tool ?? "Bash");
        const cmd = String(toolCall.command ?? params.command ?? "");
        const requestId = `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 26)}`;
        const rawOpts = Array.isArray(params.options) ? params.options : [];
        const options = normalizeAcpPermissionOptions(rawOpts);

        this.pendingPermissions.set(requestId, { rpcId: msg.id as number | string, entry });
        callbacks.onPermissionRequest({
          runId,
          requestId,
          tool,
          args: cmd ? { command: cmd } : {},
          displayCommand: cmd ? `${tool}: ${cmd}` : tool,
          options
        });
      }
    });

    proc.on("exit", (code) => {
      this.pool.remove(entry);
      for (const [rpcId, pending] of this.pendingRpcs.entries()) {
        if (pending.entryKey === entry.key) {
          this.pendingRpcs.delete(rpcId);
          pending.reject(new Error(`ACP process exited unexpectedly with code ${String(code)}`));
        }
      }
    });
  }

  private sendRpc(
    entry: AcpProcessEntry,
    method: string,
    params: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (entry.proc.exitCode !== null || entry.proc.killed) {
      return Promise.reject(new Error("ACP process is not running"));
    }
    const id = this.rpcSeq++;
    const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    return new Promise((resolve, reject) => {
      this.pendingRpcs.set(id, { entryKey: entry.key, resolve, reject });
      entry.proc.stdin.write(`${payload}\n`, (err) => {
        if (err) {
          this.pendingRpcs.delete(id);
          reject(err);
        }
      });
    });
  }

  replyPermission(reply: PermissionReplyMessage): void {
    const pending = this.pendingPermissions.get(reply.requestId);
    if (!pending || pending.entry.proc.exitCode !== null) return;
    this.pendingPermissions.delete(reply.requestId);
    const response = JSON.stringify({
      jsonrpc: "2.0",
      id: pending.rpcId,
      result: {
        outcome: {
          outcome: "selected",
          optionId: reply.optionId
        }
      }
    });
    pending.entry.proc.stdin.write(`${response}\n`);
  }

  async cancelRun(runId: string): Promise<void> {
    const entry = this.activeRunEntries.get(runId);
    if (!entry) return;
    entry.cancelledRunId = runId;
    this.pool.remove(entry);
    for (const [rpcId, pending] of this.pendingRpcs.entries()) {
      if (pending.entryKey === entry.key) {
        this.pendingRpcs.delete(rpcId);
        pending.reject(new Error(`Run ${runId} cancelled`));
      }
    }
    if (entry.proc.exitCode === null) {
      entry.proc.kill("SIGTERM");
      setTimeout(() => {
        if (entry.proc.exitCode === null) {
          entry.proc.kill("SIGKILL");
        }
      }, 2000).unref();
    }
  }
}
