import { z } from "zod";

export const HarnessTypeSchema = z.enum(["claude-code", "codex"]);
export type HarnessType = z.infer<typeof HarnessTypeSchema>;

export const CredentialProfileSchema = z.enum(["sub-claude", "sub-chatgpt", "api-key"]);
export type CredentialProfile = z.infer<typeof CredentialProfileSchema>;

export const RunStatusSchema = z.enum([
  "queued",
  "running",
  "waiting_permission",
  "waiting_human",
  "completed",
  "failed",
  "cancelled"
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const RunOutcomeSchema = z.enum(["done", "blocked", "needs_revision", "unknown"]);
export type RunOutcome = z.infer<typeof RunOutcomeSchema>;

export const StopReasonSchema = z.enum([
  "end_turn",
  "max_tokens",
  "cancelled",
  "error",
  "timeout",
  "budget_exceeded"
]);
export type StopReason = z.infer<typeof StopReasonSchema>;

export const RunnerStatusSchema = z.enum(["online", "offline"]);
export type RunnerStatus = z.infer<typeof RunnerStatusSchema>;

export const PlanItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  status: z.enum(["pending", "in_progress", "completed"])
});
export type PlanItem = z.infer<typeof PlanItemSchema>;

export const ToolCallLogItemSchema = z.object({
  callId: z.string().min(1),
  tool: z.string().min(1),
  summary: z.string().min(1),
  status: z.enum(["running", "completed", "failed"])
});
export type ToolCallLogItem = z.infer<typeof ToolCallLogItemSchema>;

export const StepLogItemSchema = z.object({
  text: z.string().min(1),
  step: z.number().int().nullable(),
  percent: z.number().min(0).max(100).nullable()
});
export type StepLogItem = z.infer<typeof StepLogItemSchema>;

export const NormalizedRunEventSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("plan"),
    data: z.object({ items: z.array(PlanItemSchema) })
  }),
  z.object({
    kind: z.literal("tool_call"),
    data: ToolCallLogItemSchema
  }),
  z.object({
    kind: z.literal("message_chunk"),
    data: z.object({ textDelta: z.string() })
  }),
  z.object({
    kind: z.literal("step"),
    data: StepLogItemSchema
  })
]);
export type NormalizedRunEvent = z.infer<typeof NormalizedRunEventSchema>;

export const PermissionOptionSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1),
  decision: z.enum(["allow", "deny"])
});
export type PermissionOption = z.infer<typeof PermissionOptionSchema>;

export const SkillMountSpecSchema = z.object({
  name: z.string().min(1),
  sourceDir: z.string().min(1),
  contentHash: z.string().min(1)
});
export type SkillMountSpec = z.infer<typeof SkillMountSpecSchema>;

export const FakePlanStepSchema = z.object({
  plan: z.array(z.string().min(1)).min(1)
});

export const FakeToolCallStepSchema = z.object({
  tool_call: z.object({
    name: z.string().min(1),
    path: z.string().optional(),
    args: z.record(z.string(), z.unknown()).optional()
  })
});

export const FakeRequestPermissionStepSchema = z.object({
  request_permission: z.object({
    tool: z.string().min(1),
    command: z.string().optional(),
    args: z.record(z.string(), z.unknown()).optional(),
    expect: z.enum(["allow", "deny"])
  })
});

export const FakeMcpStepSchema = z.object({
  mcp: z.object({
    tool: z.string().min(1),
    args: z.record(z.string(), z.unknown()).default({})
  })
});

export const FakeSleepStepSchema = z.object({
  sleep: z.number().positive()
});

export const FakeMessageStepSchema = z.object({
  message: z.string().min(1)
});

export const FakeScenarioStepSchema = z.union([
  FakePlanStepSchema,
  FakeToolCallStepSchema,
  FakeRequestPermissionStepSchema,
  FakeMcpStepSchema,
  FakeSleepStepSchema,
  FakeMessageStepSchema
]);
export type FakeScenarioStep = z.infer<typeof FakeScenarioStepSchema>;

export const FakeScenarioYamlSchema = z.object({
  agent: z.string().regex(/^@[a-z0-9-]+$/),
  steps: z.array(FakeScenarioStepSchema).min(1)
});
export type FakeScenarioYaml = z.infer<typeof FakeScenarioYamlSchema>;

export const RunnerHelloMessageSchema = z.object({
  type: z.literal("runner.hello"),
  runnerId: z.string().startsWith("rnr_"),
  machineName: z.string().min(1),
  harnessesAvailable: z.array(HarnessTypeSchema),
  version: z.string().min(1)
});

export const RunStartMessageSchema = z.object({
  type: z.literal("run.start"),
  runId: z.string().startsWith("run_"),
  projectId: z.string().startsWith("prj_"),
  threadId: z.string().startsWith("thr_"),
  repoPath: z.string().min(1),
  defaultBranch: z.string().min(1),
  useRepoInstructions: z.boolean(),
  agent: z.object({
    id: z.string().startsWith("agt_"),
    handle: z.string().startsWith("@"),
    displayName: z.string().min(1),
    role: z.string(),
    harness: HarnessTypeSchema,
    model: z.string().nullable(),
    credentialProfile: CredentialProfileSchema,
    write: z.boolean(),
    timeoutS: z.number().int().positive(),
    scenarioFile: z.string().optional()
  }),
  skills: z.array(SkillMountSpecSchema),
  prompt: z.string().min(1),
  context: z.string(),
  mcpUrl: z.string().url().nullable(),
  mcpToken: z.string().min(1).nullable(),
  resumeSessionId: z.string().nullable()
});

export const RunPromptMessageSchema = z.object({
  type: z.literal("run.prompt"),
  runId: z.string().startsWith("run_"),
  text: z.string().min(1)
});

export const RunCancelMessageSchema = z.object({
  type: z.literal("run.cancel"),
  runId: z.string().startsWith("run_"),
  reason: z.string().min(1)
});

export const RunEventMessageSchema = z.object({
  type: z.literal("run.event"),
  runId: z.string().startsWith("run_"),
  ts: z.string(),
  acpSessionId: z.string().nullable(),
  event: NormalizedRunEventSchema
});

export const PermissionRequestMessageSchema = z.object({
  type: z.literal("permission.request"),
  runId: z.string().startsWith("run_"),
  requestId: z.string().startsWith("req_"),
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()),
  displayCommand: z.string().min(1),
  options: z.array(PermissionOptionSchema).length(2)
});

export const PermissionReplyMessageSchema = z.object({
  type: z.literal("permission.reply"),
  runId: z.string().startsWith("run_"),
  requestId: z.string().startsWith("req_"),
  optionId: z.string().min(1).max(64),
  decision: z.enum(["allow", "deny"])
});

export const RunEndMessageSchema = z.object({
  type: z.literal("run.end"),
  runId: z.string().startsWith("run_"),
  stopReason: StopReasonSchema,
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  acpSessionId: z.string().nullable(),
  usage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    costUsd: z.number().nonnegative()
  })
});

export const RunnerMessageSchema = z.discriminatedUnion("type", [
  RunnerHelloMessageSchema,
  RunStartMessageSchema,
  RunPromptMessageSchema,
  RunCancelMessageSchema,
  RunEventMessageSchema,
  PermissionRequestMessageSchema,
  PermissionReplyMessageSchema,
  RunEndMessageSchema
]);
export type RunnerMessage = z.infer<typeof RunnerMessageSchema>;
export type RunStartMessage = z.infer<typeof RunStartMessageSchema>;
export type PermissionRequestMessage = z.infer<typeof PermissionRequestMessageSchema>;
export type PermissionReplyMessage = z.infer<typeof PermissionReplyMessageSchema>;
export type RunEndMessage = z.infer<typeof RunEndMessageSchema>;

export const LiveCardPayloadSchema = z.object({
  cardType: z.literal("live_card"),
  runId: z.string().startsWith("run_"),
  agentId: z.string().startsWith("agt_"),
  agentHandle: z.string().startsWith("@"),
  agentDisplayName: z.string().min(1),
  invokedBy: z.string().min(1),
  runnerMachineName: z.string().nullable(),
  status: RunStatusSchema,
  plan: z.array(PlanItemSchema),
  toolCalls: z.array(ToolCallLogItemSchema),
  steps: z.array(StepLogItemSchema),
  lastMessageText: z.string(),
  outcome: RunOutcomeSchema.nullable(),
  stopReason: StopReasonSchema.nullable(),
  errorCode: z.string().nullable(),
  costUsd: z.number().nonnegative(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable()
});
export type LiveCardPayload = z.infer<typeof LiveCardPayloadSchema>;

export const PermissionCardPayloadSchema = z.object({
  cardType: z.literal("tool_permission"),
  runId: z.string().startsWith("run_"),
  requestId: z.string().startsWith("req_"),
  agentHandle: z.string().startsWith("@"),
  invokedBy: z.string().min(1),
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()),
  displayCommand: z.string().min(1),
  options: z.array(PermissionOptionSchema),
  status: z.enum(["pending", "allowed", "denied", "cancelled"]),
  selectedOptionId: z.string().nullable(),
  decidedBy: z.string().nullable(),
  decidedAt: z.string().nullable()
});
export type PermissionCardPayload = z.infer<typeof PermissionCardPayloadSchema>;

export const ProjectRunsParamsSchema = z.object({
  projectId: z.string().regex(/^prj_[a-zA-Z0-9_-]{2,32}$/, "MSG04")
});

export const ThreadRunsParamsSchema = z.object({
  threadId: z.string().regex(/^thr_[a-zA-Z0-9_-]{2,32}$/, "MSG04")
});

export const PermissionReplyParamsSchema = z.object({
  runId: z.string().regex(/^run_[a-zA-Z0-9_-]{2,32}$/, "MSG04"),
  requestId: z.string().regex(/^req_[a-zA-Z0-9_-]{2,32}$/, "MSG04")
});

export const PermissionReplyBodySchema = z.object({
  optionId: z
    .string({ required_error: "MSG01", invalid_type_error: "MSG01" })
    .trim()
    .min(1, "MSG01")
    .max(64, "MSG02"),
  decision: z
    .string({ required_error: "MSG01", invalid_type_error: "MSG01" })
    .min(1, "MSG01")
    .refine((val): val is "allow" | "deny" => val === "allow" || val === "deny", {
      message: "MSG04"
    })
});
export type PermissionReplyBody = z.infer<typeof PermissionReplyBodySchema>;

export const CancelRunParamsSchema = z.object({
  runId: z.string().regex(/^run_[a-zA-Z0-9_-]{2,32}$/, "MSG04")
});

export const RunSchema = z.object({
  id: z.string().startsWith("run_"),
  projectId: z.string().startsWith("prj_"),
  threadId: z.string().startsWith("thr_"),
  agentId: z.string().startsWith("agt_"),
  agentHandle: z.string().startsWith("@"),
  agentDisplayName: z.string(),
  harness: HarnessTypeSchema,
  runnerId: z.string().nullable(),
  runnerMachineName: z.string().nullable(),
  invokedBy: z.string(),
  credentialProfile: CredentialProfileSchema,
  acpSessionId: z.string().nullable(),
  role: z.enum(["main", "worker"]),
  depth: z.number().int().nonnegative(),
  timeoutS: z.number().int().positive(),
  status: RunStatusSchema,
  outcome: RunOutcomeSchema.nullable(),
  stopReason: StopReasonSchema.nullable(),
  costUsd: z.number().nonnegative(),
  liveCardMessageId: z.string().nullable(),
  pendingPermissionTool: z.string().nullable(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  createdAt: z.string()
});
export type RunSummary = z.infer<typeof RunSchema>;

export const RunListResponseSchema = z.object({
  runs: z.array(RunSchema)
});
export type RunListResponse = z.infer<typeof RunListResponseSchema>;
export const ThreadRunsResponseSchema = RunListResponseSchema;
export type ThreadRunsResponse = RunListResponse;

export const PermissionReplyResponseSchema = z.object({
  runId: z.string(),
  requestId: z.string(),
  optionId: z.string(),
  decision: z.enum(["allow", "deny"]),
  runStatus: RunStatusSchema,
  cardStatus: z.enum(["allowed", "denied"]),
  messageCode: z.literal("MSG16")
});
export type PermissionReplyResponse = z.infer<typeof PermissionReplyResponseSchema>;

export const CancelRunResponseSchema = z.object({
  runId: z.string(),
  status: z.literal("cancelled"),
  endedAt: z.string()
});
export type CancelRunResponse = z.infer<typeof CancelRunResponseSchema>;

export const WsRunnerServerEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message.created"),
    data: z.object({
      eventId: z.string().min(1),
      seq: z.number().int().nonnegative(),
      projectId: z.string().startsWith("prj_"),
      channelId: z.string().startsWith("chn_"),
      threadId: z.string().startsWith("thr_"),
      messageId: z.string().startsWith("msg_"),
      runId: z.string().nullable().optional(),
      kind: z.enum(["live_card", "approval_card", "system"]),
      body: z.string(),
      card: z.union([LiveCardPayloadSchema, PermissionCardPayloadSchema]).nullable().optional()
    })
  }),
  z.object({
    type: z.literal("message.updated"),
    data: z.object({
      eventId: z.string().min(1),
      seq: z.number().int().nonnegative(),
      projectId: z.string().startsWith("prj_"),
      channelId: z.string().startsWith("chn_"),
      threadId: z.string().startsWith("thr_"),
      messageId: z.string().startsWith("msg_"),
      runId: z.string().nullable().optional(),
      kind: z.enum(["live_card", "approval_card"]),
      card: z.union([LiveCardPayloadSchema, PermissionCardPayloadSchema])
    })
  }),
  z.object({
    type: z.literal("run.updated"),
    data: z.object({
      eventId: z.string().min(1),
      seq: z.number().int().nonnegative(),
      projectId: z.string().startsWith("prj_"),
      channelId: z.string().startsWith("chn_"),
      threadId: z.string().startsWith("thr_"),
      run: RunSchema
    })
  })
]);
export type WsRunnerServerEvent = z.infer<typeof WsRunnerServerEventSchema>;
