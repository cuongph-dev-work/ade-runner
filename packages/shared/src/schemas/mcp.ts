import { z } from "zod";

const SKILL_NAME_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const McpReportOutcomeInputSchema = z.object({
  status: z.enum(["done", "blocked", "needs_revision"]),
  summary: z.string().trim().min(1).max(4000),
  decisions: z.array(z.string().trim().min(1)).optional().default([]),
});
export type McpReportOutcomeInput = z.infer<typeof McpReportOutcomeInputSchema>;

export const McpReportOutcomeOutputSchema = z.object({
  ok: z.literal(true),
  run_id: z.string(),
  recorded_outcome: z.enum(["done", "blocked", "needs_revision"]),
});
export type McpReportOutcomeOutput = z.infer<typeof McpReportOutcomeOutputSchema>;

export const McpPostProgressInputSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  step: z.string().max(200).nullable().optional(),
  percent: z.number().int().min(0).max(100).nullable().optional(),
});
export type McpPostProgressInput = z.infer<typeof McpPostProgressInputSchema>;

export const McpOkOutputSchema = z.object({
  ok: z.literal(true),
});
export type McpOkOutput = z.infer<typeof McpOkOutputSchema>;

export const ExplorerCitationSchema = z
  .object({
    file: z.string().trim().min(1).max(512),
    start_line: z.number().int().min(1),
    end_line: z.number().int().min(1),
    role: z.string().trim().min(1).max(120),
    snippet: z.string().min(1).max(8000),
    note: z.string().max(500).nullable().optional(),
  })
  .refine((val) => val.end_line >= val.start_line, {
    path: ["end_line"],
    message: "MSG04",
  });
export type ExplorerCitation = z.infer<typeof ExplorerCitationSchema>;

export const ExplorerInsightInputSchema = z.object({
  topic: z.string().trim().min(1).max(200),
  flow_steps: z.array(z.string().trim().min(1).max(1000)).min(1).max(12),
  trace_steps: z
    .array(z.string().trim().min(1).max(500))
    .max(30)
    .nullable()
    .optional()
    .transform((v) => v ?? []),
  citations: z.array(ExplorerCitationSchema).min(1).max(20),
});
export type ExplorerInsightInput = z.infer<typeof ExplorerInsightInputSchema>;

export const ExplorerCardPayloadSchema = z.object({
  cardType: z.literal("explorer"),
  agent_handle: z.string().min(1),
  topic: z.string().min(1),
  flow_steps: z.array(z.string()),
  trace_steps: z.array(z.string()).default([]),
  citations: z.array(ExplorerCitationSchema),
  cost_usd: z.number().min(0),
  duration_ms: z.number().int().min(0),
});
export type ExplorerCardPayload = z.infer<typeof ExplorerCardPayloadSchema>;

export const McpPostMessageInputSchema = z
  .object({
    text: z.string().trim().min(1).max(10000),
    kind: z.enum(["note", "result", "explorer_card"]).nullable().optional().default("note"),
    explorer: ExplorerInsightInputSchema.nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.kind === "explorer_card" && !val.explorer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["explorer"],
        message: "MSG01",
      });
    }
  });
export type McpPostMessageInput = z.infer<typeof McpPostMessageInputSchema>;

export const McpPostMessageOutputSchema = z.object({
  ok: z.literal(true),
  message_id: z.string(),
});
export type McpPostMessageOutput = z.infer<typeof McpPostMessageOutputSchema>;

export const ClarifierOptionSchema = z.object({
  id: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(300),
  hint: z.string().max(300).nullable().optional(),
  recommended: z.boolean().optional().default(false),
});
export type ClarifierOption = z.infer<typeof ClarifierOptionSchema>;

export const ClarifierQuestionSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    type: z.enum(["single", "multi", "text"]),
    prompt: z.string().trim().min(1).max(500),
    options: z.array(ClarifierOptionSchema).optional(),
    allow_other: z.boolean().optional(),
    suggestions: z.array(z.string().trim().min(1).max(200)).max(6).optional(),
    required: z.boolean().optional().default(true),
  })
  .transform((q) => ({
    ...q,
    allow_other: q.allow_other ?? (q.type === "single" || q.type === "multi"),
  }))
  .superRefine((q, ctx) => {
    if (q.type === "single" || q.type === "multi") {
      if (!q.options || q.options.length < 2 || q.options.length > 12) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options"],
          message: "MSG04",
        });
      } else {
        const optIds = new Set<string>();
        q.options.forEach((opt, idx) => {
          if (optIds.has(opt.id) || opt.id === "__other__") {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["options", idx, "id"],
              message: "MSG04",
            });
          }
          optIds.add(opt.id);
        });
      }
    }
  });
export type ClarifierQuestion = z.infer<typeof ClarifierQuestionSchema>;

export const QuestionAnswerItemSchema = z
  .object({
    question_id: z.string().trim().min(1).max(64),
    selected_option_ids: z.array(z.string().trim().min(1).max(100)).optional().default([]),
    other_text: z.string().trim().max(1000, "MSG02").nullable().optional(),
    text: z.string().trim().max(2000, "MSG02").nullable().optional(),
  })
  .superRefine((item, ctx) => {
    if (item.selected_option_ids.includes("__other__")) {
      if (!item.other_text || item.other_text.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["other_text"],
          message: "MSG01",
        });
      }
    }
  });
export type QuestionAnswerItem = z.infer<typeof QuestionAnswerItemSchema>;

export const McpAskHumanInputSchema = z
  .object({
    question: z.string().trim().min(1).max(2000),
    options: z.array(z.string().trim().min(1)).nullable().optional(),
    questions: z.array(ClarifierQuestionSchema).min(1).max(10).nullable().optional(),
    timeout_s: z.number().int().min(1).max(7200).nullable().optional().default(1800),
  })
  .superRefine((val, ctx) => {
    if (val.questions) {
      const seen = new Set<string>();
      val.questions.forEach((q, idx) => {
        if (seen.has(q.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["questions", idx, "id"],
            message: "MSG04",
          });
        }
        seen.add(q.id);
      });
    }
  });
export type McpAskHumanInput = z.infer<typeof McpAskHumanInputSchema>;

export const McpAskHumanOutputSchema = z.object({
  answer: z.string(),
  option_id: z.string().nullable(),
  answers: z.array(QuestionAnswerItemSchema).default([]),
  answered_by: z.string(),
});
export type McpAskHumanOutput = z.infer<typeof McpAskHumanOutputSchema>;

export const McpReadMemoryInputSchema = z.object({
  scope: z.enum(["project", "thread"]),
  query: z.string().max(200).nullable().optional(),
  thread_id: z.string().trim().max(64).nullable().optional(),
});
export type McpReadMemoryInput = z.infer<typeof McpReadMemoryInputSchema>;

export const McpReadMemoryOutputSchema = z.object({
  entries: z.array(
    z.object({
      key: z.string(),
      scope: z.enum(["project", "thread"]),
      content: z.string(),
    })
  ),
});
export type McpReadMemoryOutput = z.infer<typeof McpReadMemoryOutputSchema>;

export const McpGetThreadInputSchema = z.object({
  include_messages: z.number().int().min(0).max(200).nullable().optional().default(20),
  thread_id: z.string().trim().max(64).nullable().optional(),
});
export type McpGetThreadInput = z.infer<typeof McpGetThreadInputSchema>;

export const McpGetThreadOutputSchema = z.object({
  thread_id: z.string(),
  title: z.string(),
  state: z.string(),
  workflow_id: z.string(),
  summary: z.string().nullable(),
  scope: z.enum(["brief", "full"]),
  messages: z.array(
    z.object({
      id: z.string(),
      is_root: z.boolean(),
      author_type: z.string(),
      author_id: z.string(),
      kind: z.string(),
      body: z.string(),
      created_at: z.string(),
    })
  ),
});
export type McpGetThreadOutput = z.infer<typeof McpGetThreadOutputSchema>;

export const McpListSkillsInputSchema = z.object({});
export type McpListSkillsInput = z.infer<typeof McpListSkillsInputSchema>;

export const McpListSkillsOutputSchema = z.object({
  skills: z.array(
    z.object({
      name: z.string(),
      scope: z.enum(["project", "global"]),
      description: z.string(),
    })
  ),
});
export type McpListSkillsOutput = z.infer<typeof McpListSkillsOutputSchema>;

export const McpLoadSkillInputSchema = z.object({
  name: z.string().trim().min(1).regex(SKILL_NAME_REGEX),
});
export type McpLoadSkillInput = z.infer<typeof McpLoadSkillInputSchema>;

export const McpLoadSkillOutputSchema = z.object({
  name: z.string(),
  description: z.string(),
  content: z.string(),
  file_path: z.string(),
});
export type McpLoadSkillOutput = z.infer<typeof McpLoadSkillOutputSchema>;

export const McpSetStateInputSchema = z.object({
  to: z.string().trim().min(1).max(64),
  reason: z.string().trim().min(1).max(500),
});
export type McpSetStateInput = z.infer<typeof McpSetStateInputSchema>;

export const McpSetStateOutputSchema = z.object({
  ok: z.literal(true),
  from: z.string(),
  to: z.string(),
});
export type McpSetStateOutput = z.infer<typeof McpSetStateOutputSchema>;

export const QuestionStatusSchema = z.enum(["pending", "answered", "expired"]);
export type QuestionStatus = z.infer<typeof QuestionStatusSchema>;

export const QuestionCardPayloadSchema = z.object({
  question_id: z.string(),
  source: z.enum(["mcp", "rule"]),
  run_id: z.string().nullable(),
  agent_handle: z.string().nullable(),
  question: z.string(),
  options: z.array(z.string()).default([]),
  questions: z.array(ClarifierQuestionSchema).default([]),
  status: QuestionStatusSchema,
  answer: z.string().nullable().default(null),
  selected_option_id: z.string().nullable().default(null),
  answers: z.array(QuestionAnswerItemSchema).default([]),
  answered_by: z.string().nullable().default(null),
  answered_at: z.string().nullable().default(null),
  expires_at: z.string().nullable().default(null),
});
export type QuestionCardPayload = z.infer<typeof QuestionCardPayloadSchema>;

export const ThreadQuestionParamSchema = z.object({
  threadId: z.string().min(1),
  questionId: z.string().min(1),
});

export const ReplyQuestionInputSchema = z
  .object({
    answer: z.string().trim().max(2000, "MSG02").optional(),
    optionId: z.string().max(100, "MSG02").nullable().optional(),
    answers: z.array(QuestionAnswerItemSchema).nullable().optional(),
  })
  .superRefine((val, ctx) => {
    const hasAnswers = Array.isArray(val.answers) && val.answers.length > 0;
    if (!hasAnswers) {
      if (Array.isArray(val.answers) && val.answers.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["answers"],
          message: "MSG01",
        });
        return;
      }
      if (!val.answer || val.answer.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["answer"],
          message: "MSG01",
        });
      }
    }
  });
export type ReplyQuestionInput = z.infer<typeof ReplyQuestionInputSchema>;

export const ReplyQuestionResponseSchema = z.object({
  question_id: z.string(),
  status: z.literal("answered"),
  answer: z.string(),
  option_id: z.string().nullable(),
  answers: z.array(QuestionAnswerItemSchema).default([]),
  thread_state: z.string(),
});
export type ReplyQuestionResponse = z.infer<typeof ReplyQuestionResponseSchema>;

export const ThreadParamSchema = z.object({
  threadId: z.string().min(1),
});

export const ThreadAgentParamSchema = z.object({
  threadId: z.string().min(1),
  agentId: z.string().min(1),
});

export const ThreadAgentGrantSchema = z.object({
  agent_id: z.string(),
  handle: z.string(),
  display_name: z.string(),
  role: z.enum(["main", "worker"]),
  scope: z.enum(["brief", "full"]),
  granted_by: z.string(),
  granted_at: z.string(),
});
export type ThreadAgentGrant = z.infer<typeof ThreadAgentGrantSchema>;

export const ThreadAgentListResponseSchema = z.object({
  thread_id: z.string(),
  grants: z.array(ThreadAgentGrantSchema),
});
export type ThreadAgentListResponse = z.infer<typeof ThreadAgentListResponseSchema>;

export const RevokeThreadAgentResponseSchema = z.object({
  thread_id: z.string(),
  agent_id: z.string(),
  status: z.literal("revoked"),
  revoked_at: z.string(),
});
export type RevokeThreadAgentResponse = z.infer<typeof RevokeThreadAgentResponseSchema>;
