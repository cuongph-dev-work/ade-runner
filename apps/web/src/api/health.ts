import { HealthResponseSchema, type HealthResponse } from "@ade/shared";
import { ApiRequestError, requestJson } from "./client.js";

export { ApiRequestError };

export async function fetchHealth(): Promise<HealthResponse> {
  return requestJson("/api/health", { method: "GET" }, (d) =>
    HealthResponseSchema.parse(d)
  );
}
