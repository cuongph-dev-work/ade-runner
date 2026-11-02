import { z } from "zod";
import { WorkflowYamlSchema } from "./ade-config.js";

// 1. MCP propose_memory schemas
export const McpProposeMemoryInputSchema = z.object({
  scope: z.literal("project").default("project"),
  target_file: z
    .string()
    .min(1, "Tên tệp memory là bắt buộc.")
    .max(100, "Tên tệp memory không được vượt quá 100 ký tự.")
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.md$/, "Định dạng Tên tệp memory không hợp lệ."),
  content: z
    .string()
    .min(1, "Nội dung là bắt buộc.")
    .max(65536, "Nội dung không được vượt quá 65536 ký tự."),
  reason: z
    .string()
    .min(1, "Lý do đề xuất là bắt buộc.")
    .max(1000, "Lý do đề xuất không được vượt quá 1000 ký tự.")
});

export type McpProposeMemoryInput = z.infer<typeof McpProposeMemoryInputSchema>;

export const McpProposeMemoryOutputSchema = z.object({
  ok: z.boolean(),
  proposal_id: z.string(),
  message_id: z.string(),
  status: z.literal("pending")
});

export type McpProposeMemoryOutput = z.infer<typeof McpProposeMemoryOutputSchema>;

// 2. Memory files (CRUD .ade/memory/*.md)
export const MemoryFileSchema = z.object({
  fileName: z.string(),
  content: z.string(),
  sizeBytes: z.number(),
  updatedAt: z.string()
});

export type MemoryFile = z.infer<typeof MemoryFileSchema>;

export const MemoryFileListResponseSchema = z.object({
  files: z.array(MemoryFileSchema)
});

export type MemoryFileListResponse = z.infer<typeof MemoryFileListResponseSchema>;

export const PutMemoryFileInputSchema = z.object({
  content: z
    .string()
    .min(1, "Nội dung là bắt buộc.")
    .max(65536, "Nội dung không được vượt quá 65536 ký tự.")
});

export type PutMemoryFileInput = z.infer<typeof PutMemoryFileInputSchema>;

// 3. Memory proposals
export const MemoryProposalStatusSchema = z.enum(["pending", "approved", "rejected"]);
export type MemoryProposalStatus = z.infer<typeof MemoryProposalStatusSchema>;

export const MemoryProposalSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  threadId: z.string(),
  runId: z.string(),
  agentId: z.string(),
  agentHandle: z.string(),
  scope: z.string(),
  targetFile: z.string(),
  currentContent: z.string(),
  content: z.string(),
  reason: z.string(),
  status: MemoryProposalStatusSchema,
  decidedBy: z.string().nullable(),
  decidedAt: z.string().nullable(),
  createdAt: z.string()
});

export type MemoryProposal = z.infer<typeof MemoryProposalSchema>;

export const MemoryProposalListResponseSchema = z.object({
  proposals: z.array(MemoryProposalSchema)
});

export type MemoryProposalListResponse = z.infer<typeof MemoryProposalListResponseSchema>;

export const MemoryCardPayloadSchema = z.object({
  cardType: z.literal("memory_proposal"),
  proposalId: z.string(),
  agentHandle: z.string(),
  targetFile: z.string(),
  currentContent: z.string(),
  content: z.string(),
  reason: z.string(),
  status: MemoryProposalStatusSchema
});

export type MemoryCardPayload = z.infer<typeof MemoryCardPayloadSchema>;

export const DecideMemoryProposalInputSchema = z.object({
  decision: z.enum(["approve", "reject"], {
    errorMap: () => ({ message: "Định dạng Quyết định không hợp lệ." })
  })
});

export type DecideMemoryProposalInput = z.infer<typeof DecideMemoryProposalInputSchema>;

export const MemoryProposalQuerySchema = z.object({
  status: MemoryProposalStatusSchema.optional()
});

export type MemoryProposalQuery = z.infer<typeof MemoryProposalQuerySchema>;

// 4. Workflow YAML Editor & Detail
export const WorkflowParseErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  line: z.number().optional(),
  issues: z.array(z.string()).optional()
});

export type WorkflowParseError = z.infer<typeof WorkflowParseErrorSchema>;

export const WorkflowDetailResponseSchema = z.object({
  workflowId: z.string(),
  workflowYaml: z.string(),
  parsed: WorkflowYamlSchema.nullable(),
  parseError: WorkflowParseErrorSchema.nullable(),
  availableWorkflows: z.array(z.string()),
  availableAgents: z.array(z.string())
});

export type WorkflowDetailResponse = z.infer<typeof WorkflowDetailResponseSchema>;

export const PutWorkflowYamlInputSchema = z.object({
  workflowYaml: z
    .string()
    .min(1, "Nội dung Workflow YAML là bắt buộc.")
    .max(65536, "Nội dung Workflow YAML không được vượt quá 65536 ký tự.")
});

export type PutWorkflowYamlInput = z.infer<typeof PutWorkflowYamlInputSchema>;

// 5. Params
export const MemoryFileParamSchema = z.object({
  projectId: z.string().min(1, "Mã dự án là bắt buộc."),
  fileName: z
    .string()
    .min(1, "Tên tệp là bắt buộc.")
    .max(100, "Tên tệp không được vượt quá 100 ký tự.")
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.md$/, "Định dạng Tên tệp không hợp lệ.")
});

export const MemoryProposalParamSchema = z.object({
  proposalId: z.string().min(1, "Mã đề xuất ghi nhớ là bắt buộc.")
});

export const WorkflowParamSchema = z.object({
  projectId: z.string().min(1, "Mã dự án là bắt buộc."),
  workflowId: z
    .string()
    .min(1, "Mã workflow là bắt buộc.")
    .regex(/^[a-z0-9][a-z0-9-_]*$/, "Định dạng Mã workflow không hợp lệ.")
});

// 6. ACP Session Lifecycle
export const AcpSessionStatusSchema = z.enum(["active", "idle", "closed"]);
export type AcpSessionStatus = z.infer<typeof AcpSessionStatusSchema>;

export const AcpSessionInfoSchema = z.object({
  sessionKey: z.string(),
  acpSessionId: z.string(),
  threadId: z.string(),
  agentId: z.string(),
  status: AcpSessionStatusSchema,
  supportsLoadSession: z.boolean(),
  lastUsedAtMs: z.number()
});

export type AcpSessionInfo = z.infer<typeof AcpSessionInfoSchema>;
