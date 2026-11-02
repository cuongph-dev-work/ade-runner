import { ERROR_CODES, type ErrorCode } from "@ade/shared";

export class HubDomainError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: Record<string, unknown>;

  constructor(
    statusOrCode: number | string,
    codeOrMessage: ErrorCode | string,
    detailsOrStatus?: Record<string, unknown> | number,
    fieldErrors?: Record<string, string[]>
  ) {
    if (typeof statusOrCode === "number") {
      const statusCode = statusOrCode;
      const code = codeOrMessage;
      const details =
        typeof detailsOrStatus === "object" && detailsOrStatus !== null
          ? (detailsOrStatus as Record<string, unknown>)
          : {};
      const defaultMsg = ERROR_CODES[code as ErrorCode]?.defaultMessage ?? code;
      super(defaultMsg);
      this.statusCode = statusCode;
      this.code = code;
      this.details = details;
    } else {
      const code = statusOrCode;
      const message = codeOrMessage;
      const statusCode =
        typeof detailsOrStatus === "number" ? detailsOrStatus : 400;
      super(message);
      this.statusCode = statusCode;
      this.code = code;
      this.details = fieldErrors ? { fieldErrors } : {};
    }
    this.name = "HubDomainError";
  }

  get httpStatus(): number {
    return this.statusCode;
  }

  get fieldErrors(): Record<string, string[]> | undefined {
    return this.details.fieldErrors as Record<string, string[]> | undefined;
  }
}
