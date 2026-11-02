import type { ChildProcessWithoutNullStreams } from "node:child_process";

export interface AcpProcessEntry {
  key: string;
  threadId: string;
  agentId: string;
  acpSessionId: string | null;
  currentRunId: string | null;
  cancelledRunId: string | null;
  proc: ChildProcessWithoutNullStreams;
  lastActivityAt: number;
}

export class AcpProcessPool {
  private readonly entries = new Map<string, AcpProcessEntry>();

  static makeKey(threadId: string, agentId: string): string {
    return `${threadId}::${agentId}`;
  }

  register(
    threadId: string,
    agentId: string,
    runId: string,
    proc: ChildProcessWithoutNullStreams
  ): AcpProcessEntry {
    const key = AcpProcessPool.makeKey(threadId, agentId);
    const entry: AcpProcessEntry = {
      key,
      threadId,
      agentId,
      acpSessionId: null,
      currentRunId: runId,
      cancelledRunId: null,
      proc,
      lastActivityAt: Date.now()
    };
    this.entries.set(key, entry);
    return entry;
  }

  getReusable(threadId: string, agentId: string): AcpProcessEntry | undefined {
    const entry = this.entries.get(AcpProcessPool.makeKey(threadId, agentId));
    if (entry && entry.currentRunId === null && entry.proc.exitCode === null && !entry.proc.killed) {
      return entry;
    }
    return undefined;
  }

  markFinishedTurn(entry: AcpProcessEntry): void {
    entry.currentRunId = null;
    entry.lastActivityAt = Date.now();
  }

  remove(entry: AcpProcessEntry): void {
    entry.currentRunId = null;
    this.entries.delete(entry.key);
  }
}
