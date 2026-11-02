import type { z } from "zod";
import { HubDomainError } from "../errors.js";

export function parseParamsOrNotFound<T>(schema: z.ZodType<T>, params: unknown): T {
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    throw new HubDomainError(404, "ERR_NOT_FOUND");
  }
  return parsed.data;
}

export function parseBodyOrValidation<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new HubDomainError(422, "ERR_VALIDATION");
  }
  return parsed.data;
}

export function parseQueryOrValidation<T>(schema: z.ZodType<T>, query: unknown): T {
  const parsed = schema.safeParse(query);
  if (!parsed.success) {
    throw new HubDomainError(422, "ERR_VALIDATION");
  }
  return parsed.data;
}
