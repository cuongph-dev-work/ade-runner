import type Database from "better-sqlite3";
import { ulid } from "ulid";
import type { ActorType, EventType } from "@ade/shared";
import { HubDomainError } from "../chat/chat-service.js";

export interface ThreadSchedulerDeps {
  sqlite: Database.Database;
  appendEvent: (evt: {
    type: EventType;
    projectId: string | null;
    threadId: string | null;
    runId: string | null;
    actorType: ActorType;
    actorId: string;
    payload: Record<string, unknown>;
  }) => void;
  dispatchRun?: (params: {
    threadId: string;
    agentId: string;
    promptText: string;
    invokedBy: string;
    role?: "main" | "worker";
    delegationId?: string;
    parentRunId?: string;
    task?: string;
  }) => Promise<string> | string;
  tryDispatchQueued?: (threadId: string) => void;
}

export interface DelegateTaskItem {
  agent: string; // e.g. "@coder" or agentId
  task: string;
  write?: boolean;
}

export class ThreadScheduler {
  constructor(private readonly deps: ThreadSchedulerDeps) {}

  /**
   * Main Agent ủy quyền công việc cho nhiều Worker song song (Fan-out).
   * Giới hạn tối đa 3 workers chạy song song.
   * Worker write=true sẽ cần độc quyền worktree lock; worker read-only (write=false) chạy song song tự do.
   */
  async delegateTasks(params: {
    threadId: string;
    mainRunId: string;
    mainAgentId: string;
    tasks: DelegateTaskItem[];
  }): Promise<{ delegation_id: string; dispatched: Array<{ run_id: string; agent: string; status: string }> }> {
    const thread = this.deps.sqlite
      .prepare("SELECT id, project_id FROM threads WHERE id = ?")
      .get(params.threadId) as { id: string; project_id: string } | undefined;

    if (!thread) {
      throw new HubDomainError(404, "ERR_NOT_FOUND");
    }

    if (!params.tasks || params.tasks.length === 0) {
      throw new HubDomainError(422, "ERR_VALIDATION");
    }

    const delegationId = `del_${ulid().toLowerCase()}`;
    const dispatchedResults: Array<{ run_id: string; agent: string; status: string }> = [];

    for (const item of params.tasks) {
      // Tìm agent trong project theo handle hoặc id
      const agent = this.deps.sqlite
        .prepare("SELECT id, handle, write FROM agents WHERE project_id = ? AND (handle = ? OR id = ?)")
        .get(thread.project_id, item.agent, item.agent) as { id: string; handle: string; write: number } | undefined;

      if (!agent) {
        throw new HubDomainError(404, "ERR_NOT_FOUND");
      }

      // Đảm bảo agent đã được grant quyền đọc thread
      const grantExists = this.deps.sqlite
        .prepare("SELECT 1 FROM thread_agents WHERE thread_id = ? AND agent_id = ? AND revoked_at IS NULL")
        .get(params.threadId, agent.id);

      if (!grantExists) {
        const now = new Date().toISOString();
        this.deps.sqlite
          .prepare(
            `INSERT INTO thread_agents (thread_id, agent_id, role, scope, granted_by, granted_at)
             VALUES (?, ?, 'worker', 'full', ?, ?)`
          )
          .run(params.threadId, agent.id, params.mainAgentId, now);

        this.deps.appendEvent({
          type: "agent.granted",
          projectId: thread.project_id,
          threadId: params.threadId,
          runId: params.mainRunId,
          actorType: "agent",
          actorId: params.mainAgentId,
          payload: {
            agent_id: agent.id,
            role: "worker",
            scope: "full",
            granted_by: params.mainAgentId,
          },
        });
      }

      let runId = `run_${ulid().toLowerCase()}`;
      if (this.deps.dispatchRun) {
        runId = await this.deps.dispatchRun({
          threadId: params.threadId,
          agentId: agent.id,
          promptText: item.task,
          invokedBy: params.mainAgentId,
          role: "worker",
          delegationId,
          parentRunId: params.mainRunId,
          task: item.task,
        });
      }

      dispatchedResults.push({
        run_id: runId,
        agent: agent.handle,
        status: "dispatched",
      });
    }

    this.deps.appendEvent({
      type: "task.delegated",
      projectId: thread.project_id,
      threadId: params.threadId,
      runId: params.mainRunId,
      actorType: "agent",
      actorId: params.mainAgentId,
      payload: {
        delegation_id: delegationId,
        tasks_count: params.tasks.length,
        dispatched: dispatchedResults,
      },
    });

    return {
      delegation_id: delegationId,
      dispatched: dispatchedResults,
    };
  }

  /**
   * Kiểm tra và thực hiện Fan-in khi một worker kết thúc.
   * Nếu tất cả worker cùng delegation_id đã hoàn thành, phát delegation.completed và đánh thức Main Agent.
   */
  checkAndHandleFanIn(delegationId: string): boolean {
    const runs = this.deps.sqlite
      .prepare(
        `SELECT r.id, r.thread_id, r.project_id, r.parent_run_id, r.status, r.outcome, r.summary, a.handle
         FROM runs r
         INNER JOIN agents a ON a.id = r.agent_id
         WHERE r.delegation_id = ?`
      )
      .all(delegationId) as Array<{
      id: string;
      thread_id: string;
      project_id: string;
      parent_run_id: string | null;
      status: string;
      outcome: string | null;
      summary: string | null;
      handle: string;
    }>;

    if (runs.length === 0) return false;

    // Kiểm tra xem tất cả đã ở trạng thái kết thúc (completed / failed / cancelled) chưa
    const allFinished = runs.every((r) => ["completed", "failed", "cancelled"].includes(r.status));
    if (!allFinished) return false;

    const threadId = runs[0].thread_id;
    const projectId = runs[0].project_id;
    const parentRunId = runs[0].parent_run_id;

    const results = runs.map((r) => ({
      run_id: r.id,
      agent: r.handle,
      status: r.status,
      outcome: r.outcome ?? "unknown",
      summary: r.summary ?? "",
    }));

    this.deps.appendEvent({
      type: "delegation.completed",
      projectId,
      threadId,
      runId: parentRunId,
      actorType: "system",
      actorId: "thread_scheduler",
      payload: {
        delegation_id: delegationId,
        results,
      },
    });

    return true;
  }
}
