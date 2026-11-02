import { ApiErrorResponseSchema, type FieldErrorMap } from "@ade/shared";

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

export class ChatApiError extends ApiRequestError {
  constructor(
    status: number,
    code: string,
    message: string,
    public readonly fieldErrors: FieldErrorMap = {}
  ) {
    super(status, code, message);
    this.name = "ChatApiError";
  }
}

export type ParseFunction<T> = (raw: unknown) => T;

export async function requestJson<T>(
  url: string,
  init?: RequestInit,
  parserOrExpectedStatus?: ParseFunction<T> | number | number[]
): Promise<T> {
  const isPostOrPut = init?.body !== undefined;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(isPostOrPut ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {})
    }
  });

  const isParser = typeof parserOrExpectedStatus === "function";
  const expectedStatuses =
    typeof parserOrExpectedStatus === "number"
      ? [parserOrExpectedStatus]
      : Array.isArray(parserOrExpectedStatus)
        ? parserOrExpectedStatus
        : undefined;

  const isStatusValid = expectedStatuses
    ? expectedStatuses.includes(res.status)
    : res.ok;

  if (!isStatusValid) {
    let code = `ERR_HTTP_${res.status}`;
    let message = `HTTP ${res.status}`;
    let fieldErrors: FieldErrorMap = {};

    try {
      const json: unknown = await res.json();
      const parsed = ApiErrorResponseSchema.safeParse(json);
      if (parsed.success) {
        code = parsed.data.code;
        message = parsed.data.message;
        const rawFe = parsed.data.details.fieldErrors;
        if (rawFe && typeof rawFe === "object") {
          fieldErrors = rawFe as FieldErrorMap;
        }
      } else if (json && typeof json === "object") {
        const obj = json as Record<string, unknown>;
        if (typeof obj.code === "string") code = obj.code;
        if (typeof obj.message === "string") message = obj.message;
        const rawDetails = obj.details as Record<string, unknown> | undefined;
        if (rawDetails?.fieldErrors && typeof rawDetails.fieldErrors === "object") {
          fieldErrors = rawDetails.fieldErrors as FieldErrorMap;
        }
      }
    } catch {
      // Giữ mã mặc định khi phản hồi không parse được JSON
    }

    throw new ChatApiError(res.status, code, message, fieldErrors);
  }

  const data: unknown = await res.json();
  if (isParser) {
    return (parserOrExpectedStatus as ParseFunction<T>)(data);
  }
  return data as T;
}
