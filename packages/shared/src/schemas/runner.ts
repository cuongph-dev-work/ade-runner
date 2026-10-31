import { z } from "zod";

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

export const NormalizedRunEventSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("plan"),
    entries: z.array(z.string())
  }),
  z.object({
    kind: z.literal("tool_call"),
    name: z.string(),
    path: z.string().optional(),
    args: z.record(z.string(), z.unknown()).optional()
  }),
  z.object({
    kind: z.literal("message_chunk"),
    text: z.string()
  }),
  z.object({
    kind: z.literal("mcp_call"),
    tool: z.string(),
    args: z.record(z.string(), z.unknown())
  })
]);
export type NormalizedRunEvent = z.infer<typeof NormalizedRunEventSchema>;
