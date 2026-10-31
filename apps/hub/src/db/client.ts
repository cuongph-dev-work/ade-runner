import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import { EventEnvelopeSchema, type EventEnvelope } from "@ade/shared";
import { eventsTable } from "./schema.js";

export interface HubDatabase {
  sqlite: Database.Database;
  db: BetterSQLite3Database;
  appendEvent: (event: EventEnvelope) => EventEnvelope;
  countEvents: () => number;
  close: () => void;
}

const MIGRATION_EVENTS_SQL = `
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
`;

export function openHubDatabase(dbPath: string): HubDatabase {
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(MIGRATION_EVENTS_SQL);

  const db = drizzle(sqlite);

  const insertTx = sqlite.transaction((validated: EventEnvelope): EventEnvelope => {
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
  });

  return {
    sqlite,
    db,
    appendEvent(event: EventEnvelope): EventEnvelope {
      const validated = EventEnvelopeSchema.parse(event);
      return insertTx(validated);
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
