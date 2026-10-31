import type { FastifyInstance } from "fastify";
import {
  PutMemoryFileInputSchema,
  DecideMemoryProposalInputSchema,
  MemoryProposalQuerySchema,
  PutWorkflowYamlInputSchema,
  MemoryFileParamSchema,
  MemoryProposalParamSchema,
  WorkflowParamSchema,
  ProjectIdParamSchema
} from "@ade/shared";
import type { MemoryService } from "../memory/memory-service.js";
import type { WorkflowService } from "../memory/workflow-service.js";
import { HubDomainError } from "../chat/chat-service.js";

export function registerMemoryRoutes(
  app: FastifyInstance,
  deps: {
    memoryService: MemoryService;
    workflowService: WorkflowService;
  }
): void {
  // 1. GET /api/projects/:projectId/memory
  app.get("/api/projects/:projectId/memory", async (req, reply) => {
    const parsed = ProjectIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new HubDomainError(422, "ERR_VALIDATION");
    }
    const result = deps.memoryService.listMemoryFiles(parsed.data.projectId);
    return reply.status(200).send(result);
  });

  // 2. GET /api/projects/:projectId/memory/:fileName
  app.get("/api/projects/:projectId/memory/:fileName", async (req, reply) => {
    const parsed = MemoryFileParamSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new HubDomainError(422, "ERR_VALIDATION");
    }
    const result = deps.memoryService.getMemoryFile(parsed.data.projectId, parsed.data.fileName);
    return reply.status(200).send(result);
  });

  // 3. PUT /api/projects/:projectId/memory/:fileName
  app.put("/api/projects/:projectId/memory/:fileName", async (req, reply) => {
    const paramsRes = MemoryFileParamSchema.safeParse(req.params);
    if (!paramsRes.success) {
      throw new HubDomainError(422, "ERR_VALIDATION");
    }
    const bodyRes = PutMemoryFileInputSchema.safeParse(req.body);
    if (!bodyRes.success) {
      throw new HubDomainError(422, "ERR_VALIDATION", {
        fieldErrors: { content: [{ code: "MSG01", message: "Nội dung là bắt buộc và tối đa 65536 ký tự." }] }
      });
    }

    const result = deps.memoryService.putMemoryFile(
      paramsRes.data.projectId,
      paramsRes.data.fileName,
      bodyRes.data.content
    );
    return reply.status(200).send(result);
  });

  // 4. GET /api/projects/:projectId/memory-proposals
  app.get("/api/projects/:projectId/memory-proposals", async (req, reply) => {
    const paramsRes = ProjectIdParamSchema.safeParse(req.params);
    if (!paramsRes.success) {
      throw new HubDomainError(422, "ERR_VALIDATION");
    }
    const queryRes = MemoryProposalQuerySchema.safeParse(req.query);
    if (!queryRes.success) {
      throw new HubDomainError(422, "ERR_VALIDATION", {
        fieldErrors: { status: [{ code: "MSG04", message: "Định dạng Trạng thái không hợp lệ." }] }
      });
    }

    const result = deps.memoryService.listMemoryProposals(
      paramsRes.data.projectId,
      queryRes.data.status
    );
    return reply.status(200).send(result);
  });

  // 5. POST /api/memory-proposals/:proposalId/decide
  app.post("/api/memory-proposals/:proposalId/decide", async (req, reply) => {
    const paramsRes = MemoryProposalParamSchema.safeParse(req.params);
    if (!paramsRes.success) {
      throw new HubDomainError(422, "ERR_VALIDATION");
    }
    const bodyRes = DecideMemoryProposalInputSchema.safeParse(req.body);
    if (!bodyRes.success) {
      throw new HubDomainError(422, "ERR_VALIDATION", {
        fieldErrors: { decision: [{ code: "MSG04", message: "Định dạng Quyết định không hợp lệ." }] }
      });
    }

    const result = deps.memoryService.decideMemoryProposal(
      paramsRes.data.proposalId,
      bodyRes.data.decision
    );
    return reply.status(200).send(result);
  });

  // 6. GET /api/projects/:projectId/workflows/:workflowId
  app.get("/api/projects/:projectId/workflows/:workflowId", async (req, reply) => {
    const paramsRes = WorkflowParamSchema.safeParse(req.params);
    if (!paramsRes.success) {
      throw new HubDomainError(422, "ERR_VALIDATION");
    }
    const result = deps.workflowService.getWorkflowDetail(
      paramsRes.data.projectId,
      paramsRes.data.workflowId
    );
    return reply.status(200).send(result);
  });

  // 7. PUT /api/projects/:projectId/workflows/:workflowId
  app.put("/api/projects/:projectId/workflows/:workflowId", async (req, reply) => {
    const paramsRes = WorkflowParamSchema.safeParse(req.params);
    if (!paramsRes.success) {
      throw new HubDomainError(422, "ERR_VALIDATION");
    }
    const bodyRes = PutWorkflowYamlInputSchema.safeParse(req.body);
    if (!bodyRes.success) {
      throw new HubDomainError(422, "ERR_VALIDATION", {
        fieldErrors: { workflowYaml: [{ code: "MSG01", message: "Nội dung Workflow YAML là bắt buộc." }] }
      });
    }

    const result = deps.workflowService.putWorkflowYaml(
      paramsRes.data.projectId,
      paramsRes.data.workflowId,
      bodyRes.data.workflowYaml
    );
    return reply.status(200).send(result);
  });
}
