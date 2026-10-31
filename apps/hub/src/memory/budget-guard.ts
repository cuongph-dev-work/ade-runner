import { ulid } from "ulid";
import type Database from "better-sqlite3";
import type { InMemoryEventBus } from "../events/event-bus.js";
import type { RunnerTransport } from "@ade/runner";

export class BudgetGuard {
  private warnedScopes = new Set<string>();

  constructor(
    private deps: {
      sqlite: Database.Database;
      eventBus: InMemoryEventBus;
      runnerTransport: RunnerTransport;
      appendEvent: (env: any) => any;
      releaseThreadLock?: (threadId: string, runId: string) => void;
    }
  ) {}

  public handleUsageUpdate(params: {
    runId: string;
    costUsd: number;
    tokensIn?: number;
    tokensOut?: number;
  }): { exceeded: boolean; reason?: string } {
    const run = this.deps.sqlite
      .prepare(
        `SELECT r.id, r.project_id, r.thread_id, r.agent_id, r.status, r.cost_usd,
                a.handle AS agent_handle, a.budget_usd AS agent_budget,
                t.budget_usd AS thread_budget, t.spent_usd AS thread_spent
         FROM runs r
         JOIN agents a ON r.agent_id = a.id
         JOIN threads t ON r.thread_id = t.id
         WHERE r.id = ?`
      )
      .get(params.runId) as
      | {
          id: string;
          project_id: string;
          thread_id: string;
          agent_id: string;
          status: string;
          cost_usd: number;
          agent_handle: string;
          agent_budget: number | null;
          thread_budget: number | null;
          thread_spent: number;
        }
      | undefined;

    if (!run || ["completed", "failed", "cancelled"].includes(run.status)) {
      return { exceeded: false };
    }

    const currentCost = Number(params.costUsd ?? 0);
    const nowIso = new Date().toISOString();

    // Cập nhật runs.cost_usd
    this.deps.sqlite
      .prepare("UPDATE runs SET cost_usd = ? WHERE id = ?")
      .run(currentCost, run.id);

    // Ghi event append-only run.usage_updated
    this.deps.appendEvent({
      id: `evt_${ulid()}`,
      seq: 0,
      type: "run.usage_updated",
      project_id: run.project_id,
      thread_id: run.thread_id,
      run_id: run.id,
      actor: { type: "system", id: "ade_budget" },
      payload: {
        run_id: run.id,
        cost_usd: currentCost,
        tokens_in: params.tokensIn ?? 0,
        tokens_out: params.tokensOut ?? 0
      },
      ts: nowIso
    });

    // 1. Kiểm tra cấp Agent
    if (run.agent_budget !== null && run.agent_budget > 0) {
      const agentRatio = (run.agent_budget - currentCost) / run.agent_budget;
      const warnKey = `agent:${run.id}`;

      if (agentRatio <= 0.2 && agentRatio >= 0 && !this.warnedScopes.has(warnKey)) {
        this.warnedScopes.add(warnKey);
        this.emitBudgetWarning("agent", run.id, run.project_id, run.thread_id, currentCost, run.agent_budget, agentRatio, nowIso);
      }

      if (currentCost > run.agent_budget) {
        this.terminateRunOnBudgetExceeded(run, "agent", currentCost, run.agent_budget, nowIso);
        return { exceeded: true, reason: "budget_exceeded" };
      }
    }

    // 2. Kiểm tra cấp Thread
    const liveThreadSpent = Number(run.thread_spent ?? 0) + currentCost;
    if (run.thread_budget !== null && run.thread_budget > 0) {
      const threadRatio = (run.thread_budget - liveThreadSpent) / run.thread_budget;
      const warnKey = `thread:${run.thread_id}`;

      if (threadRatio <= 0.2 && threadRatio >= 0 && !this.warnedScopes.has(warnKey)) {
        this.warnedScopes.add(warnKey);
        this.emitBudgetWarning("thread", run.id, run.project_id, run.thread_id, liveThreadSpent, run.thread_budget, threadRatio, nowIso);
      }

      if (liveThreadSpent > run.thread_budget) {
        this.terminateRunOnBudgetExceeded(run, "thread", liveThreadSpent, run.thread_budget, nowIso);
        return { exceeded: true, reason: "budget_exceeded" };
      }
    }

    return { exceeded: false };
  }

  private emitBudgetWarning(
    scope: "agent" | "thread",
    runId: string,
    projectId: string,
    threadId: string,
    spentUsd: number,
    budgetUsd: number,
    remainingRatio: number,
    nowIso: string
  ): void {
    const payload = {
      scope,
      run_id: runId,
      spent_usd: spentUsd,
      budget_usd: budgetUsd,
      remaining_ratio: remainingRatio
    };

    this.deps.appendEvent({
      id: `evt_${ulid()}`,
      seq: 0,
      type: "budget.warning",
      project_id: projectId,
      thread_id: threadId,
      run_id: runId,
      actor: { type: "system", id: "ade_budget" },
      payload,
      ts: nowIso
    });

    this.deps.eventBus.publish({
      type: "budget.warning",
      projectId,
      threadId,
      data: payload
    } as any);
  }

  private terminateRunOnBudgetExceeded(
    run: {
      id: string;
      project_id: string;
      thread_id: string;
      cost_usd: number;
    },
    scope: "agent" | "thread",
    spentUsd: number,
    budgetUsd: number,
    nowIso: string
  ): void {
    // 1. Gửi huỷ xuống Runner
    try {
      this.deps.runnerTransport.sendToRunner({
        type: "run.cancel",
        runId: run.id,
        reason: "budget_exceeded"
      });
    } catch {
      // Ignore
    }

    // 2. Nhả khoá ghi nếu có
    if (this.deps.releaseThreadLock) {
      this.deps.releaseThreadLock(run.thread_id, run.id);
    }

    // 3. Ghi event run.failed (Projector sẽ cập nhật runs.status và threads.spent_usd)
    this.deps.appendEvent({
      id: `evt_${ulid()}`,
      seq: 0,
      type: "run.failed",
      project_id: run.project_id,
      thread_id: run.thread_id,
      run_id: run.id,
      actor: { type: "system", id: "ade_budget" },
      payload: {
        run_id: run.id,
        stop_reason: "budget_exceeded",
        error_code: "ERR_BUDGET_EXCEEDED",
        cost_usd: run.cost_usd
      },
      ts: nowIso
    });

    // 4. Đăng thông báo system vào thread qua event message.posted
    const msgId = `msg_sys_${ulid().toLowerCase()}`;
    const body = `Cảnh báo: Tiến trình đã bị dừng cưỡng bức do vượt trần ngân sách cấp ${scope === "agent" ? "Agent" : "Thread"} (đã tiêu $${spentUsd.toFixed(2)} / trần $${budgetUsd.toFixed(2)}).`;

    this.deps.appendEvent({
      id: `evt_${ulid()}`,
      seq: 0,
      type: "message.posted",
      project_id: run.project_id,
      thread_id: run.thread_id,
      run_id: run.id,
      actor: { type: "system", id: "ade_budget" },
      payload: {
        message_id: msgId,
        thread_id: run.thread_id,
        is_root: false,
        author_type: "system",
        author_id: "ade_budget",
        kind: "system",
        body,
        mentions: [],
        human_mentions: []
      },
      ts: nowIso
    });

    // 6. Realtime WebSocket
    this.deps.eventBus.publish({
      type: "run.failed",
      projectId: run.project_id,
      threadId: run.thread_id,
      data: {
        run_id: run.id,
        stop_reason: "budget_exceeded",
        error_code: "ERR_BUDGET_EXCEEDED",
        cost_usd: run.cost_usd
      }
    } as any);

    this.deps.eventBus.publish({
      type: "message.posted",
      projectId: run.project_id,
      threadId: run.thread_id,
      data: {
        message_id: msgId,
        thread_id: run.thread_id,
        is_root: false,
        author_type: "system",
        author_id: "ade_budget",
        kind: "system",
        body,
        mentions: [],
        human_mentions: []
      }
    } as any);
  }
}
