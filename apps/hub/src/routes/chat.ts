import type { FastifyInstance } from "fastify";
import {
  AgentListResponseSchema,
  ChannelIdParamSchema,
  ChannelListResponseSchema,
  ChannelResponseSchema,
  CreateThreadResponseSchema,
  DeleteChannelResponseSchema,
  MessageIdParamSchema,
  MessageListResponseSchema,
  PostMessageResponseSchema,
  ProjectIdParamSchema,
  ProjectListResponseSchema,
  ThreadIdParamSchema,
  ThreadListResponseSchema,
  ToggleReactionResponseSchema
} from "@ade/shared";
import { ChatService, HubDomainError } from "../chat/chat-service.js";

function toBodyRecord(body: unknown): Record<string, unknown> {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return {};
}

export async function registerChatRoutes(
  app: FastifyInstance,
  chatService: ChatService
): Promise<void> {
  app.get("/api/projects", async (_req, reply) => {
    const projects = chatService.listProjects();
    return reply.status(200).send(ProjectListResponseSchema.parse({ projects }));
  });

  app.get("/api/projects/:projectId/agents", async (req, reply) => {
    const parsed = ProjectIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new HubDomainError(404, "ERR_NOT_FOUND");
    }
    const result = chatService.listAgents(parsed.data.projectId);
    return reply.status(200).send(AgentListResponseSchema.parse(result));
  });

  app.get("/api/projects/:projectId/channels", async (req, reply) => {
    const parsed = ProjectIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new HubDomainError(404, "ERR_NOT_FOUND");
    }
    const channels = chatService.listChannels(parsed.data.projectId);
    return reply.status(200).send(ChannelListResponseSchema.parse({ channels }));
  });

  app.post("/api/projects/:projectId/channels", async (req, reply) => {
    const parsed = ProjectIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new HubDomainError(404, "ERR_NOT_FOUND");
    }
    const channel = chatService.createChannel(
      parsed.data.projectId,
      toBodyRecord(req.body)
    );
    return reply.status(201).send(ChannelResponseSchema.parse({ channel }));
  });

  app.patch("/api/channels/:channelId", async (req, reply) => {
    const parsed = ChannelIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new HubDomainError(404, "ERR_NOT_FOUND");
    }
    const channel = chatService.updateChannel(
      parsed.data.channelId,
      toBodyRecord(req.body)
    );
    return reply.status(200).send(ChannelResponseSchema.parse({ channel }));
  });

  app.delete("/api/channels/:channelId", async (req, reply) => {
    const parsed = ChannelIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new HubDomainError(404, "ERR_NOT_FOUND");
    }
    const deleted = chatService.deleteChannel(parsed.data.channelId);
    return reply.status(200).send(DeleteChannelResponseSchema.parse(deleted));
  });

  app.get("/api/channels/:channelId/threads", async (req, reply) => {
    const parsed = ChannelIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new HubDomainError(404, "ERR_NOT_FOUND");
    }
    const threads = chatService.listThreads(parsed.data.channelId);
    return reply.status(200).send(ThreadListResponseSchema.parse({ threads }));
  });

  app.post("/api/channels/:channelId/threads", async (req, reply) => {
    const parsed = ChannelIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new HubDomainError(404, "ERR_NOT_FOUND");
    }
    const created = chatService.createThread(
      parsed.data.channelId,
      toBodyRecord(req.body)
    );
    return reply.status(201).send(CreateThreadResponseSchema.parse(created));
  });

  app.get("/api/threads/:threadId/messages", async (req, reply) => {
    const parsed = ThreadIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new HubDomainError(404, "ERR_NOT_FOUND");
    }
    const messages = chatService.listMessages(parsed.data.threadId);
    return reply.status(200).send(MessageListResponseSchema.parse({ messages }));
  });

  app.post("/api/threads/:threadId/messages", async (req, reply) => {
    const parsed = ThreadIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new HubDomainError(404, "ERR_NOT_FOUND");
    }
    const posted = chatService.postMessage(
      parsed.data.threadId,
      toBodyRecord(req.body)
    );
    return reply.status(201).send(PostMessageResponseSchema.parse(posted));
  });

  app.post("/api/messages/:messageId/reactions", async (req, reply) => {
    const parsed = MessageIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new HubDomainError(404, "ERR_NOT_FOUND");
    }
    const toggled = chatService.toggleReaction(
      parsed.data.messageId,
      toBodyRecord(req.body)
    );
    return reply.status(200).send(ToggleReactionResponseSchema.parse(toggled));
  });
}
