import type { FastifyInstance } from "fastify";
import {
  CancelRunParamsSchema,
  PermissionReplyBodySchema,
  PermissionReplyParamsSchema,
  ProjectRunsParamsSchema,
  ThreadRunsParamsSchema,
  type PermissionCardPayload,
} from "@ade/shared";
import type { AdeMode } from "@ade/runner";
import type { RunDispatcher } from "../runner/run-dispatcher.js";

function isAllowedLocalHost(rawValue: string | undefined): boolean {
  if (!rawValue) return true;
  try {
    const parsed = rawValue.includes("://") ? new URL(rawValue) : new URL(`http://${rawValue}`);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export async function registerRunRoutes(
  app: FastifyInstance,
  deps: { dispatcher: RunDispatcher; mode?: AdeMode },
): Promise<void> {
  const mode = deps.mode ?? "solo";

  app.addHook("onRequest", async (req, reply) => {
    if (mode === "solo") {
      const originHeader = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
      const hostHeader = typeof req.headers.host === "string" ? req.headers.host : undefined;
      if (!isAllowedLocalHost(originHeader) || !isAllowedLocalHost(hostHeader)) {
        return reply.status(403).send({
          code: "ERR_LOCAL_ORIGIN_ONLY",
          message: "ADE ở chế độ Solo chỉ cho phép truy cập từ localhost.",
          details: {},
        });
      }
    }
  });

  // API-1: GET /api/threads/:threadId/runs
  app.get("/api/threads/:threadId/runs", async (req, reply) => {
    const parsedParams = ThreadRunsParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return reply.status(422).send({
        code: "ERR_VALIDATION",
        message: "Dữ liệu gửi lên không hợp lệ.",
        details: { fieldErrors: parsedParams.error.flatten().fieldErrors },
      });
    }
    const runs = deps.dispatcher.listRunsByThread(parsedParams.data.threadId);
    return reply.status(200).send({ runs });
  });

  // API-2: POST /api/runs/:runId/permissions/:requestId/reply
  app.post("/api/runs/:runId/permissions/:requestId/reply", async (req, reply) => {
    const parsedParams = PermissionReplyParamsSchema.safeParse(req.params);
    const parsedBody = PermissionReplyBodySchema.safeParse(req.body ?? {});
    if (!parsedParams.success || !parsedBody.success) {
      const fieldErrors: Record<string, string[]> = {};
      if (!parsedParams.success) {
        for (const issue of parsedParams.error.issues) {
          const key = String(issue.path[0] ?? "params");
          fieldErrors[key] = fieldErrors[key] ?? [];
          fieldErrors[key].push(issue.message);
        }
      }
      if (!parsedBody.success) {
        for (const issue of parsedBody.error.issues) {
          const key = String(issue.path[0] ?? "form");
          fieldErrors[key] = fieldErrors[key] ?? [];
          fieldErrors[key].push(issue.message);
        }
      }
      return reply.status(422).send({
        code: "ERR_VALIDATION",
        message: "Dữ liệu gửi lên không hợp lệ.",
        details: { fieldErrors },
      });
    }

    const result = deps.dispatcher.resolvePermission({
      runId: parsedParams.data.runId,
      requestId: parsedParams.data.requestId,
      optionId: parsedBody.data.optionId,
      decision: parsedBody.data.decision,
      decidedBy: "usr_local",
    });

    return reply.status(200).send({
      runId: result.runId,
      requestId: result.requestId,
      optionId: result.optionId,
      decision: result.decision,
      runStatus: result.runStatus,
      cardStatus: result.cardStatus as Extract<PermissionCardPayload["status"], "allowed" | "denied">,
      messageCode: "MSG16",
    });
  });

  // API-3: POST /api/runs/:runId/cancel
  app.post("/api/runs/:runId/cancel", async (req, reply) => {
    const parsedParams = CancelRunParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return reply.status(422).send({
        code: "ERR_VALIDATION",
        message: "Dữ liệu gửi lên không hợp lệ.",
        details: { fieldErrors: parsedParams.error.flatten().fieldErrors },
      });
    }

    const cancelled = await deps.dispatcher.cancelRun({
      runId: parsedParams.data.runId,
      cancelledBy: "usr_local",
    });

    return reply.status(200).send(cancelled);
  });

  // API-4: GET /api/projects/:projectId/runs
  app.get("/api/projects/:projectId/runs", async (req, reply) => {
    const parsedParams = ProjectRunsParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return reply.status(422).send({
        code: "ERR_VALIDATION",
        message: "Dữ liệu gửi lên không hợp lệ.",
        details: { fieldErrors: parsedParams.error.flatten().fieldErrors },
      });
    }
    const runs = deps.dispatcher.listRunsByProject(parsedParams.data.projectId);
    return reply.status(200).send({ runs });
  });
}
