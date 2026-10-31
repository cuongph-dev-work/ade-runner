import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const eventsTable = sqliteTable("events", {
  id: text("id").primaryKey(),
  seq: integer("seq").notNull().unique(),
  type: text("type").notNull(),
  projectId: text("project_id"),
  threadId: text("thread_id"),
  runId: text("run_id"),
  actorType: text("actor_type").notNull(),
  actorId: text("actor_id").notNull(),
  payload: text("payload").notNull(),
  causationId: text("causation_id"),
  correlationId: text("correlation_id"),
  ts: text("ts").notNull()
});
