import {
  ApiErrorResponseSchema,
  HealthResponseSchema,
  type HealthResponse
} from "@ade/shared";

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch("/api/health", {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    let code = "ERR_INTERNAL_ERROR";
    let message = `HTTP ${response.status}`;
    try {
      const json: unknown = await response.json();
      const parsedErr = ApiErrorResponseSchema.safeParse(json);
      if (parsedErr.success) {
        code = parsedErr.data.code;
        message = parsedErr.data.message;
      }
    } catch {
      // Giữ mã mặc định khi phản hồi lỗi không phải JSON
    }
    throw new ApiRequestError(response.status, code, message);
  }

  const payload: unknown = await response.json();
  return HealthResponseSchema.parse(payload);
}
