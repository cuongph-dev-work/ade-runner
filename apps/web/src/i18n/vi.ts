import { ERROR_CODES, type ErrorCode } from "@ade/shared";

export function translateApiError(code?: string): string {
  if (code && code in ERROR_CODES) {
    return ERROR_CODES[code as ErrorCode].defaultMessage;
  }
  return "Không thể kết nối tới ADE Hub.";
}
