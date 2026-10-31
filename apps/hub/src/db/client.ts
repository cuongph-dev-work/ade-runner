import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import { EventEnvelopeSchema, type EventEnvelope } from "@ade/shared";
import { eventsTable } from "./schema.js";
import { applyEventToProjection, ensureLocalUserRow } from "./projector.js";

export interface HubDatabase {
  sqlite: Database.Database;
  db: BetterSQLite3Database;
  appendEvent: (event: EventEnvelope) => EventEnvelope;
  appendAndProject: (events: EventEnvelope[]) => EventEnvelope[];
  rebuildProjections: (afterReplay?: (sqlite: Database.Database) => void) => void;
  countEvents: () => number;
  close: () => void;
}

const MIGRATION_P0_P1_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  handle TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  repo_path TEXT NOT NULL UNIQUE,
  default_branch TEXT NOT NULL,
  default_main_agent TEXT,
  workflow_id TEXT NOT NULL,
  memory_path TEXT NOT NULL,
  use_repo_instructions INTEGER NOT NULL DEFAULT 0,
  config_errors_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL REFERENCES projects(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_project_active_name
ON channels(project_id, name) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS channel_members (
  channel_id TEXT NOT NULL REFERENCES channels(id),
  member_type TEXT NOT NULL,
  member_id TEXT NOT NULL,
  added_at TEXT NOT NULL,
  PRIMARY KEY (channel_id, member_type, member_id)
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  handle TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar TEXT,
  role TEXT NOT NULL,
  harness TEXT NOT NULL,
  model TEXT NOT NULL,
  credential_profile TEXT NOT NULL,
  mcp_allow_json TEXT NOT NULL DEFAULT '[]',
  write INTEGER NOT NULL DEFAULT 0,
  can_be_main INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  max_depth INTEGER NOT NULL DEFAULT 3,
  budget_usd REAL,
  timeout_s INTEGER NOT NULL DEFAULT 600,
  source_file TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, handle)
);

CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  channel_id TEXT NOT NULL REFERENCES channels(id),
  root_message_id TEXT NOT NULL,
  title TEXT NOT NULL,
  state TEXT NOT NULL,
  previous_state TEXT,
  workflow_id TEXT NOT NULL,
  main_agent_id TEXT,
  summary TEXT NOT NULL DEFAULT '',
  budget_usd REAL,
  spent_usd REAL NOT NULL DEFAULT 0,
  engine_halted INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_threads_channel_created
ON threads(channel_id, created_at);

CREATE TABLE IF NOT EXISTS thread_agents (
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('main', 'worker')),
  scope TEXT NOT NULL CHECK (scope IN ('brief', 'full')),
  granted_by TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  revoked_at TEXT,
  PRIMARY KEY (thread_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_thread_agents_active
  ON thread_agents(thread_id, agent_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY NOT NULL,
  thread_id TEXT NOT NULL REFERENCES threads(id),
  is_root INTEGER NOT NULL DEFAULT 0,
  author_type TEXT NOT NULL,
  author_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  mentions_json TEXT NOT NULL DEFAULT '[]',
  human_mentions_json TEXT NOT NULL DEFAULT '[]',
  reactions_json TEXT NOT NULL DEFAULT '[]',
  card_json TEXT,
  run_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_thread_created
ON messages(thread_id, is_root DESC, created_at ASC);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER NOT NULL UNIQUE,
  type TEXT NOT NULL,
  project_id TEXT,
  thread_id TEXT,
  run_id TEXT,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  causation_id TEXT,
  correlation_id TEXT,
  ts TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_thread_seq ON events(thread_id, seq);

CREATE TRIGGER IF NOT EXISTS trg_events_no_update
BEFORE UPDATE ON events
BEGIN
  SELECT RAISE(ABORT, 'events table is append-only: UPDATE is forbidden');
END;

CREATE TRIGGER IF NOT EXISTS trg_events_no_delete
BEFORE DELETE ON events
BEGIN
  SELECT RAISE(ABORT, 'events table is append-only: DELETE is forbidden');
END;

CREATE TABLE IF NOT EXISTS runners (
  id TEXT PRIMARY KEY NOT NULL,
  owner_user_id TEXT NOT NULL,
  machine_name TEXT NOT NULL,
  harnesses_available_json TEXT NOT NULL,
  status TEXT NOT NULL,
  last_seen TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  thread_id TEXT NOT NULL REFERENCES threads(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  invoked_by TEXT NOT NULL,
  runner_id TEXT REFERENCES runners(id),
  credential_profile TEXT NOT NULL,
  acp_session_id TEXT,
  role TEXT NOT NULL,
  task TEXT,
  delegation_id TEXT,
  parent_run_id TEXT,
  depth INTEGER NOT NULL DEFAULT 0,
  timeout_s INTEGER NOT NULL DEFAULT 600,
  status TEXT NOT NULL,
  outcome TEXT,
  stop_reason TEXT,
  summary TEXT,
  decisions_json TEXT,
  skills_snapshot_json TEXT NOT NULL DEFAULT '[]',
  cost_usd REAL NOT NULL DEFAULT 0,
  started_at TEXT,
  ended_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runs_thread_created ON runs(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_runs_project_created ON runs(project_id, created_at);

CREATE TABLE IF NOT EXISTS run_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES runs(id),
  seq INTEGER NOT NULL,
  kind TEXT NOT NULL,
  data_json TEXT NOT NULL,
  ts TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_run_logs_run_seq ON run_logs(run_id, seq);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY NOT NULL,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  gate TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  target_state TEXT NOT NULL,
  summary TEXT NOT NULL,
  decided_by TEXT,
  decided_at TEXT,
  feedback TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_approvals_thread_status
  ON approvals(thread_id, status);

CREATE TABLE IF NOT EXISTS agent_scratchpads (
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (thread_id, agent_id)
);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT,
  name TEXT NOT NULL,
  scope TEXT NOT NULL,
  path TEXT NOT NULL,
  description TEXT NOT NULL,
  has_shell_script INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_skills_project_scope
  ON skills(project_id, scope);

CREATE TABLE IF NOT EXISTS agent_skills (
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, skill_id)
);
`;

export function openHubDatabase(dbPath: string): HubDatabase {
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(MIGRATION_P0_P1_SQL);
  ensureLocalUserRow(sqlite);

  const db = drizzle(sqlite);

  const insertSingleRawEvent = (validated: EventEnvelope): EventEnvelope => {
    const row = sqlite
      .prepare("SELECT COALESCE(MAX(seq), 0) + 1 AS nextSeq FROM events")
      .get() as { nextSeq: number };
    const seq = row.nextSeq;

    db.insert(eventsTable)
      .values({
        id: validated.id,
        seq,
        type: validated.type,
        projectId: validated.project_id,
        threadId: validated.thread_id,
        runId: validated.run_id,
        actorType: validated.actor.type,
        actorId: validated.actor.id,
        payload: JSON.stringify(validated.payload),
        causationId: validated.causation_id,
        correlationId: validated.correlation_id,
        ts: validated.ts
      })
      .run();

    return { ...validated, seq };
  };

  const appendRawTx = sqlite.transaction((validated: EventEnvelope): EventEnvelope => {
    return insertSingleRawEvent(validated);
  });

  const appendAndProjectTx = sqlite.transaction(
    (items: EventEnvelope[]): EventEnvelope[] => {
      const committed: EventEnvelope[] = [];
      for (const item of items) {
        const stored = insertSingleRawEvent(item);
        applyEventToProjection(sqlite, stored);
        committed.push(stored);
      }
      return committed;
    }
  );

  const rebuildTx = sqlite.transaction(
    (afterReplay?: (sqliteConn: Database.Database) => void): void => {
      sqlite.exec(`
        DELETE FROM run_logs;
        DELETE FROM runs;
        DELETE FROM runners;
        DELETE FROM messages;
        DELETE FROM threads;
        DELETE FROM channel_members;
        DELETE FROM channels;
        DELETE FROM agents;
        DELETE FROM project_members;
        DELETE FROM projects;
      `);
      ensureLocalUserRow(sqlite);

      const rawEvents = sqlite
        .prepare(
          `SELECT id, seq, type, project_id, thread_id, run_id,
                  actor_type, actor_id, payload, causation_id, correlation_id, ts
           FROM events
           ORDER BY seq ASC`
        )
        .all() as Array<{
        id: string;
        seq: number;
        type: EventEnvelope["type"];
        project_id: string | null;
        thread_id: string | null;
        run_id: string | null;
        actor_type: EventEnvelope["actor"]["type"];
        actor_id: string;
        payload: string;
        causation_id: string | null;
        correlation_id: string | null;
        ts: string;
      }>;

      for (const row of rawEvents) {
        const env: EventEnvelope = {
          id: row.id,
          seq: row.seq,
          type: row.type,
          ts: row.ts,
          project_id: row.project_id,
          thread_id: row.thread_id,
          run_id: row.run_id,
          actor: { type: row.actor_type, id: row.actor_id },
          causation_id: row.causation_id,
          correlation_id: row.correlation_id,
          payload: JSON.parse(row.payload) as Record<string, unknown>
        };
        applyEventToProjection(sqlite, env);
      }

      if (afterReplay) {
        afterReplay(sqlite);
      }
    }
  );

  return {
    sqlite,
    db,
    appendEvent(event: EventEnvelope): EventEnvelope {
      const validated = EventEnvelopeSchema.parse(event);
      return appendRawTx(validated);
    },
    appendAndProject(events: EventEnvelope[]): EventEnvelope[] {
      const validated = events.map((ev) => EventEnvelopeSchema.parse(ev));
      return appendAndProjectTx(validated);
    },
    rebuildProjections(afterReplay?: (sqliteConn: Database.Database) => void): void {
      rebuildTx(afterReplay);
    },
    countEvents(): number {
      const row = db
        .select({ count: sql<number>`count(*)` })
        .from(eventsTable)
        .get();
      return Number(row?.count ?? 0);
    },
    close(): void {
      sqlite.close();
    }
  };
}
