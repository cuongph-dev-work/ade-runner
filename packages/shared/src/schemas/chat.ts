import { z } from "zod";
import { ALLOWED_REACTION_EMOJIS } from "../validation-catalog.js";

export const ProjectIdParamSchema = z.object({
  projectId: z.string().trim().min(1)
});
export type ProjectIdParam = z.infer<typeof ProjectIdParamSchema>;

export const ChannelIdParamSchema = z.object({
  channelId: z.string().trim().min(1)
});
export type ChannelIdParam = z.infer<typeof ChannelIdParamSchema>;

export const ThreadIdParamSchema = z.object({
  threadId: z.string().trim().min(1)
});
export type ThreadIdParam = z.infer<typeof ThreadIdParamSchema>;

export const MessageIdParamSchema = z.object({
  messageId: z.string().trim().min(1)
});
export type MessageIdParam = z.infer<typeof MessageIdParamSchema>;

export const ConfigErrorItemSchema = z.object({
  file: z.string().min(1),
  field: z.string().min(1),
  message: z.string().min(1)
});
export type ConfigErrorItem = z.infer<typeof ConfigErrorItemSchema>;

export const ColleagueSummarySchema = z.object({
  id: z.string().min(1),
  handle: z.string().startsWith("@"),
  name: z.string().min(1),
  role: z.string().min(1)
});
export type ColleagueSummary = z.infer<typeof ColleagueSummarySchema>;

export const ProjectSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  repoPath: z.string().min(1),
  defaultBranch: z.string().min(1),
  defaultMainAgent: z.string().nullable(),
  workflowId: z.string().min(1),
  memoryPath: z.string().min(1),
  useRepoInstructions: z.boolean(),
  colleagues: z.array(ColleagueSummarySchema),
  configErrors: z.array(ConfigErrorItemSchema),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;

export const ProjectListResponseSchema = z.object({
  projects: z.array(ProjectSummarySchema)
});
export type ProjectListResponse = z.infer<typeof ProjectListResponseSchema>;

export const AgentSummarySchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  handle: z.string().startsWith("@"),
  displayName: z.string().min(1),
  avatar: z.string().nullable(),
  role: z.string(),
  harness: z.enum(["claude-code", "codex"]),
  model: z.string().min(1),
  credentialProfile: z.string().min(1),
  mcpAllow: z.array(z.string()),
  write: z.boolean(),
  canBeMain: z.boolean(),
  enabled: z.boolean(),
  maxDepth: z.number().int(),
  budgetUsd: z.number().nullable(),
  timeoutS: z.number().int(),
  sourceFile: z.string().min(1),
  updatedAt: z.string()
});
export type AgentSummary = z.infer<typeof AgentSummarySchema>;

export const AgentListResponseSchema = z.object({
  agents: z.array(AgentSummarySchema),
  configErrors: z.array(ConfigErrorItemSchema)
});
export type AgentListResponse = z.infer<typeof AgentListResponseSchema>;

export const ChannelMemberSchema = z.object({
  memberType: z.enum(["human", "agent"]),
  memberId: z.string().min(1),
  addedAt: z.string()
});
export type ChannelMember = z.infer<typeof ChannelMemberSchema>;

export const ChannelSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  members: z.array(ChannelMemberSchema),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type Channel = z.infer<typeof ChannelSchema>;

export const ChannelResponseSchema = z.object({
  channel: ChannelSchema
});
export type ChannelResponse = z.infer<typeof ChannelResponseSchema>;

export const ChannelListResponseSchema = z.object({
  channels: z.array(ChannelSchema)
});
export type ChannelListResponse = z.infer<typeof ChannelListResponseSchema>;

export const CreateChannelInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-_]*$/),
  description: z.string().trim().max(300).optional().default("")
});
export type CreateChannelInput = z.infer<typeof CreateChannelInputSchema>;

export const UpdateChannelInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-_]*$/),
  description: z.string().trim().max(300).optional().default(""),
  memberUserIds: z.array(z.string().min(1)).optional(),
  memberAgentIds: z.array(z.string().min(1)).optional()
});
export type UpdateChannelInput = z.infer<typeof UpdateChannelInputSchema>;

export const DeleteChannelResponseSchema = z.object({
  deletedChannelId: z.string().min(1)
});
export type DeleteChannelResponse = z.infer<typeof DeleteChannelResponseSchema>;

export const ReactionSummarySchema = z.object({
  emoji: z.enum(ALLOWED_REACTION_EMOJIS),
  count: z.number().int().positive(),
  userIds: z.array(z.string().min(1)),
  reactedByMe: z.boolean()
});
export type ReactionSummary = z.infer<typeof ReactionSummarySchema>;

export const ToggleReactionInputSchema = z.object({
  emoji: z.enum(ALLOWED_REACTION_EMOJIS)
});
export type ToggleReactionInput = z.infer<typeof ToggleReactionInputSchema>;

export const ToggleReactionResponseSchema = z.object({
  messageId: z.string().min(1),
  threadId: z.string().min(1),
  channelId: z.string().min(1),
  reactions: z.array(ReactionSummarySchema)
});
export type ToggleReactionResponse = z.infer<typeof ToggleReactionResponseSchema>;

export const MessageKindSchema = z.enum([
  "text",
  "system",
  "live_card",
  "explorer_card",
  "approval_card",
  "question_card"
]);
export type MessageKind = z.infer<typeof MessageKindSchema>;

export const MessageSchema = z.object({
  id: z.string().min(1),
  threadId: z.string().min(1),
  isRoot: z.boolean(),
  authorType: z.enum(["human", "agent", "system", "runner"]),
  authorId: z.string().min(1),
  kind: MessageKindSchema,
  body: z.string(),
  mentions: z.array(z.string()),
  humanMentions: z.array(z.string()),
  reactions: z.array(ReactionSummarySchema),
  card: z.record(z.string(), z.unknown()).nullable(),
  runId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type Message = z.infer<typeof MessageSchema>;

export const MessageListResponseSchema = z.object({
  messages: z.array(MessageSchema)
});
export type MessageListResponse = z.infer<typeof MessageListResponseSchema>;

export const ThreadSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  channelId: z.string().min(1),
  rootMessageId: z.string().min(1),
  rootMessage: MessageSchema,
  title: z.string().min(1),
  state: z.string().min(1),
  previousState: z.string().nullable(),
  workflowId: z.string().min(1),
  mainAgentId: z.string().nullable(),
  summary: z.string(),
  budgetUsd: z.number().nullable(),
  spentUsd: z.number(),
  engineHalted: z.boolean(),
  replyCount: z.number().int().nonnegative(),
  lastReplyAt: z.string().nullable(),
  participantIds: z.array(z.string()),
  pendingQuestionCount: z.number().int().nonnegative().default(0),
  explorerCitationCount: z.number().int().nonnegative().default(0),
  createdBy: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type Thread = z.infer<typeof ThreadSchema>;

export const ThreadResponseSchema = z.object({
  thread: ThreadSchema
});
export type ThreadResponse = z.infer<typeof ThreadResponseSchema>;

export const ThreadListResponseSchema = z.object({
  threads: z.array(ThreadSchema)
});
export type ThreadListResponse = z.infer<typeof ThreadListResponseSchema>;

export const CreateThreadInputSchema = z.object({
  body: z.string().trim().min(1).max(20000),
  title: z.string().trim().max(200).nullable().optional()
});
export type CreateThreadInput = z.infer<typeof CreateThreadInputSchema>;

export const CreateThreadResponseSchema = z.object({
  thread: ThreadSchema,
  rootMessage: MessageSchema,
  systemMessage: MessageSchema.nullable(),
  validMentions: z.array(z.string()),
  humanMentions: z.array(z.string()),
  unknownMentions: z.array(z.string())
});
export type CreateThreadResponse = z.infer<typeof CreateThreadResponseSchema>;

export const CreateMessageInputSchema = z.object({
  body: z.string().trim().min(1).max(20000)
});
export type CreateMessageInput = z.infer<typeof CreateMessageInputSchema>;

export const PostMessageResponseSchema = z.object({
  message: MessageSchema,
  systemMessage: MessageSchema.nullable(),
  validMentions: z.array(z.string()),
  humanMentions: z.array(z.string()),
  unknownMentions: z.array(z.string())
});
export type PostMessageResponse = z.infer<typeof PostMessageResponseSchema>;

export const WsClientEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ping") })
]);
export type WsClientEvent = z.infer<typeof WsClientEventSchema>;

export const WsServerEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ws.connected"),
    data: z.object({
      mode: z.literal("solo"),
      serverTime: z.string()
    })
  }),
  z.object({
    type: z.literal("ws.pong"),
    data: z.object({ ts: z.string() })
  }),
  z.object({
    type: z.literal("ws.error"),
    data: z.object({ code: z.string(), message: z.string() })
  }),
  z.object({
    type: z.literal("channel.created"),
    data: z.object({
      eventId: z.string(),
      seq: z.number().int(),
      projectId: z.string(),
      channel: ChannelSchema
    })
  }),
  z.object({
    type: z.literal("channel.updated"),
    data: z.object({
      eventId: z.string(),
      seq: z.number().int(),
      projectId: z.string(),
      channel: ChannelSchema
    })
  }),
  z.object({
    type: z.literal("channel.deleted"),
    data: z.object({
      eventId: z.string(),
      seq: z.number().int(),
      projectId: z.string(),
      channelId: z.string()
    })
  }),
  z.object({
    type: z.literal("thread.created"),
    data: z.object({
      eventId: z.string(),
      seq: z.number().int(),
      projectId: z.string(),
      channelId: z.string(),
      thread: ThreadSchema
    })
  }),
  z.object({
    type: z.literal("message.posted"),
    data: z.object({
      eventId: z.string(),
      seq: z.number().int(),
      projectId: z.string(),
      channelId: z.string(),
      threadId: z.string(),
      message: MessageSchema
    })
  }),
  z.object({
    type: z.literal("message.reaction_toggled"),
    data: z.object({
      eventId: z.string(),
      seq: z.number().int(),
      projectId: z.string(),
      channelId: z.string(),
      threadId: z.string(),
      messageId: z.string(),
      emoji: z.enum(ALLOWED_REACTION_EMOJIS),
      actorId: z.string(),
      added: z.boolean(),
      reactions: z.array(ReactionSummarySchema)
    })
  }),
  z.object({
    type: z.literal("agent.mentioned"),
    data: z.object({
      eventId: z.string(),
      seq: z.number().int(),
      projectId: z.string(),
      threadId: z.string(),
      messageId: z.string(),
      agent: z.string().startsWith("@"),
      agentId: z.string(),
      text: z.string()
    })
  }),
  z.object({
    type: z.literal("project.config_updated"),
    data: z.object({
      projectId: z.string(),
      agents: z.array(AgentSummarySchema),
      configErrors: z.array(ConfigErrorItemSchema)
    })
  })
]);
export type WsServerEvent = z.infer<typeof WsServerEventSchema>;
