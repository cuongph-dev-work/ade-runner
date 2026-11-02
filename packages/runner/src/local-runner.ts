import os from "node:os";
import { RunnerMessageSchema, type HarnessType, type RunnerMessage } from "@ade/shared";
import type { HarnessDriver } from "./drivers/types.js";
import type { WorktreeManager } from "./worktree.js";
import { type AdeMode, validateCredentialForMode } from "./isolation.js";

export interface RunnerTransport {
  sendToHub(msg: RunnerMessage): void;
  sendToRunner(msg: RunnerMessage): void;
  onHubReceive(handler: (msg: RunnerMessage) => void): void;
  onRunnerReceive(handler: (msg: RunnerMessage) => void): void;
  disconnectRunner(runnerId: string, reason: string): void;
  onRunnerDisconnect(handler: (runnerId: string, reason: string) => void): void;
}

export class InProcessRunnerTransport implements RunnerTransport {
  private hubHandlers: ((msg: RunnerMessage) => void)[] = [];
  private runnerHandlers: ((msg: RunnerMessage) => void)[] = [];
  private disconnectHandlers: ((runnerId: string, reason: string) => void)[] = [];

  sendToHub(msg: RunnerMessage): void {
    const validated = RunnerMessageSchema.parse(structuredClone(msg));
    for (const h of this.hubHandlers) h(validated);
  }

  sendToRunner(msg: RunnerMessage): void {
    const validated = RunnerMessageSchema.parse(structuredClone(msg));
    for (const h of this.runnerHandlers) h(validated);
  }

  onHubReceive(handler: (msg: RunnerMessage) => void): void {
    this.hubHandlers.push(handler);
  }

  onRunnerReceive(handler: (msg: RunnerMessage) => void): void {
    this.runnerHandlers.push(handler);
  }

  disconnectRunner(runnerId: string, reason: string): void {
    for (const h of this.disconnectHandlers) h(runnerId, reason);
  }

  onRunnerDisconnect(handler: (runnerId: string, reason: string) => void): void {
    this.disconnectHandlers.push(handler);
  }
}

export class LocalRunnerDaemon {
  private readonly runDriverMap = new Map<string, HarnessDriver>();

  constructor(
    private readonly options: {
      runnerId: string;
      machineName?: string;
      mode: AdeMode;
      transport: RunnerTransport;
      worktrees: WorktreeManager;
      claudeDriver: HarnessDriver;
      codexDriver: HarnessDriver;
      harnessesAvailable?: HarnessType[];
    }
  ) {
    this.options.transport.onRunnerReceive((msg) => {
      void this.handleMessage(msg);
    });
  }

  connect(): void {
    this.options.transport.sendToHub({
      type: "runner.hello",
      runnerId: this.options.runnerId,
      machineName: this.options.machineName ?? os.hostname(),
      harnessesAvailable: this.options.harnessesAvailable ?? ["claude-code", "codex"],
      version: "0.1.0"
    });
  }

  disconnect(reason = "shutdown"): void {
    this.options.transport.disconnectRunner(this.options.runnerId, reason);
  }

  private async handleMessage(msg: RunnerMessage): Promise<void> {
    if (msg.type === "run.start") {
      validateCredentialForMode(
        msg.agent.credentialProfile,
        msg.agent.harness,
        this.options.mode
      );
      const wtPath = await this.options.worktrees.resolveRunWorkspace({
        repoPath: msg.repoPath,
        threadId: msg.threadId,
        defaultBranch: msg.defaultBranch,
        writeAllowed: msg.agent.write,
        harness: msg.agent.harness
      });
      const driver =
        msg.agent.harness === "claude-code"
          ? this.options.claudeDriver
          : this.options.codexDriver;
      this.runDriverMap.set(msg.runId, driver);

      void driver.startRun(msg, wtPath, {
        onEvent: (runId, acpSessionId, event) => {
          this.options.transport.sendToHub({
            type: "run.event",
            runId,
            ts: new Date().toISOString(),
            acpSessionId,
            event
          });
        },
        onPermissionRequest: (req) => {
          this.options.transport.sendToHub({
            type: "permission.request",
            ...req
          });
        },
        onEnd: (end) => {
          this.runDriverMap.delete(end.runId);
          this.options.transport.sendToHub({
            type: "run.end",
            ...end
          });
        }
      });
    } else if (msg.type === "permission.reply") {
      const driver = this.runDriverMap.get(msg.runId);
      driver?.replyPermission(msg);
    } else if (msg.type === "run.cancel") {
      const driver = this.runDriverMap.get(msg.runId);
      this.runDriverMap.delete(msg.runId);
      if (driver) {
        await driver.cancelRun(msg.runId, msg.reason);
      }
    }
  }
}
