import type { AcpSessionInfo } from "@ade/shared";

export interface AcpSessionPoolOptions {
  maxSessions?: number;
  idleTimeoutMs?: number;
}

export class AcpSessionPool {
  private readonly maxSessions: number;
  private readonly idleTimeoutMs: number;
  private sessions = new Map<string, AcpSessionInfo>();
  private idleTimers = new Map<string, NodeJS.Timeout>();

  constructor(options?: AcpSessionPoolOptions) {
    this.maxSessions = options?.maxSessions ?? 4;
    const envIdle = process.env.ADE_SESSION_IDLE_MS;
    this.idleTimeoutMs =
      options?.idleTimeoutMs ??
      (envIdle ? parseInt(envIdle, 10) : 30 * 60 * 1000);
  }

  public getSessionKey(threadId: string, agentId: string): string {
    return `${threadId}:${agentId}`;
  }

  public getSession(threadId: string, agentId: string): AcpSessionInfo | null {
    const key = this.getSessionKey(threadId, agentId);
    return this.sessions.get(key) ?? null;
  }

  public getActiveOrIdleCount(): number {
    let count = 0;
    for (const s of this.sessions.values()) {
      if (s.status === "active" || s.status === "idle") {
        count++;
      }
    }
    return count;
  }

  public acquireSession(
    threadId: string,
    agentId: string,
    options?: { supportsLoadSession?: boolean }
  ): { session: AcpSessionInfo; isReopened: boolean; needsLoad: boolean } {
    const key = this.getSessionKey(threadId, agentId);
    const existing = this.sessions.get(key);

    // Xóa idle timer nếu có
    if (this.idleTimers.has(key)) {
      clearTimeout(this.idleTimers.get(key)!);
      this.idleTimers.delete(key);
    }

    if (existing && (existing.status === "active" || existing.status === "idle")) {
      existing.status = "active";
      existing.lastUsedAtMs = Date.now();
      return { session: existing, isReopened: false, needsLoad: false };
    }

    // Nếu cần mở phiên mới, kiểm tra giới hạn trần 4 session
    if (this.getActiveOrIdleCount() >= this.maxSessions) {
      // Tìm session idle có lastUsedAtMs cũ nhất (LRU eviction)
      let oldestIdleKey: string | null = null;
      let oldestTime = Infinity;

      for (const [k, s] of this.sessions.entries()) {
        if (s.status === "idle" && s.lastUsedAtMs < oldestTime) {
          oldestTime = s.lastUsedAtMs;
          oldestIdleKey = k;
        }
      }

      if (oldestIdleKey) {
        this.closeSessionByKey(oldestIdleKey);
      } else {
        throw new Error(
          `ERR_MAX_SESSIONS_EXCEEDED: Cả ${this.maxSessions} phiên ACP đều đang bận (active).`
        );
      }
    }

    const wasClosed = Boolean(existing && existing.status === "closed");
    const supportsLoad = options?.supportsLoadSession ?? false;
    const acpSessionId =
      wasClosed && supportsLoad
        ? existing!.acpSessionId
        : `acp_${Math.random().toString(36).slice(2, 10)}`;

    const newSession: AcpSessionInfo = {
      sessionKey: key,
      acpSessionId,
      threadId,
      agentId,
      status: "active",
      supportsLoadSession: supportsLoad,
      lastUsedAtMs: Date.now()
    };

    this.sessions.set(key, newSession);
    return {
      session: newSession,
      isReopened: wasClosed,
      needsLoad: wasClosed && supportsLoad
    };
  }

  public releaseSession(threadId: string, agentId: string): void {
    const key = this.getSessionKey(threadId, agentId);
    const session = this.sessions.get(key);
    if (!session || session.status === "closed") return;

    session.status = "idle";
    session.lastUsedAtMs = Date.now();

    // Hủy timer cũ nếu có
    if (this.idleTimers.has(key)) {
      clearTimeout(this.idleTimers.get(key)!);
    }

    // Lên lịch đóng tự động sau idleTimeoutMs
    const timer = setTimeout(() => {
      this.closeSessionByKey(key);
    }, this.idleTimeoutMs);

    this.idleTimers.set(key, timer);
  }

  public closeSession(threadId: string, agentId: string): void {
    const key = this.getSessionKey(threadId, agentId);
    this.closeSessionByKey(key);
  }

  private closeSessionByKey(key: string): void {
    if (this.idleTimers.has(key)) {
      clearTimeout(this.idleTimers.get(key)!);
      this.idleTimers.delete(key);
    }
    const session = this.sessions.get(key);
    if (session) {
      session.status = "closed";
    }
  }

  public clearAll(): void {
    for (const timer of this.idleTimers.values()) {
      clearTimeout(timer);
    }
    this.idleTimers.clear();
    this.sessions.clear();
  }
}
