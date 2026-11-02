import { z } from "zod";
import { AgentHarnessSchema, AgentCredentialProfileSchema } from "./ade-config.js";
import { ConfigErrorItemSchema } from "./chat.js";

export const AgentIdParamSchema = z.object({
  projectId: z.string().trim().min(1),
  agentId: z.string().trim().min(1)
});

export const SkillNameParamSchema = z.object({
  projectId: z.string().trim().min(1).optional(),
  skillName: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: "Tên skill chỉ được gồm chữ thường, số và dấu gạch ngang (không chứa khoảng trắng, dấu ngoặc, dấu phẩy)."
    })
});

// API-1: Validate Repo
export const ValidateRepoInputSchema = z.object({
  repoPath: z.string().trim().min(1, "Đường dẫn kho mã nguồn là bắt buộc.").max(1024, "Đường dẫn kho mã nguồn không được vượt quá 1024 ký tự.")
});
export type ValidateRepoInput = z.infer<typeof ValidateRepoInputSchema>;

export const ValidateRepoResponseSchema = z.object({
  valid: z.boolean(),
  currentBranch: z.string(),
  branches: z.array(z.string()),
  hasAdeConfig: z.boolean(),
  hasRepoInstructions: z.boolean()
});
export type ValidateRepoResponse = z.infer<typeof ValidateRepoResponseSchema>;

// API-2: Create Project Wizard
export const ProjectTemplateIdSchema = z.enum([
  "lead_coder_tester_qa",
  "planner_coder",
  "empty"
]);
export type ProjectTemplateId = z.infer<typeof ProjectTemplateIdSchema>;

export const CreateProjectWizardInputSchema = z.object({
  projectName: z
    .string()
    .trim()
    .min(1, "Tên dự án là bắt buộc.")
    .max(100, "Tên dự án không được vượt quá 100 ký tự."),
  repoPath: z
    .string()
    .trim()
    .min(1, "Đường dẫn kho mã nguồn là bắt buộc.")
    .max(1024, "Đường dẫn kho mã nguồn không được vượt quá 1024 ký tự."),
  defaultBranch: z
    .string()
    .trim()
    .min(1, "Nhánh mặc định là bắt buộc.")
    .max(100, "Nhánh mặc định không được vượt quá 100 ký tự."),
  templateId: ProjectTemplateIdSchema.default("lead_coder_tester_qa"),
  useRepoInstructions: z.boolean().default(false)
});
export type CreateProjectWizardInput = z.infer<typeof CreateProjectWizardInputSchema>;

// API-3: Update Project General
export const UpdateProjectGeneralInputSchema = z.object({
  projectName: z
    .string()
    .trim()
    .min(1, "Tên dự án là bắt buộc.")
    .max(100, "Tên dự án không được vượt quá 100 ký tự."),
  defaultBranch: z
    .string()
    .trim()
    .min(1, "Nhánh mặc định là bắt buộc.")
    .max(100, "Nhánh mặc định không được vượt quá 100 ký tự."),
  defaultMainAgent: z
    .string()
    .trim()
    .regex(/^@[a-z0-9][a-z0-9-_]*$/, "Định dạng Main agent mặc định không hợp lệ.")
    .nullable(),
  defaultWorkflow: z
    .string()
    .trim()
    .min(1, "Workflow mặc định là bắt buộc.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Định dạng Workflow mặc định không hợp lệ."),
  useRepoInstructions: z.boolean()
});
export type UpdateProjectGeneralInput = z.infer<typeof UpdateProjectGeneralInputSchema>;

// Project Settings Response (API-2, API-3, API-14)
export const ProjectSettingsResponseSchema = z.object({
  project: z.object({
    id: z.string(),
    name: z.string(),
    repoPath: z.string(),
    defaultBranch: z.string(),
    defaultMainAgent: z.string().nullable(),
    defaultWorkflow: z.string(),
    useRepoInstructions: z.boolean(),
    memoryPath: z.string(),
    configErrors: z.array(ConfigErrorItemSchema)
  }),
  agents: z.array(z.any()), // AgentSummary[]
  workflows: z.array(z.string()),
  branches: z.array(z.string())
});
export type ProjectSettingsResponse = z.infer<typeof ProjectSettingsResponseSchema>;

// API-4 & API-5: Upsert Agent
export const UpsertAgentInputSchema = z.object({
  handle: z
    .string()
    .trim()
    .transform((v) => (v.startsWith("@") ? v : `@${v}`))
    .pipe(z.string().regex(/^@[a-z0-9][a-z0-9-_]*$/, "Định dạng Handle agent không hợp lệ.")),
  displayName: z
    .string()
    .trim()
    .min(1, "Tên hiển thị là bắt buộc.")
    .max(50, "Tên hiển thị không được vượt quá 50 ký tự."),
  avatar: z.string().trim().max(10).nullable().optional(),
  role: z.string().trim().min(1, "Mô tả vai trò là bắt buộc.").max(500, "Mô tả vai trò không được vượt quá 500 ký tự."),
  harness: AgentHarnessSchema,
  model: z.string().trim().max(100).nullable().optional(),
  credentialProfile: AgentCredentialProfileSchema,
  skills: z.array(z.string().regex(/^(?:global:)?[a-z0-9]+(?:-[a-z0-9]+)*$/, "Định dạng Danh sách skill không hợp lệ.")).default([]),
  write: z.boolean().default(false),
  canBeMain: z.boolean().default(false),
  enabled: z.boolean().default(true),
  maxDepth: z.number().int().min(1).max(10).default(3),
  budgetUsd: z.number().min(0.01).max(1000).nullable().optional(),
  timeoutS: z.number().int().min(10).max(7200).default(600),
  mcpAllow: z.array(z.string().trim().min(1)).default([])
});
export type UpsertAgentInput = z.infer<typeof UpsertAgentInputSchema>;

export const AgentConfigResponseSchema = z.object({
  agent: z.any() // AgentSummary
});
export type AgentConfigResponse = z.infer<typeof AgentConfigResponseSchema>;

export const DeleteAgentResponseSchema = z.object({
  ok: z.boolean(),
  deletedHandle: z.string()
});
export type DeleteAgentResponse = z.infer<typeof DeleteAgentResponseSchema>;

// API-7: Test Agent
export const TestAgentCheckSchema = z.object({
  status: z.enum(["pass", "fail"]),
  detail: z.string()
});

export const TestAgentSkillsCheckSchema = z.object({
  status: z.enum(["pass", "fail"]),
  expected: z.array(z.string()),
  loaded: z.array(z.string()),
  detail: z.string()
});

export const TestAgentMcpCheckSchema = z.object({
  status: z.enum(["pass", "fail"]),
  toolCalled: z.string(),
  detail: z.string()
});

export const TestAgentResultSchema = z.object({
  ok: z.boolean(),
  runId: z.string(),
  durationMs: z.number(),
  checks: z.object({
    harnessBoot: TestAgentCheckSchema,
    skillsLoaded: TestAgentSkillsCheckSchema,
    mcpConnected: TestAgentMcpCheckSchema
  })
});
export type TestAgentResult = z.infer<typeof TestAgentResultSchema>;

// Skills API Schemas
export const SkillItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  scope: z.enum(["project", "global"]),
  path: z.string(),
  hasShellScript: z.boolean(),
  contentHash: z.string()
});
export type SkillItem = z.infer<typeof SkillItemSchema>;

export const SkillListQuerySchema = z.object({
  scope: z.enum(["all", "project", "global"]).default("all")
});

export const SkillListResponseSchema = z.object({
  skills: z.array(SkillItemSchema)
});
export type SkillListResponse = z.infer<typeof SkillListResponseSchema>;

export const CreateSkillInputSchema = z.object({
  skillName: z
    .string()
    .trim()
    .min(1, "Tên skill là bắt buộc.")
    .max(64, "Tên skill không được vượt quá 64 ký tự.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: "Tên skill chỉ được gồm chữ thường, số và dấu gạch ngang (không chứa khoảng trắng, dấu ngoặc, dấu phẩy)."
    }),
  skillContent: z
    .string()
    .min(1, "Nội dung SKILL.md là bắt buộc.")
    .max(65536, "Nội dung SKILL.md không được vượt quá 65536 ký tự.")
});
export type CreateSkillInput = z.infer<typeof CreateSkillInputSchema>;

export const UpdateSkillInputSchema = z.object({
  skillContent: z
    .string()
    .min(1, "Nội dung SKILL.md là bắt buộc.")
    .max(65536, "Nội dung SKILL.md không được vượt quá 65536 ký tự.")
});
export type UpdateSkillInput = z.infer<typeof UpdateSkillInputSchema>;

export const SkillDetailResponseSchema = z.object({
  skill: SkillItemSchema.extend({
    content: z.string()
  })
});
export type SkillDetailResponse = z.infer<typeof SkillDetailResponseSchema>;

export const DeleteSkillResponseSchema = z.object({
  ok: z.boolean(),
  deletedSkillName: z.string()
});
export type DeleteSkillResponse = z.infer<typeof DeleteSkillResponseSchema>;

export const ImportSkillInputSchema = z.object({
  mode: z.enum(["folder", "zip", "git", "copy_global"]),
  sourcePath: z.string().trim().max(1024).nullable().optional(),
  zipBase64: z.string().max(10485760).nullable().optional(),
  gitUrl: z.string().trim().regex(/^(?:https?:\/\/|git@|file:\/\/).+$/, "Định dạng Địa chỉ Git không hợp lệ.").nullable().optional(),
  skillName: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Định dạng tên skill không hợp lệ.").nullable().optional(),
  overwrite: z.boolean().default(false)
});
export type ImportSkillInput = z.infer<typeof ImportSkillInputSchema>;

export const ImportSkillResponseSchema = z.object({
  ok: z.boolean(),
  importedSkill: SkillItemSchema
});
export type ImportSkillResponse = z.infer<typeof ImportSkillResponseSchema>;

// API-13: Harnesses
export const HarnessProfileSchema = z.object({
  name: z.string(),
  loggedIn: z.boolean()
});

export const HarnessItemSchema = z.object({
  id: z.enum(["claude-code", "codex"]),
  displayName: z.string(),
  detected: z.boolean(),
  version: z.string().nullable(),
  configDir: z.string(),
  profiles: z.array(HarnessProfileSchema)
});
export type HarnessItem = z.infer<typeof HarnessItemSchema>;

export const HarnessListResponseSchema = z.object({
  harnesses: z.array(HarnessItemSchema)
});
export type HarnessListResponse = z.infer<typeof HarnessListResponseSchema>;
