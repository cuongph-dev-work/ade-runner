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

export const ProjectRegisteredPayloadSchema = z.object({
  project_id: z.string().min(1),
  name: z.string().min(1),
  repo_path: z.string().min(1),
  workflow_id: z.string().min(1)
});

export const ChannelCreatedPayloadSchema = z.object({
  channel_id: z.string().min(1),
  project_id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  member_user_ids: z.array(z.string()),
  member_agent_ids: z.array(z.string())
});

export const ChannelUpdatedPayloadSchema = ChannelCreatedPayloadSchema;

export const ChannelDeletedPayloadSchema = z.object({
  channel_id: z.string().min(1),
  project_id: z.string().min(1)
});

export const ThreadCreatedPayloadSchema = z.object({
  thread_id: z.string().min(1),
  channel_id: z.string().min(1),
  title: z.string().min(1),
  initial_state: z.string().min(1),
  workflow_id: z.string().min(1),
  root_message_id: z.string().min(1)
});

export const MessagePostedPayloadSchema = z.object({
  message_id: z.string().min(1),
  kind: z.enum(["text", "system", "live_card", "explorer_card", "approval_card", "question_card"]),
  body: z.string(),
  is_root: z.boolean(),
  mentions: z.array(z.string()),
  human_mentions: z.array(z.string()),
  card: z.record(z.string(), z.unknown()).nullable().optional()
});

export const MessageReactionToggledPayloadSchema = z.object({
  message_id: z.string().min(1),
  thread_id: z.string().min(1),
  channel_id: z.string().min(1),
  emoji: z.string().min(1),
  actor_id: z.string().min(1),
  added: z.boolean()
});

export const AgentMentionedPayloadSchema = z.object({
  agent: z.string().startsWith("@"),
  agent_id: z.string().min(1),
  message_id: z.string().min(1),
  text: z.string()
});

export const AgentGrantedPayloadSchema = z.object({
  agent_id: z.string().min(1),
  role: z.enum(["main", "worker"]),
  scope: z.enum(["brief", "full"]),
  granted_by: z.string().min(1)
});

export const AgentRevokedPayloadSchema = z.object({
  agent_id: z.string().min(1)
});

export const ThreadStateChangedPayloadSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  reason: z.string().optional()
});

export const EngineHaltedPayloadSchema = z.object({
  reason: z.string().min(1),
  causation_depth: z.number().int().optional()
});

export const QuestionAskedPayloadSchema = z.object({
  question_id: z.string().min(1),
  run_id: z.string().nullable(),
  question: z.string().min(1),
  options: z.array(z.string()).default([]),
  questions: z.array(z.record(z.string(), z.unknown())).default([]),
  timeout_s: z.number().int().min(1).optional(),
  card_message_id: z.string().min(1)
});

export const QuestionAnsweredPayloadSchema = z.object({
  question_id: z.string().min(1),
  run_id: z.string().nullable(),
  answer: z.string().min(1),
  option_id: z.string().nullable(),
  answers: z.array(z.record(z.string(), z.unknown())).default([]),
  answered_by: z.string().min(1)
});

export const QuestionTimedOutPayloadSchema = z.object({
  question_id: z.string().min(1),
  run_id: z.string().nullable(),
  timed_out_at: z.string().datetime()
});

export const RunOutcomeReportedPayloadSchema = z.object({
  run_id: z.string().min(1),
  status: z.enum(["done", "blocked", "needs_revision"]),
  summary: z.string().min(1),
  decisions: z.array(z.string()).default([])
});

export const AdeEventSchema = EventEnvelopeSchema;
export type AdeEvent = z.infer<typeof AdeEventSchema>;
