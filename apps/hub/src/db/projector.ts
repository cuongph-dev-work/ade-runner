import type Database from "better-sqlite3";
import type { EventEnvelope } from "@ade/shared";

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
    default:
      break;
  }
}
