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

export function isLocalRequestAllowed(request: FastifyRequest, mode: AdeMode): boolean {
  if (mode !== "solo") return true;

  const hostHeader = typeof request.headers.host === "string" ? request.headers.host : "";
  const hostName = extractHostHostname(hostHeader);
  if (!hostName || !LOCAL_HOSTS.has(hostName)) {
    return false;
  }

  const originHeader = request.headers.origin;
  if (originHeader !== undefined) {
    const originHost =
      typeof originHeader === "string" ? extractOriginHostname(originHeader) : null;
    if (!originHost || !LOCAL_HOSTS.has(originHost)) {
      return false;
    }
  }

  return true;
}

export function createLocalOriginPreHandler(mode: AdeMode) {
  return async function localOriginPreHandler(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    if (!request.url.startsWith("/api") && !request.url.startsWith("/ws")) {
      return;
    }

    if (!isLocalRequestAllowed(request, mode)) {
      await reply.status(ERROR_CODES.ERR_LOCAL_ORIGIN_ONLY.http).send({
        code: "ERR_LOCAL_ORIGIN_ONLY",
        message: ERROR_CODES.ERR_LOCAL_ORIGIN_ONLY.defaultMessage,
        details: {}
      });
    }
  };
}
