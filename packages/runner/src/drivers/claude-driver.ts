import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import YAML from "yaml";
import type { PermissionReplyMessage, RunStartMessage } from "@ade/shared";
import type { DriverCallbacks, HarnessDriver } from "./types.js";
import type { IsolationProfileManager } from "../isolation.js";

interface PendingPermission {
  resolve: (reply: PermissionReplyMessage) => void;
  reject: (err: Error) => void;
}

export type ClaudeSdkQueryFn = (params: {
  prompt: string;
  options: Record<string, unknown>;
}) => AsyncIterable<Record<string, unknown>>;

export class ClaudeSdkDriver implements HarnessDriver {
  private readonly abortControllers = new Map<string, AbortController>();
  private readonly cancelledRuns = new Set<string>();
  private readonly pendingPermissions = new Map<string, PendingPermission & { runId: string }>();
  private readonly lastSessionByAgent = new Map<string, { sessionId: string; cwd: string }>();

  constructor(
    private readonly isolation: IsolationProfileManager,
    private readonly sdkQuery: ClaudeSdkQueryFn
  ) {}

  async startRun(
    msg: RunStartMessage,
    worktreePath: string,
    callbacks: DriverCallbacks
  ): Promise<void> {
    const abortController = new AbortController();
    this.abortControllers.set(msg.runId, abortController);
    const pluginDir = await this.isolation.createTempClaudePlugin(msg.runId, msg.skills);
    const env = this.isolation.buildClaudeEnv(msg.agent.credentialProfile);
    const pairKey = `${msg.threadId}::${msg.agent.id}`;
    const prevSession = this.lastSessionByAgent.get(pairKey);

    let sessionId: string | null =
      prevSession && prevSession.cwd === worktreePath
        ? (msg.resumeSessionId ?? prevSession.sessionId)
        : null;
    let inputTokens = 0;
    let outputTokens = 0;
    let costUsd = 0;

    try {
      const fullPrompt = msg.context ? `${msg.context}\n\n${msg.prompt}` : msg.prompt;
      const mcpServers =
        msg.mcpUrl !== null && msg.mcpToken !== null
          ? {
              ade: {
                type: "http",
                url: msg.mcpUrl,
                headers: { Authorization: `Bearer ${msg.mcpToken}` }
              }
            }
          : {};

      const stream = this.sdkQuery({
        prompt: fullPrompt,
        options: {
          cwd: worktreePath,
          env,
          abortController,
          strictMcpConfig: true,
          settingSources: msg.useRepoInstructions ? ["project"] : [],
          systemPrompt: msg.agent.role || undefined,
          model: msg.agent.model ?? undefined,
          resume: sessionId ?? undefined,
          plugins: [{ type: "local", path: pluginDir }],
          skills: msg.skills.map((s) => s.name),
          disallowedTools: msg.agent.write ? undefined : ["Write", "Edit", "MultiEdit", "NotebookEdit"],
          mcpServers,
          canUseTool: async (toolName: string, input: Record<string, unknown>) => {
            if (!msg.agent.write && ["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(toolName)) {
              return {
                behavior: "deny",
                message: "Agent chỉ đọc (write = false) không được phép sửa tệp tin."
              };
            }
            const requestId = `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 26)}`;
            const cmdPreview =
              typeof input.command === "string"
                ? `${toolName}: ${input.command}`
                : `${toolName}: ${JSON.stringify(input).slice(0, 120)}`;
            const reply = await new Promise<PermissionReplyMessage>((resolve, reject) => {
              this.pendingPermissions.set(requestId, { runId: msg.runId, resolve, reject });
              callbacks.onPermissionRequest({
                runId: msg.runId,
                requestId,
                tool: toolName,
                args: input,
                displayCommand: cmdPreview,
                options: [
                  { id: "allow", label: "Cho phép", decision: "allow" },
                  { id: "deny", label: "Từ chối", decision: "deny" }
                ]
              });
            });
            if (reply.decision === "allow") {
              return { behavior: "allow", updatedInput: input };
            }
            return {
              behavior: "deny",
              message: "Người dùng đã từ chối cấp quyền thực thi công cụ."
            };
          }
        }
      });

      for await (const rawItem of stream) {
        if (typeof rawItem.session_id === "string") {
          sessionId = rawItem.session_id;
        }
        if (rawItem.type === "assistant" && rawItem.message && typeof rawItem.message === "object") {
          const content = (rawItem.message as { content?: unknown[] }).content ?? [];
          for (const block of content) {
            if (!block || typeof block !== "object") continue;
            const b = block as Record<string, unknown>;
            if (b.type === "text" && typeof b.text === "string") {
              callbacks.onEvent(msg.runId, sessionId, {
                kind: "message_chunk",
                data: { textDelta: b.text }
              });
            } else if (b.type === "tool_use" && typeof b.name === "string") {
              const callId = typeof b.id === "string" ? b.id : `call_${Date.now()}`;
              const inputObj = (b.input as Record<string, unknown>) ?? {};
              if (b.name === "TodoWrite" && Array.isArray(inputObj.todos)) {
                callbacks.onEvent(msg.runId, sessionId, {
                  kind: "plan",
                  data: {
                    items: inputObj.todos.map((t: Record<string, unknown>, idx: number) => ({
                      id: String(t.id ?? `p_${idx + 1}`),
                      text: String(t.content ?? t.text ?? ""),
                      status:
                        t.status === "completed" || t.status === "in_progress"
                          ? t.status
                          : "pending"
                    }))
                  }
                });
              } else {
                const target = String(inputObj.file_path ?? inputObj.path ?? inputObj.command ?? "");
                callbacks.onEvent(msg.runId, sessionId, {
                  kind: "tool_call",
                  data: {
                    callId,
                    tool: b.name,
                    summary: `${b.name} ${target}`.trim(),
                    status: "running"
                  }
                });
              }
            }
          }
        } else if (rawItem.type === "result") {
          const usage = (rawItem.usage as Record<string, number> | undefined) ?? {};
          inputTokens = usage.input_tokens ?? 0;
          outputTokens = usage.output_tokens ?? 0;
          costUsd = typeof rawItem.total_cost_usd === "number" ? rawItem.total_cost_usd : 0;
        }
      }

      if (this.cancelledRuns.has(msg.runId) || abortController.signal.aborted) {
        return;
      }

      if (sessionId) {
        this.lastSessionByAgent.set(pairKey, { sessionId, cwd: worktreePath });
      }

      callbacks.onEnd({
        runId: msg.runId,
        stopReason: "end_turn",
        errorCode: null,
        errorMessage: null,
        acpSessionId: sessionId,
        usage: { inputTokens, outputTokens, costUsd }
      });
    } catch (err) {
      if (this.cancelledRuns.has(msg.runId) || abortController.signal.aborted) {
        return;
      }
      callbacks.onEnd({
        runId: msg.runId,
        stopReason: "error",
        errorCode: "ERR_DRIVER_EXECUTION",
        errorMessage: err instanceof Error ? err.message : String(err),
        acpSessionId: sessionId,
        usage: { inputTokens, outputTokens, costUsd }
      });
    } finally {
      this.cancelledRuns.delete(msg.runId);
      this.abortControllers.delete(msg.runId);
      await this.isolation.cleanupRunArtifacts(msg.runId);
    }
  }

  replyPermission(reply: PermissionReplyMessage): void {
    const pending = this.pendingPermissions.get(reply.requestId);
    if (pending) {
      this.pendingPermissions.delete(reply.requestId);
      pending.resolve(reply);
    }
  }

  async cancelRun(runId: string): Promise<void> {
    this.cancelledRuns.add(runId);
    const controller = this.abortControllers.get(runId);
    if (controller) {
      controller.abort();
    }
    for (const [reqId, pending] of this.pendingPermissions.entries()) {
      if (pending.runId === runId) {
        this.pendingPermissions.delete(reqId);
        pending.reject(new Error(`Run ${runId} cancelled`));
      }
    }
  }
}

export class FakeClaudeDriver implements HarnessDriver {
  private readonly cancelledRuns = new Set<string>();
  private readonly pendingPermissions = new Map<string, PendingPermission & { runId: string }>();

  constructor(private readonly options?: { scenarioMap?: Record<string, string> }) {}

  async startRun(
    msg: RunStartMessage,
    _worktreePath: string,
    callbacks: DriverCallbacks
  ): Promise<void> {
    let scenarioPath = this.options?.scenarioMap?.[msg.agent.handle] ?? msg.agent.scenarioFile;
    if (scenarioPath && !path.isAbsolute(scenarioPath)) {
      scenarioPath = path.resolve(process.cwd(), scenarioPath);
    }
    if (!scenarioPath || !fsSync.existsSync(scenarioPath)) {
      callbacks.onEvent(msg.runId, `fake_claude_${msg.runId}`, {
        kind: "message_chunk",
        data: { textDelta: `FakeClaudeDriver hoàn tất cho ${msg.agent.handle}` }
      });
      callbacks.onEnd({
        runId: msg.runId,
        stopReason: "end_turn",
        errorCode: null,
        errorMessage: null,
        acpSessionId: `fake_claude_${msg.runId}`,
        usage: { inputTokens: 20, outputTokens: 15, costUsd: 0.001 }
      });
      return;
    }

    const raw = await fs.readFile(scenarioPath, "utf8");
    let doc = YAML.parse(raw) as {
      steps?: Record<string, unknown>[];
      scenario?: string;
      scenario_file?: string;
      cost_usd?: number;
    };
    if (!doc.steps && (doc.scenario || doc.scenario_file)) {
      const actualFile = doc.scenario ?? doc.scenario_file!;
      const actualPath = path.isAbsolute(actualFile)
        ? actualFile
        : path.resolve(path.dirname(scenarioPath), actualFile);
      if (fsSync.existsSync(actualPath)) {
        const rawActual = await fs.readFile(actualPath, "utf8");
        doc = YAML.parse(rawActual);
      }
    }
    const sessionId = `fake_claude_${msg.runId}`;
    let callCounter = 0;

    for (const step of doc.steps ?? []) {
      if (this.cancelledRuns.has(msg.runId)) {
        this.cancelledRuns.delete(msg.runId);
        return;
      }

      if (Array.isArray(step.plan)) {
        callbacks.onEvent(msg.runId, sessionId, {
          kind: "plan",
          data: {
            items: step.plan.map((text, idx) => ({
              id: `p_${idx + 1}`,
              text: String(text),
              status: "completed" as const
            }))
          }
        });
      } else if (step.tool_call && typeof step.tool_call === "object") {
        callCounter += 1;
        const tc = step.tool_call as { name: string; path?: string; command?: string };
        const target = tc.path ?? tc.command ?? "";
        callbacks.onEvent(msg.runId, sessionId, {
          kind: "tool_call",
          data: {
            callId: `tc_${callCounter}`,
            tool: tc.name,
            summary: `${tc.name} ${target} ✓`.trim(),
            status: "completed"
          }
        });
      } else if (step.step && typeof step.step === "object") {
        const st = step.step as { text: string; index?: number; percent?: number };
        callbacks.onEvent(msg.runId, sessionId, {
          kind: "step",
          data: { text: st.text, step: st.index ?? null, percent: st.percent ?? null }
        });
      } else if (typeof step.message === "string") {
        callbacks.onEvent(msg.runId, sessionId, {
          kind: "message_chunk",
          data: { textDelta: step.message }
        });
      } else if (step.request_permission && typeof step.request_permission === "object") {
        const rp = step.request_permission as { tool: string; command: string };
        const requestId = `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 26)}`;
        let reply: PermissionReplyMessage;
        try {
          reply = await new Promise<PermissionReplyMessage>((resolve, reject) => {
            this.pendingPermissions.set(requestId, { runId: msg.runId, resolve, reject });
            callbacks.onPermissionRequest({
              runId: msg.runId,
              requestId,
              tool: rp.tool,
              args: { command: rp.command },
              displayCommand: `${rp.tool}: ${rp.command}`,
              options: [
                { id: "allow", label: "Cho phép", decision: "allow" },
                { id: "deny", label: "Từ chối", decision: "deny" }
              ]
            });
          });
        } catch {
          this.cancelledRuns.delete(msg.runId);
          return;
        }
        if (reply.decision === "deny") {
          callbacks.onEvent(msg.runId, sessionId, {
            kind: "message_chunk",
            data: { textDelta: "Đã dừng thực thi công cụ do người dùng từ chối." }
          });
          callbacks.onEnd({
            runId: msg.runId,
            stopReason: "end_turn",
            errorCode: null,
            errorMessage: null,
            acpSessionId: sessionId,
            usage: { inputTokens: 15, outputTokens: 15, costUsd: doc.cost_usd ?? 0.001 }
          });
          return;
        }
      } else if (typeof step.wait_ms === "number") {
        await new Promise((r) => setTimeout(r, step.wait_ms as number));
      }
    }

    if (this.cancelledRuns.has(msg.runId)) {
      this.cancelledRuns.delete(msg.runId);
      return;
    }

    callbacks.onEnd({
      runId: msg.runId,
      stopReason: "end_turn",
      errorCode: null,
      errorMessage: null,
      acpSessionId: sessionId,
      usage: { inputTokens: 30, outputTokens: 25, costUsd: doc.cost_usd ?? 0.002 }
    });
  }

  replyPermission(reply: PermissionReplyMessage): void {
    const pending = this.pendingPermissions.get(reply.requestId);
    if (pending) {
      this.pendingPermissions.delete(reply.requestId);
      pending.resolve(reply);
    }
  }

  async cancelRun(runId: string): Promise<void> {
    this.cancelledRuns.add(runId);
    for (const [reqId, pending] of this.pendingPermissions.entries()) {
      if (pending.runId === runId) {
        this.pendingPermissions.delete(reqId);
        pending.reject(new Error(`Cancelled ${runId}`));
      }
    }
  }
}
