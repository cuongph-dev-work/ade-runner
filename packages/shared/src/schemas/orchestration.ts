import { z } from "zod";
import { GateKindSchema, type GateKind } from "./ade-config.js";

export const ApprovalStatusSchema = z.enum(["pending", "approved", "changes_requested", "cancelled"]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalGateCardPayloadSchema = z.object({
  approval_id: z.string(),
  gate: GateKindSchema,
  version: z.number().int().min(1),
  title: z.string(),
  summary: z.string(),
  status: ApprovalStatusSchema,
  requested_by_agent: z.string(),
  decided_by: z.string().nullable().default(null),
  decided_at: z.string().nullable().default(null),
  feedback: z.string().nullable().default(null),
  target_state: z.string(),
});
export type ApprovalGateCardPayload = z.infer<typeof ApprovalGateCardPayloadSchema>;

export const ApprovalDecisionInputSchema = z.object({
  decision: z.enum(["approve", "changes_requested"]),
  feedback: z.string().trim().max(2000).optional(),
});
export type ApprovalDecisionInput = z.infer<typeof ApprovalDecisionInputSchema>;

export const DelegateWorkerTaskSchema = z.object({
  agent: z.string().trim().min(1),
  task: z.string().trim().min(1),
  scope: z.enum(["brief", "full"]).optional().default("brief"),
});
export type DelegateWorkerTask = z.infer<typeof DelegateWorkerTaskSchema>;

export const McpDelegateInputSchema = z.object({
  tasks: z.array(DelegateWorkerTaskSchema).min(1).max(5),
});
export type McpDelegateInput = z.infer<typeof McpDelegateInputSchema>;

export const McpDelegateOutputSchema = z.object({
  ok: z.literal(true),
  delegation_id: z.string(),
  delegated_runs: z.array(
    z.object({
      run_id: z.string(),
      agent: z.string(),
      scope: z.enum(["brief", "full"]),
      status: z.enum(["queued", "running"]),
    })
  ),
});
export type McpDelegateOutput = z.infer<typeof McpDelegateOutputSchema>;

export const McpRequestApprovalInputSchema = z.object({
  gate: GateKindSchema,
  summary: z.string().trim().min(1).max(5000),
  target_state: z.string().trim().min(1),
});
export type McpRequestApprovalInput = z.infer<typeof McpRequestApprovalInputSchema>;

export const McpRequestApprovalOutputSchema = z.object({
  ok: z.literal(true),
  approval_id: z.string(),
  version: z.number().int().min(1),
  gate: GateKindSchema,
  status: ApprovalStatusSchema,
});
export type McpRequestApprovalOutput = z.infer<typeof McpRequestApprovalOutputSchema>;

export const McpWriteScratchpadInputSchema = z.object({
  content: z.string().max(30000),
});
export type McpWriteScratchpadInput = z.infer<typeof McpWriteScratchpadInputSchema>;

export const McpReadScratchpadOutputSchema = z.object({
  content: z.string(),
  updated_at: z.string().nullable(),
});
export type McpReadScratchpadOutput = z.infer<typeof McpReadScratchpadOutputSchema>;

export const ScratchpadEntrySchema = z.object({
  thread_id: z.string(),
  agent_id: z.string(),
  agent_handle: z.string().optional(),
  content: z.string(),
  updated_at: z.string(),
});
export type ScratchpadEntry = z.infer<typeof ScratchpadEntrySchema>;

export const SlashCommandTypeSchema = z.enum(["approve", "revise", "main"]);
export type SlashCommandType = z.infer<typeof SlashCommandTypeSchema>;
