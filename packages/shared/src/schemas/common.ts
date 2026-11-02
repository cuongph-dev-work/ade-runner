import { z } from "zod";

export const AdeModeSchema = z.enum(["solo", "team", "vps"]);
export type AdeMode = z.infer<typeof AdeModeSchema>;

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  mode: z.literal("solo"),
  dbConnected: z.literal(true),
  eventCount: z.number().int().nonnegative(),
  version: z.string().min(1)
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const ApiErrorResponseSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).default({})
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
