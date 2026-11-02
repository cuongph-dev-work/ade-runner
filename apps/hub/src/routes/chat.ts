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
import type { ChatService } from "../chat/chat-service.js";
import { parseParamsOrNotFound } from "./route-utils.js";

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
    const { projectId } = parseParamsOrNotFound(ProjectIdParamSchema, req.params);
    const result = chatService.listAgents(projectId);
    return reply.status(200).send(AgentListResponseSchema.parse(result));
  });

  app.get("/api/projects/:projectId/channels", async (req, reply) => {
    const { projectId } = parseParamsOrNotFound(ProjectIdParamSchema, req.params);
    const channels = chatService.listChannels(projectId);
    return reply.status(200).send(ChannelListResponseSchema.parse({ channels }));
  });

  app.post("/api/projects/:projectId/channels", async (req, reply) => {
    const { projectId } = parseParamsOrNotFound(ProjectIdParamSchema, req.params);
    const channel = chatService.createChannel(
      projectId,
      toBodyRecord(req.body)
    );
    return reply.status(201).send(ChannelResponseSchema.parse({ channel }));
  });

  app.patch("/api/channels/:channelId", async (req, reply) => {
    const { channelId } = parseParamsOrNotFound(ChannelIdParamSchema, req.params);
    const channel = chatService.updateChannel(
      channelId,
      toBodyRecord(req.body)
    );
    return reply.status(200).send(ChannelResponseSchema.parse({ channel }));
  });

  app.delete("/api/channels/:channelId", async (req, reply) => {
    const { channelId } = parseParamsOrNotFound(ChannelIdParamSchema, req.params);
    const deleted = chatService.deleteChannel(channelId);
    return reply.status(200).send(DeleteChannelResponseSchema.parse(deleted));
  });

  app.get("/api/channels/:channelId/threads", async (req, reply) => {
    const { channelId } = parseParamsOrNotFound(ChannelIdParamSchema, req.params);
    const threads = chatService.listThreads(channelId);
    return reply.status(200).send(ThreadListResponseSchema.parse({ threads }));
  });

  app.post("/api/channels/:channelId/threads", async (req, reply) => {
    const { channelId } = parseParamsOrNotFound(ChannelIdParamSchema, req.params);
    const created = chatService.createThread(
      channelId,
      toBodyRecord(req.body)
    );
    return reply.status(201).send(CreateThreadResponseSchema.parse(created));
  });

  app.get("/api/threads/:threadId/messages", async (req, reply) => {
    const { threadId } = parseParamsOrNotFound(ThreadIdParamSchema, req.params);
    const messages = chatService.listMessages(threadId);
    return reply.status(200).send(MessageListResponseSchema.parse({ messages }));
  });

  app.post("/api/threads/:threadId/messages", async (req, reply) => {
    const { threadId } = parseParamsOrNotFound(ThreadIdParamSchema, req.params);
    const posted = chatService.postMessage(
      threadId,
      toBodyRecord(req.body)
    );
    return reply.status(201).send(PostMessageResponseSchema.parse(posted));
  });

  app.post("/api/messages/:messageId/reactions", async (req, reply) => {
    const { messageId } = parseParamsOrNotFound(MessageIdParamSchema, req.params);
    const toggled = chatService.toggleReaction(
      messageId,
      toBodyRecord(req.body)
    );
    return reply.status(200).send(ToggleReactionResponseSchema.parse(toggled));
  });
}
