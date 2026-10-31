import type Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { ulid } from "ulid";
import {
  WorkflowYamlSchema,
  type WorkflowYaml,
  type WorkflowRule,
  type WorkflowAction,
  type EventType,
  type ActorType,
} from "@ade/shared";

export interface RuleEngineDeps {
  sqlite: Database.Database;
  defaultRepoPath?: string;
  getWorkflow?: (projectId: string, workflowId: string) => WorkflowYaml | null;
  appendEvent: (evt: {
    type: EventType;
    projectId: string | null;
    threadId: string | null;
    runId: string | null;
    actorType: ActorType;
    actorId: string;
    causationId?: string | null;
    payload: Record<string, unknown>;
  }) => void;
  postMessage?: (threadId: string, body: string) => Promise<unknown> | unknown;
}

export class RuleEngine {
  private causationDepthMap = new Map<string, number>();

  constructor(private readonly deps: RuleEngineDeps) {}

  onEvent(event: {
    type: string;
    projectId: string | null;
    threadId: string | null;
    runId: string | null;
    actorId: string;
    payload: Record<string, unknown>;
  }): void {
    if (!event.threadId || !event.projectId) return;

    const thread = this.deps.sqlite
      .prepare(
        "SELECT id, project_id, workflow_id, state, engine_halted FROM threads WHERE id = ?"
      )
      .get(event.threadId) as
      | { id: string; project_id: string; workflow_id: string; state: string; engine_halted: number }
      | undefined;

    if (!thread || thread.engine_halted) return;

    const currentDepth = (this.causationDepthMap.get(thread.id) ?? 0) + 1;
    this.causationDepthMap.set(thread.id, currentDepth);

    if (currentDepth > 10) {
      this.deps.appendEvent({
        type: "engine.halted",
        projectId: thread.project_id,
        threadId: thread.id,
        runId: event.runId,
        actorType: "system",
        actorId: "rule-engine",
        payload: { reason: "causation_limit", causation_depth: currentDepth },
      });
      return;
    }

    try {
      this.evaluateWorkflowRules(thread, event);
    } finally {
      this.causationDepthMap.set(thread.id, Math.max(0, currentDepth - 1));
    }
  }

  private evaluateWorkflowRules(
    thread: { id: string; project_id: string; workflow_id: string; state: string },
    event: { type: string; runId: string | null; payload: Record<string, unknown> }
  ): void {
    const rules = this.loadWorkflowRules(thread.project_id, thread.workflow_id);
    if (!rules || rules.length === 0) return;

    for (const rule of rules) {
      if (rule.on !== event.type) continue;
      if (!this.matchesConditions(rule.when, thread, event)) continue;

      for (const action of rule.do) {
        this.executeAction(action, thread, event);
      }
    }
  }

  private matchesConditions(
    when: Record<string, unknown> | undefined,
    thread: { id: string; state: string },
    event: { payload: Record<string, unknown> }
  ): boolean {
    if (!when) return true;

    for (const [key, expected] of Object.entries(when)) {
      if (key === "state") {
        if (thread.state !== expected) return false;
      } else if (key === "outcome") {
        if (event.payload.status !== expected && event.payload.outcome !== expected) return false;
      } else if (key === "all_workers_done") {
        const pending = this.deps.sqlite
          .prepare(
            `SELECT COUNT(*) as count FROM runs
             WHERE thread_id = ? AND role = 'worker' AND status IN ('queued', 'running', 'waiting_permission', 'waiting_human')`
          )
          .get(thread.id) as { count: number };
        if (Boolean(expected) && pending.count > 0) return false;
      } else if (key in event.payload) {
        if (event.payload[key] !== expected) return false;
      }
    }

    return true;
  }

  private executeAction(
    action: WorkflowAction,
    thread: { id: string; project_id: string; state: string },
    event: { runId: string | null }
  ): void {
    if ("set_state" in action) {
      const targetState =
        typeof action.set_state === "string" ? action.set_state : action.set_state.to;
      const reason =
        typeof action.set_state === "string" ? "rule_engine_transition" : action.set_state.reason ?? "rule_engine";

      this.deps.appendEvent({
        type: "thread.state_changed",
        projectId: thread.project_id,
        threadId: thread.id,
        runId: event.runId,
        actorType: "system",
        actorId: "rule-engine",
        payload: {
          from: thread.state,
          to: targetState,
          reason,
        },
      });
      thread.state = targetState;
    } else if ("post_message" in action) {
      const msgId = `msg_${ulid().toLowerCase()}`;
      const now = new Date().toISOString();
      const text = action.post_message.text;
      const kind = action.post_message.kind ?? "system";

      this.deps.sqlite
        .prepare(
          `INSERT INTO messages (id, thread_id, is_root, author_type, author_id, kind, body, mentions_json, human_mentions_json, reactions_json, card_json, run_id, created_at, updated_at)
           VALUES (?, ?, 0, 'system', 'rule-engine', ?, ?, '[]', '[]', '[]', NULL, ?, ?, ?)`
        )
        .run(msgId, thread.id, kind, text, event.runId, now, now);

      this.deps.appendEvent({
        type: "message.posted",
        projectId: thread.project_id,
        threadId: thread.id,
        runId: event.runId,
        actorType: "system",
        actorId: "rule-engine",
        payload: {
          message_id: msgId,
          kind,
          body: text,
          is_root: false,
          mentions: [],
          human_mentions: [],
        },
      });
    } else if ("dispatch" in action) {
      if (this.deps.postMessage) {
        const handle = action.dispatch.agent.startsWith("@")
          ? action.dispatch.agent
          : `@${action.dispatch.agent}`;
        const prompt = action.dispatch.prompt ?? "Tiếp tục luồng công việc";
        void this.deps.postMessage(thread.id, `${handle} ${prompt}`);
      }
    }
  }

  private loadWorkflowRules(projectId: string, workflowId: string): WorkflowRule[] {
    if (this.deps.getWorkflow) {
      const wf = this.deps.getWorkflow(projectId, workflowId);
      if (wf && Array.isArray(wf.rules)) {
        return wf.rules.filter(
          (r: unknown): r is WorkflowRule => typeof (r as WorkflowRule).on === "string" && Array.isArray((r as WorkflowRule).do)
        );
      }
    }

    const project = this.deps.sqlite
      .prepare("SELECT repo_path FROM projects WHERE id = ?")
      .get(projectId) as { repo_path: string } | undefined;

    const baseDir = project?.repo_path ?? this.deps.defaultRepoPath ?? process.cwd();
    const candidateFiles = [
      path.join(baseDir, ".ade", "workflows", `${workflowId}.yaml`),
      path.join(baseDir, ".ade", "workflows", `${workflowId}.yml`),
    ];

    for (const f of candidateFiles) {
      if (fs.existsSync(f)) {
        try {
          const raw = fs.readFileSync(f, "utf8");
          const parsed = YAML.parse(raw) as Record<string, unknown>;
          const validated = WorkflowYamlSchema.safeParse(parsed);
          if (validated.success && Array.isArray(validated.data.rules)) {
            return validated.data.rules.filter(
              (r): r is WorkflowRule => typeof (r as WorkflowRule).on === "string" && Array.isArray((r as WorkflowRule).do)
            );
          }
        } catch {
          // ignore
        }
      }
    }

    return [];
  }
}
