import type { FastifyReply, FastifyRequest } from "fastify";
import { ERROR_CODES, type AdeMode } from "@ade/shared";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

function extractOriginHostname(originHeader: string): string | null {
  try {
    return new URL(originHeader).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function extractHostHostname(hostHeader: string): string | null {
  const trimmed = hostHeader.trim().toLowerCase();
  if (!trimmed) return null;
  const withoutPort = trimmed.split(":")[0];
  return withoutPort || null;
}

export function createLocalOriginPreHandler(mode: AdeMode) {
  return async function localOriginPreHandler(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    if (mode !== "solo") return;
    if (!request.url.startsWith("/api")) return;

    // S-01: Luôn kiểm tra Host thuộc {"localhost", "127.0.0.1"} (chặn DNS rebinding)
    const hostHeader = typeof request.headers.host === "string" ? request.headers.host : "";
    const hostName = extractHostHostname(hostHeader);
    if (!hostName || !LOCAL_HOSTS.has(hostName)) {
      await reply.status(ERROR_CODES.ERR_LOCAL_ORIGIN_ONLY.http).send({
        code: "ERR_LOCAL_ORIGIN_ONLY",
        message: ERROR_CODES.ERR_LOCAL_ORIGIN_ONLY.defaultMessage,
        details: {}
      });
      return;
    }

    // S-02: Khi có mặt Origin, bắt buộc là URL hợp lệ có hostname thuộc {"localhost", "127.0.0.1"} (chặn cả "null")
    const originHeader = request.headers.origin;
    if (originHeader !== undefined) {
      const originHost =
        typeof originHeader === "string" ? extractOriginHostname(originHeader) : null;
      if (!originHost || !LOCAL_HOSTS.has(originHost)) {
        await reply.status(ERROR_CODES.ERR_LOCAL_ORIGIN_ONLY.http).send({
          code: "ERR_LOCAL_ORIGIN_ONLY",
          message: ERROR_CODES.ERR_LOCAL_ORIGIN_ONLY.defaultMessage,
          details: {}
        });
      }
    }
  };
}
