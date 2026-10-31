import { z } from "zod";

export const ProjectYamlSchema = z
  .object({
    name: z.string().trim().min(1),
    default_branch: z.string().trim().min(1).default("main"),
    default_main_agent: z.string().trim().min(1).nullable().default(null),
    workflow: z.string().trim().min(1).optional(),
    workflow_id: z.string().trim().min(1).optional(),
    memory_path: z.string().trim().min(1).default(".ade/memory/"),
    use_repo_instructions: z.boolean().default(false)
  })
  .transform((val) => {
    const normalizedMain =
      val.default_main_agent === null
        ? null
        : val.default_main_agent.startsWith("@")
          ? val.default_main_agent.toLowerCase()
          : `@${val.default_main_agent.toLowerCase()}`;
    return {
      name: val.name,
      default_branch: val.default_branch,
      default_main_agent: normalizedMain,
      workflow: val.workflow_id ?? val.workflow ?? "feature",
      memory_path: val.memory_path,
      use_repo_instructions: val.use_repo_instructions
    };
  });
export type ProjectYaml = z.infer<typeof ProjectYamlSchema>;

export const AgentHarnessSchema = z
  .enum(["claude", "claude-code", "codex"])
  .transform((v): "claude-code" | "codex" => (v === "claude" ? "claude-code" : v));
export type AgentHarness = z.infer<typeof AgentHarnessSchema>;

export const AgentCredentialProfileSchema = z.enum([
  "sub-claude",
  "sub-chatgpt",
  "api-key"
]);
export type AgentCredentialProfile = z.infer<typeof AgentCredentialProfileSchema>;

export const AgentSkillRefSchema = z
  .string()
  .trim()
  .regex(/^(?:global:)?[a-z0-9][a-z0-9-]*$/);

export const AgentYamlSchema = z
  .object({
    handle: z
      .string()
      .trim()
      .transform((v) => (v.startsWith("@") ? v.slice(1).toLowerCase() : v.toLowerCase()))
      .pipe(z.string().regex(/^[a-z0-9][a-z0-9-_]*$/)),
    display_name: z.string().trim().min(1).optional(),
    avatar: z.string().trim().nullable().default(null),
    role: z.string().trim().default(""),
    harness: AgentHarnessSchema,
    model: z.string().trim().min(1).optional(),
    credential_profile: AgentCredentialProfileSchema.optional(),
    credential: AgentCredentialProfileSchema.optional(),
    skills: z.array(AgentSkillRefSchema).default([]),
    mcp_allow: z.array(z.string().trim().min(1)).default([]),
    write: z.boolean().default(false),
    can_be_main: z.boolean().default(false),
    enabled: z.boolean().default(true),
    max_depth: z.number().int().min(1).max(10).default(3),
    budget_usd: z.number().positive().nullable().default(null),
    timeout_s: z.number().int().min(5).max(7200).default(600),
    instructions: z.string().default("")
  })
  .transform((val) => {
    const defaultDisplayName =
      val.handle.charAt(0).toUpperCase() + val.handle.slice(1);
    const defaultModel = val.harness === "codex" ? "gpt-5-codex" : "sonnet";
    const defaultCred: AgentCredentialProfile =
      val.harness === "codex" ? "sub-chatgpt" : "sub-claude";
    return {
      handle: val.handle,
      display_name: val.display_name ?? defaultDisplayName,
      avatar: val.avatar,
      role: val.role,
      harness: val.harness,
      model: val.model ?? defaultModel,
      credential_profile: val.credential_profile ?? val.credential ?? defaultCred,
      skills: val.skills,
      mcp_allow: val.mcp_allow,
      write: val.write,
      can_be_main: val.can_be_main,
      enabled: val.enabled,
      max_depth: val.max_depth,
      budget_usd: val.budget_usd,
      timeout_s: val.timeout_s,
      instructions: val.instructions
    };
  });
export type AgentYaml = z.infer<typeof AgentYamlSchema>;

export const GateKindSchema = z.enum(["plan", "spec", "review"]);
export type GateKind = z.infer<typeof GateKindSchema>;

export const WorkflowStateMetaSchema = z
  .object({
    gate: GateKindSchema.optional()
  })
  .passthrough();
export const WorkflowStateConfigSchema = WorkflowStateMetaSchema;

export const WorkflowStateItemSchema = z.union([
  z.string().trim().min(1),
  z.record(z.string().trim().min(1), WorkflowStateMetaSchema)
]);

export const WorkflowStatesSchema = z.union([
  z.array(WorkflowStateItemSchema).min(1),
  z
    .record(z.string().trim().min(1), WorkflowStateMetaSchema)
    .refine((obj) => Object.keys(obj).length >= 1, {
      message: "states phải khai báo ít nhất 1 trạng thái."
    })
]);

export const WorkflowConditionPrimitiveSchema = z.union([
  z.string(),
  z.number(),
  z.boolean()
]);

export const WorkflowConditionValueSchema = z.union([
  WorkflowConditionPrimitiveSchema,
  z.array(WorkflowConditionPrimitiveSchema).min(1),
  z.object({ matches: z.string().min(1) })
]);
export type WorkflowConditionValue = z.infer<typeof WorkflowConditionValueSchema>;

export const WorkflowActionSchema = z.union([
  z.object({
    dispatch: z.object({
      agent: z.string().min(1),
      skill: z.string().min(1).optional(),
      prompt: z.string().optional()
    })
  }),
  z.object({
    set_state: z.union([
      z.string().min(1),
      z.object({
        to: z.string().min(1),
        reason: z.string().optional()
      })
    ])
  }),
  z.object({
    post_message: z.object({
      text: z.string().min(1),
      kind: z.enum(["text", "system"]).optional()
    })
  }),
  z.object({
    ask_human: z.object({
      text: z.string().min(1),
      options: z.array(z.string().min(1)).optional()
    })
  }),
  z.object({
    deny_tool: z.object({
      reason: z.string().min(1)
    })
  }),
  z.object({
    run_script: z.object({
      command: z.string().min(1),
      timeout_s: z.number().int().min(1).max(120).optional()
    })
  })
]);
export type WorkflowAction = z.infer<typeof WorkflowActionSchema>;

export const WorkflowRuleSchema = z.object({
  on: z.string().min(1),
  when: z.record(z.string(), WorkflowConditionValueSchema).optional(),
  do: z.array(WorkflowActionSchema).min(1)
});
export type WorkflowRule = z.infer<typeof WorkflowRuleSchema>;

export const WorkflowYamlSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    workflow: z.string().trim().min(1).optional(),
    initial: z.string().trim().min(1),
    main_agent: z.string().min(1).optional(),
    max_parallel_workers: z.number().int().min(1).max(10).default(3),
    states: WorkflowStatesSchema,
    agents: z
      .record(
        z.string(),
        z.object({
          harness: z.string().optional(),
          skills: z.array(z.string()).optional(),
          write: z.boolean().optional()
        })
      )
      .optional(),
    rules: z.array(z.union([WorkflowRuleSchema, z.record(z.string(), z.unknown())])).default([])
  })
  .transform((val) => ({
    id: val.id ?? val.workflow,
    workflow: val.workflow ?? val.id,
    initial: val.initial,
    main_agent: val.main_agent,
    max_parallel_workers: val.max_parallel_workers,
    states: val.states,
    agents: val.agents,
    rules: val.rules
  }));
export type WorkflowYaml = z.infer<typeof WorkflowYamlSchema>;

export function normalizeWorkflowStates(
  states: WorkflowYaml["states"]
): Record<string, { gate?: GateKind }> {
  if (Array.isArray(states)) {
    const res: Record<string, { gate?: GateKind }> = {};
    for (const item of states) {
      if (typeof item === "string") {
        res[item] = {};
      } else {
        for (const [k, v] of Object.entries(item)) {
          res[k] = v;
        }
      }
    }
    return res;
  }
  return states as Record<string, { gate?: GateKind }>;
}

export function extractWorkflowStateNames(workflow: WorkflowYaml): string[] {
  const names: string[] = [];
  if (Array.isArray(workflow.states)) {
    for (const entry of workflow.states) {
      if (typeof entry === "string") {
        names.push(entry);
      } else {
        for (const stateKey of Object.keys(entry)) {
          names.push(stateKey);
        }
      }
    }
  } else {
    for (const stateKey of Object.keys(workflow.states)) {
      names.push(stateKey);
    }
  }
  return names;
}

export const SkillFrontmatterSchema = z.object({
  name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(1)
});
export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;

export const SkillSnapshotItemSchema = z.object({
  name: z.string().min(1),
  scope: z.enum(["project", "global"]),
  content_hash: z.string().min(1)
});
export type SkillSnapshotItem = z.infer<typeof SkillSnapshotItemSchema>;
