import type Database from "better-sqlite3";
import type { EventEnvelope, RunStatus, RunnerStatus } from "@ade/shared";
import { assertRunTransition, assertRunnerTransition } from "../runner/state-machines.js";

export const LOCAL_USER_ID = "usr_local";
export const LOCAL_USER_HANDLE = "owner";
export const LOCAL_USER_NAME = "Local Owner";
export const LOCAL_USER_EPOCH = "1970-01-01T00:00:00.000Z";

interface StoredReactionBucket {
  emoji: string;
  userIds: string[];
}

export function ensureLocalUserRow(sqlite: Database.Database): void {
  sqlite
    .prepare(
      `INSERT OR IGNORE INTO users (id, handle, name, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(LOCAL_USER_ID, LOCAL_USER_HANDLE, LOCAL_USER_NAME, LOCAL_USER_EPOCH);
}

export function applyEventToProjection(
  sqlite: Database.Database,
  event: EventEnvelope
): void {
  const payload = event.payload;

  switch (event.type) {
    case "project.registered": {
      ensureLocalUserRow(sqlite);
      const projectId = String(payload.project_id ?? event.project_id ?? "");
      if (!projectId) return;
      const name = String(payload.name ?? projectId);
      const repoPath = String(payload.repo_path ?? `/unknown/${projectId}`);
      const workflowId = String(payload.workflow_id ?? "feature");

      sqlite
        .prepare(
          `INSERT INTO projects (
             id, name, repo_path, default_branch, default_main_agent,
             workflow_id, memory_path, use_repo_instructions, config_errors_json,
             created_at, updated_at
           ) VALUES (?, ?, ?, 'main', NULL, ?, '.ade/memory/', 0, '[]', ?, ?)`
        )
        .run(projectId, name, repoPath, workflowId, event.ts, event.ts);

      sqlite
        .prepare(
          `INSERT OR IGNORE INTO project_members (project_id, user_id, role)
           VALUES (?, ?, 'owner')`
        )
        .run(projectId, LOCAL_USER_ID);
      break;
    }

    case "channel.created": {
      const channelId = String(payload.channel_id ?? "");
      const projectId = String(payload.project_id ?? event.project_id ?? "");
      const name = String(payload.name ?? "");
      if (!channelId || !projectId || !name) return;
      const description = String(payload.description ?? "");
      const memberUserIds = Array.isArray(payload.member_user_ids)
        ? payload.member_user_ids.map(String)
        : [];
      const memberAgentIds = Array.isArray(payload.member_agent_ids)
        ? payload.member_agent_ids.map(String)
        : [];

      sqlite
        .prepare(
          `INSERT INTO channels (id, project_id, name, description, deleted_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, NULL, ?, ?)`
        )
        .run(channelId, projectId, name, description, event.ts, event.ts);

      const insertMember = sqlite.prepare(
        `INSERT OR IGNORE INTO channel_members (channel_id, member_type, member_id, added_at)
         VALUES (?, ?, ?, ?)`
      );
      for (const uid of memberUserIds) {
        insertMember.run(channelId, "human", uid, event.ts);
      }
      for (const aid of memberAgentIds) {
        insertMember.run(channelId, "agent", aid, event.ts);
      }
      break;
    }

    case "channel.updated": {
      const channelId = String(payload.channel_id ?? "");
      if (!channelId) return;
      const name = String(payload.name ?? "");
      const description = String(payload.description ?? "");
      const memberUserIds = Array.isArray(payload.member_user_ids)
        ? payload.member_user_ids.map(String)
        : [];
      const memberAgentIds = Array.isArray(payload.member_agent_ids)
        ? payload.member_agent_ids.map(String)
        : [];

      sqlite
        .prepare(
          `UPDATE channels
           SET name = ?, description = ?, updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .run(name, description, event.ts, channelId);

      const existingRows = sqlite
        .prepare(
          `SELECT member_type AS memberType, member_id AS memberId
           FROM channel_members WHERE channel_id = ?`
        )
        .all(channelId) as Array<{ memberType: string; memberId: string }>;

      const desiredKeys = new Set<string>([
        ...memberUserIds.map((id) => `human:${id}`),
        ...memberAgentIds.map((id) => `agent:${id}`)
      ]);

      const deleteMember = sqlite.prepare(
        `DELETE FROM channel_members WHERE channel_id = ? AND member_type = ? AND member_id = ?`
      );
      for (const row of existingRows) {
        if (!desiredKeys.has(`${row.memberType}:${row.memberId}`)) {
          deleteMember.run(channelId, row.memberType, row.memberId);
        }
      }

      const insertMember = sqlite.prepare(
        `INSERT OR IGNORE INTO channel_members (channel_id, member_type, member_id, added_at)
         VALUES (?, ?, ?, ?)`
      );
      for (const uid of memberUserIds) {
        insertMember.run(channelId, "human", uid, event.ts);
      }
      for (const aid of memberAgentIds) {
        insertMember.run(channelId, "agent", aid, event.ts);
      }
      break;
    }

    case "channel.deleted": {
      const channelId = String(payload.channel_id ?? "");
      if (!channelId) return;
      sqlite
        .prepare(
          `UPDATE channels
           SET deleted_at = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(event.ts, event.ts, channelId);
      break;
    }

    case "thread.created": {
      const threadId = String(payload.thread_id ?? event.thread_id ?? "");
      const projectId = String(event.project_id ?? "");
      const channelId = String(payload.channel_id ?? "");
      const rootMessageId = String(payload.root_message_id ?? "");
      const title = String(payload.title ?? "");
      const initialState = String(payload.initial_state ?? "open");
      const workflowId = String(payload.workflow_id ?? "feature");
      if (!threadId || !projectId || !channelId) return;

      sqlite
        .prepare(
          `INSERT INTO threads (
             id, project_id, channel_id, root_message_id, title,
             state, previous_state, workflow_id, main_agent_id,
             summary, budget_usd, spent_usd, engine_halted,
             created_by, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, NULL, '', NULL, 0, 0, ?, ?, ?)`
        )
        .run(
          threadId,
          projectId,
          channelId,
          rootMessageId,
          title,
          initialState,
          workflowId,
          event.actor.id,
          event.ts,
          event.ts
        );
      break;
    }

    case "message.posted": {
      const messageId = String(payload.message_id ?? "");
      const threadId = String(event.thread_id ?? "");
      if (!messageId || !threadId) return;
      const isRoot = payload.is_root === true ? 1 : 0;
      const kind = String(payload.kind ?? "text");
      const body = String(payload.body ?? "");
      const mentions = Array.isArray(payload.mentions) ? payload.mentions.map(String) : [];
      const humanMentions = Array.isArray(payload.human_mentions)
        ? payload.human_mentions.map(String)
        : [];
      const cardJson =
        payload.card !== undefined && payload.card !== null
          ? JSON.stringify(payload.card)
          : null;

      sqlite
        .prepare(
          `INSERT INTO messages (
             id, thread_id, is_root, author_type, author_id, kind, body,
             mentions_json, human_mentions_json, reactions_json, card_json, run_id,
             created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?)`
        )
        .run(
          messageId,
          threadId,
          isRoot,
          event.actor.type,
          event.actor.id,
          kind,
          body,
          JSON.stringify(mentions),
          JSON.stringify(humanMentions),
          cardJson,
          event.run_id,
          event.ts,
          event.ts
        );

      sqlite
        .prepare(`UPDATE threads SET updated_at = ? WHERE id = ?`)
        .run(event.ts, threadId);
      break;
    }

    case "message.reaction_toggled": {
      const messageId = String(payload.message_id ?? "");
      const emoji = String(payload.emoji ?? "");
      const actorId = String(payload.actor_id ?? event.actor.id);
      const added = Boolean(payload.added);
      if (!messageId || !emoji) return;

      const row = sqlite
        .prepare(`SELECT reactions_json AS reactionsJson FROM messages WHERE id = ?`)
        .get(messageId) as { reactionsJson: string } | undefined;
      if (!row) return;

      const buckets = JSON.parse(row.reactionsJson) as StoredReactionBucket[];
      let bucket = buckets.find((item) => item.emoji === emoji);

      if (added) {
        if (!bucket) {
          bucket = { emoji, userIds: [actorId] };
          buckets.push(bucket);
        } else if (!bucket.userIds.includes(actorId)) {
          bucket.userIds.push(actorId);
        }
      } else if (bucket) {
        bucket.userIds = bucket.userIds.filter((uid) => uid !== actorId);
      }

      const cleaned = buckets.filter((item) => item.userIds.length > 0);
      sqlite
        .prepare(`UPDATE messages SET reactions_json = ?, updated_at = ? WHERE id = ?`)
        .run(JSON.stringify(cleaned), event.ts, messageId);
      break;
    }

    case "agent.mentioned":
      break;

    case "agent.granted": {
      sqlite
        .prepare(
          `INSERT INTO thread_agents (thread_id, agent_id, role, scope, granted_by, granted_at, revoked_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL)
           ON CONFLICT(thread_id, agent_id) DO UPDATE SET
             role = excluded.role,
             scope = excluded.scope,
             granted_by = excluded.granted_by,
             granted_at = excluded.granted_at,
             revoked_at = NULL`
        )
        .run(
          event.thread_id,
          event.payload.agent_id,
          event.payload.role ?? "worker",
          event.payload.scope ?? "full",
          event.payload.granted_by ?? event.actor.id,
          event.ts
        );
      break;
    }

    case "agent.revoked": {
      sqlite
        .prepare(
          `UPDATE thread_agents SET revoked_at = ? WHERE thread_id = ? AND agent_id = ?`
        )
        .run(event.ts, event.thread_id, event.payload.agent_id);
      break;
    }

    case "thread.state_changed": {
      sqlite
        .prepare(
          `UPDATE threads SET previous_state = ?, state = ?, updated_at = ? WHERE id = ?`
        )
        .run(event.payload.from, event.payload.to, event.ts, event.thread_id);
      break;
    }

    case "engine.halted": {
      sqlite
        .prepare(
          `UPDATE threads SET engine_halted = 1, updated_at = ? WHERE id = ?`
        )
        .run(event.ts, event.thread_id);
      break;
    }

    case "run.outcome_reported": {
      sqlite
        .prepare(
          `UPDATE runs SET outcome = ?, summary = ?, decisions_json = ? WHERE id = ?`
        )
        .run(
          event.payload.status,
          event.payload.summary,
          JSON.stringify(event.payload.decisions ?? []),
          event.payload.run_id
        );
      break;
    }

    case "question.asked": {
      const cardMsgId = String(event.payload.card_message_id ?? event.payload.question_id);
      sqlite
        .prepare(
          `INSERT INTO messages (id, thread_id, is_root, author_type, author_id, kind, body, mentions_json, human_mentions_json, reactions_json, card_json, run_id, created_at, updated_at)
           VALUES (?, ?, 0, 'agent', ?, 'question_card', ?, '[]', '[]', '[]', ?, ?, ?, ?)`
        )
        .run(
          cardMsgId,
          event.thread_id,
          event.actor.id,
          String(event.payload.question ?? ""),
          JSON.stringify(event.payload),
          event.payload.run_id ?? null,
          event.ts,
          event.ts
        );
      break;
    }

    case "question.answered": {
      const cardMsgId = String(event.payload.card_message_id ?? event.payload.question_id);
      const row = sqlite
        .prepare("SELECT card_json FROM messages WHERE id = ?")
        .get(cardMsgId) as { card_json: string } | undefined;
      if (row?.card_json) {
        try {
          const card = JSON.parse(row.card_json) as Record<string, unknown>;
          card.status = "answered";
          card.answer = event.payload.answer;
          card.selected_option_id = event.payload.option_id;
          card.answers = event.payload.answers;
          card.answered_by = event.payload.answered_by;
          card.answered_at = event.ts;
          sqlite
            .prepare("UPDATE messages SET card_json = ?, updated_at = ? WHERE id = ?")
            .run(JSON.stringify(card), event.ts, cardMsgId);
        } catch {
          // ignore
        }
      }
      break;
    }

    case "question.timed_out": {
      const qId = String(event.payload.question_id);
      const row = sqlite
        .prepare("SELECT id, card_json FROM messages WHERE id = ? OR card_json LIKE ?")
        .get(qId, `%"question_id":"${qId}"%`) as { id: string; card_json: string } | undefined;
      if (row?.card_json) {
        try {
          const card = JSON.parse(row.card_json) as Record<string, unknown>;
          card.status = "expired";
          sqlite
            .prepare("UPDATE messages SET card_json = ?, updated_at = ? WHERE id = ?")
            .run(JSON.stringify(card), event.ts, row.id);
        } catch {
          // ignore
        }
      }
      break;
    }

    case "approval.requested": {
      const p = event.payload;
      const approvalId = String(p.approval_id);
      const cardMsgId = String(p.card_message_id ?? `msg_${approvalId}`);
      sqlite
        .prepare(
          `INSERT INTO approvals (id, thread_id, run_id, gate, version, status, target_state, summary, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`
        )
        .run(
          approvalId,
          event.thread_id,
          String(p.run_id ?? event.run_id ?? ""),
          String(p.gate),
          Number(p.version ?? 1),
          String(p.target_state ?? ""),
          String(p.summary ?? ""),
          event.ts,
          event.ts
        );

      sqlite
        .prepare(
          `INSERT INTO messages (id, thread_id, is_root, author_type, author_id, kind, body, mentions_json, human_mentions_json, reactions_json, card_json, run_id, created_at, updated_at)
           VALUES (?, ?, 0, 'agent', ?, 'approval_card', ?, '[]', '[]', '[]', ?, ?, ?, ?)`
        )
        .run(
          cardMsgId,
          event.thread_id,
          event.actor.id,
          String(p.summary ?? ""),
          JSON.stringify({
            approval_id: approvalId,
            gate: p.gate,
            version: p.version,
            title: p.title ?? `Cổng duyệt ${p.gate} v${p.version}`,
            summary: p.summary,
            status: "pending",
            requested_by_agent: event.actor.id,
            target_state: p.target_state,
          }),
          event.run_id ?? null,
          event.ts,
          event.ts
        );
      break;
    }

    case "approval.resolved": {
      const p = event.payload;
      const approvalId = String(p.approval_id);
      const status = String(p.status);
      sqlite
        .prepare(
          `UPDATE approvals
           SET status = ?, decided_by = ?, decided_at = ?, feedback = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(status, p.decided_by ? String(p.decided_by) : null, event.ts, p.feedback ? String(p.feedback) : null, event.ts, approvalId);

      const row = sqlite
        .prepare("SELECT id, card_json FROM messages WHERE card_json LIKE ?")
        .get(`%"approval_id":"${approvalId}"%`) as { id: string; card_json: string } | undefined;
      if (row?.card_json) {
        try {
          const card = JSON.parse(row.card_json);
          card.status = status;
          card.decided_by = p.decided_by;
          card.decided_at = event.ts;
          card.feedback = p.feedback;
          sqlite
            .prepare("UPDATE messages SET card_json = ?, updated_at = ? WHERE id = ?")
            .run(JSON.stringify(card), event.ts, row.id);
        } catch {}
      }
      break;
    }

    case "scratchpad.updated": {
      const p = event.payload;
      sqlite
        .prepare(
          `INSERT INTO agent_scratchpads (thread_id, agent_id, content, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(thread_id, agent_id) DO UPDATE SET
             content = excluded.content,
             updated_at = excluded.updated_at`
        )
        .run(event.thread_id, String(p.agent_id), String(p.content), event.ts);
      break;
    }

    case "main.changed": {
      const p = event.payload;
      sqlite
        .prepare("UPDATE threads SET main_agent_id = ?, updated_at = ? WHERE id = ?")
        .run(String(p.main_agent_id), event.ts, event.thread_id);
      break;
    }

    case "thread.summary_updated": {
      const threadId = event.thread_id ?? (event.payload.thread_id as string | undefined);
      if (threadId) {
        sqlite
          .prepare("UPDATE threads SET summary = ?, updated_at = ? WHERE id = ?")
          .run(String(event.payload.summary ?? ""), event.ts, threadId);
      }
      break;
    }

    case "memory.proposed": {
      const p = event.payload;
      sqlite
        .prepare(
          `INSERT INTO memory_proposals (
             id, project_id, thread_id, run_id, agent_id, scope, target_file, content, reason, status, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
           ON CONFLICT(id) DO NOTHING`
        )
        .run(
          String(p.proposal_id ?? event.id),
          String(event.project_id ?? p.project_id),
          String(event.thread_id ?? p.thread_id),
          String(event.run_id ?? p.run_id),
          String(p.agent_id),
          String(p.scope ?? "project"),
          String(p.target_file),
          String(p.content),
          String(p.reason),
          event.ts
        );
      break;
    }

    case "memory.resolved": {
      const p = event.payload;
      const proposalId = String(p.proposal_id);
      const decision = String(p.decision ?? p.action ?? "reject");
      const status = decision === "approve" ? "approved" : "rejected";
      sqlite
        .prepare(
          "UPDATE memory_proposals SET status = ?, decided_by = ?, decided_at = ? WHERE id = ?"
        )
        .run(status, event.actor.id, event.ts, proposalId);

      const msgRow = sqlite
        .prepare(
          "SELECT id, card_json FROM messages WHERE card_json LIKE ? ORDER BY created_at DESC LIMIT 1"
        )
        .get(`%"proposalId":"${proposalId}"%`) as { id: string; card_json: string } | undefined;
      if (msgRow) {
        try {
          const card = JSON.parse(msgRow.card_json);
          card.status = status;
          sqlite
            .prepare("UPDATE messages SET card_json = ?, updated_at = ? WHERE id = ?")
            .run(JSON.stringify(card), event.ts, msgRow.id);
        } catch {}
      }
      break;
    }

    case "run.usage_updated": {
      const runId = event.run_id ?? (event.payload.run_id as string | undefined);
      if (runId) {
        const cost = Number(event.payload.cost_usd ?? 0);
        sqlite
          .prepare("UPDATE runs SET cost_usd = ? WHERE id = ?")
          .run(cost, runId);
      }
      break;
    }

    case "runner.connected":
    case "runner.disconnected":
    case "run.queued":
    case "run.started":
    case "run.permission_requested":
    case "run.permission_resolved":
    case "run.completed":
    case "run.failed":
    case "run.cancelled": {
      projectRunnerEvent(sqlite, {
        type: event.type,
        projectId: event.project_id,
        threadId: event.thread_id,
        runId: event.run_id,
        actorId: event.actor.id,
        payload: event.payload,
        ts: event.ts
      });
      break;
    }

    default:
      break;
  }
}

export function projectRunnerEvent(
  sqlite: Database.Database,
  evt: {
    type: string;
    projectId: string | null;
    threadId: string | null;
    runId: string | null;
    actorId: string;
    payload: Record<string, unknown>;
    ts: string;
  }
): void {
  if (evt.type === "runner.connected") {
    const runnerId = String(evt.payload.runner_id);
    const existing = sqlite
      .prepare("SELECT status FROM runners WHERE id = ?")
      .get(runnerId) as { status: RunnerStatus } | undefined;
    assertRunnerTransition(existing?.status ?? null, "online");
    if (!existing) {
      sqlite
        .prepare(
          `INSERT INTO runners (id, owner_user_id, machine_name, harnesses_available_json, status, last_seen)
           VALUES (?, ?, ?, ?, 'online', ?)`
        )
        .run(
          runnerId,
          evt.actorId,
          String(evt.payload.machine_name),
          JSON.stringify(evt.payload.harnesses_available ?? []),
          evt.ts
        );
    } else {
      sqlite
        .prepare(
          `UPDATE runners SET status = 'online', machine_name = ?, harnesses_available_json = ?, last_seen = ? WHERE id = ?`
        )
        .run(
          String(evt.payload.machine_name),
          JSON.stringify(evt.payload.harnesses_available ?? []),
          evt.ts,
          runnerId
        );
    }
    return;
  }

  if (evt.type === "runner.disconnected") {
    const runnerId = String(evt.payload.runner_id);
    const existing = sqlite
      .prepare("SELECT status FROM runners WHERE id = ?")
      .get(runnerId) as { status: RunnerStatus } | undefined;
    assertRunnerTransition(existing?.status ?? null, "offline");
    sqlite
      .prepare("UPDATE runners SET status = 'offline', last_seen = ? WHERE id = ?")
      .run(evt.ts, runnerId);
    return;
  }

  if (evt.type === "message.posted" && evt.payload.kind === "system" && evt.threadId) {
    const msgId = String(evt.payload.message_id ?? `msg_${evt.ts}`);
    const exists = sqlite.prepare("SELECT id FROM messages WHERE id = ?").get(msgId);
    if (!exists) {
      sqlite
        .prepare(
          `INSERT INTO messages (
            id, thread_id, is_root, author_type, author_id, kind, body,
            mentions_json, human_mentions_json, reactions_json, card_json, run_id, created_at, updated_at
          ) VALUES (?, ?, 0, 'system', ?, 'system', ?, '[]', '[]', '[]', NULL, ?, ?, ?)`
        )
        .run(
          msgId,
          evt.threadId,
          evt.actorId,
          String(evt.payload.body ?? evt.payload.text ?? ""),
          evt.runId,
          evt.ts,
          evt.ts
        );
    }
    return;
  }

  if (evt.type === "run.queued") {
    sqlite
      .prepare(
        `INSERT INTO runs (
          id, project_id, thread_id, agent_id, invoked_by, credential_profile,
          role, depth, timeout_s, task, delegation_id, parent_run_id, status, skills_snapshot_json, cost_usd, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, 0, ?)`
      )
      .run(
        String(evt.payload.run_id),
        evt.projectId,
        evt.threadId,
        String(evt.payload.agent_id),
        evt.actorId,
        String(evt.payload.credential_profile),
        String(evt.payload.role ?? "worker"),
        Number(evt.payload.depth ?? 0),
        Number(evt.payload.timeout_s ?? 600),
        evt.payload.task ? String(evt.payload.task) : null,
        evt.payload.delegation_id ? String(evt.payload.delegation_id) : null,
        evt.payload.parent_run_id ? String(evt.payload.parent_run_id) : null,
        JSON.stringify(evt.payload.skills_snapshot ?? []),
        evt.ts
      );
    return;
  }

  if (!evt.runId) return;
  const currentRun = sqlite
    .prepare("SELECT status, outcome, thread_id, cost_usd FROM runs WHERE id = ?")
    .get(evt.runId) as
    | { status: RunStatus; outcome: string | null; thread_id: string; cost_usd: number }
    | undefined;
  if (!currentRun) return;

  if (evt.type === "run.started") {
    assertRunTransition(currentRun.status, "running");
    sqlite
      .prepare(
        `UPDATE runs SET status = 'running', runner_id = ?, acp_session_id = ?, started_at = ? WHERE id = ?`
      )
      .run(
        evt.payload.runner_id ? String(evt.payload.runner_id) : null,
        evt.payload.acp_session_id ? String(evt.payload.acp_session_id) : null,
        evt.ts,
        evt.runId
      );
  } else if (evt.type === "run.permission_requested") {
    assertRunTransition(currentRun.status, "waiting_permission");
    sqlite.prepare("UPDATE runs SET status = 'waiting_permission' WHERE id = ?").run(evt.runId);
  } else if (evt.type === "run.permission_resolved") {
    assertRunTransition(currentRun.status, "running");
    sqlite.prepare("UPDATE runs SET status = 'running' WHERE id = ?").run(evt.runId);
  } else if (evt.type === "run.completed") {
    assertRunTransition(currentRun.status, "completed");
    const finalOutcome = String(evt.payload.outcome ?? currentRun.outcome ?? "unknown");
    const settledCost = Number(evt.payload.cost_usd ?? currentRun.cost_usd ?? 0);
    sqlite
      .prepare(
        `UPDATE runs SET status = 'completed', stop_reason = ?, outcome = ?, summary = ?, decisions_json = ?, cost_usd = ?, ended_at = ? WHERE id = ?`
      )
      .run(
        String(evt.payload.stop_reason ?? "end_turn"),
        finalOutcome,
        evt.payload.summary ? String(evt.payload.summary) : null,
        JSON.stringify(evt.payload.decisions ?? []),
        settledCost,
        evt.ts,
        evt.runId
      );
    sqlite
      .prepare("UPDATE threads SET spent_usd = COALESCE(spent_usd, 0) + ?, updated_at = ? WHERE id = ?")
      .run(settledCost, evt.ts, currentRun.thread_id);
  } else if (evt.type === "run.failed") {
    assertRunTransition(currentRun.status, "failed");
    const settledCost = Number(evt.payload.cost_usd ?? currentRun.cost_usd ?? 0);
    sqlite
      .prepare(
        `UPDATE runs SET status = 'failed', stop_reason = ?, cost_usd = ?, ended_at = ? WHERE id = ?`
      )
      .run(
        String(evt.payload.stop_reason ?? "error"),
        settledCost,
        evt.ts,
        evt.runId
      );
    sqlite
      .prepare("UPDATE threads SET spent_usd = COALESCE(spent_usd, 0) + ?, updated_at = ? WHERE id = ?")
      .run(settledCost, evt.ts, currentRun.thread_id);
  } else if (evt.type === "run.cancelled") {
    assertRunTransition(currentRun.status, "cancelled");
    const accruedCost = Number(currentRun.cost_usd ?? 0);
    sqlite
      .prepare("UPDATE runs SET status = 'cancelled', stop_reason = 'cancelled', ended_at = ? WHERE id = ?")
      .run(evt.ts, evt.runId);
    if (accruedCost > 0) {
      sqlite
        .prepare("UPDATE threads SET spent_usd = COALESCE(spent_usd, 0) + ?, updated_at = ? WHERE id = ?")
        .run(accruedCost, evt.ts, currentRun.thread_id);
    }
  }
}
