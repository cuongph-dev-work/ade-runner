import { z } from "zod";

export const EVENT_TYPES = [
  "project.registered",
  "channel.created",
  "channel.updated",
  "channel.deleted",
  "thread.created",
  "message.posted",
  "message.reaction_toggled",
  "agent.mentioned",
  "runner.connected",
  "runner.disconnected",
  "run.queued",
  "run.started",
  "run.progress",
  "run.permission_requested",
  "run.permission_resolved",
  "run.completed",
  "run.failed",
  "run.cancelled",
  "agent.granted",
  "agent.revoked",
  "thread.state_changed",
  "question.asked",
  "question.answered",
  "question.timed_out",
  "hook.fired",
  "mcp.called",
  "run.outcome_reported",
  "engine.halted",
  "command.invoked",
  "main.changed",
  "task.delegated",
  "run.result_ready",
  "delegation.completed",
  "approval.requested",
  "approval.resolved",
  "approval.reminded",
  "scratchpad.updated",
  "memory.proposed",
  "memory.resolved",
  "thread.summary_updated",
  "run.usage_updated",
  "budget.warning"
] as const;

export const EventTypeSchema = z.enum(EVENT_TYPES);
export type EventType = z.infer<typeof EventTypeSchema>;

export const ActorTypeSchema = z.enum(["human", "agent", "system", "runner"]);
export type ActorType = z.infer<typeof ActorTypeSchema>;

export const ActorSchema = z.object({
  type: ActorTypeSchema,
  id: z.string().min(1)
});
export type Actor = z.infer<typeof ActorSchema>;

export const EventEnvelopeSchema = z.object({
  id: z.string().regex(/^evt_[0-9A-Za-z]+$/),
  seq: z.number().int().positive().optional(),
  type: EventTypeSchema,
  ts: z.string().datetime(),
  project_id: z.string().nullable().default(null),
  thread_id: z.string().nullable().default(null),
  run_id: z.string().nullable().default(null),
  actor: ActorSchema,
  causation_id: z.string().nullable().default(null),
  correlation_id: z.string().nullable().default(null),
  payload: z.record(z.string(), z.unknown())
});
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
