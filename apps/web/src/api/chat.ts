import {
  AgentListResponseSchema,
  ApiErrorResponseSchema,
  CancelRunResponseSchema,
  ChannelListResponseSchema,
  ChannelResponseSchema,
  CreateThreadResponseSchema,
  DeleteChannelResponseSchema,
  MessageListResponseSchema,
  PermissionReplyResponseSchema,
  PostMessageResponseSchema,
  ProjectListResponseSchema,
  ThreadListResponseSchema,
  ThreadRunsResponseSchema,
  ToggleReactionResponseSchema,
  ReplyQuestionResponseSchema,
  type AgentListResponse,
  type CancelRunResponse,
  type Channel,
  type CreateThreadResponse,
  type DeleteChannelResponse,
  type FieldErrorMap,
  type Message,
  type PermissionReplyResponse,
  type PostMessageResponse,
  type ProjectSummary,
  type ReactionEmoji,
  type RunSummary,
  type Thread,
  type ToggleReactionResponse,
  type ReplyQuestionResponse,
  type QuestionAnswerItem
} from "@ade/shared";
import { ApiRequestError } from "./health.js";

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

async function requestJson<T>(
  url: string,
  init: RequestInit,
  parseFn: (raw: unknown) => T
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {})
    }
  });

  if (!res.ok) {
    let code = "ERR_INTERNAL_ERROR";
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
      }
    } catch {
      // Giữ lỗi mặc định
    }
    throw new ChatApiError(res.status, code, message, fieldErrors);
  }

  const data: unknown = await res.json();
  return parseFn(data);
}

export async function fetchProjects(): Promise<ProjectSummary[]> {
  const res = await requestJson("/api/projects", { method: "GET" }, (d) =>
    ProjectListResponseSchema.parse(d)
  );
  return res.projects;
}

export async function fetchProjectAgents(projectId: string): Promise<AgentListResponse> {
  return requestJson(`/api/projects/${projectId}/agents`, { method: "GET" }, (d) =>
    AgentListResponseSchema.parse(d)
  );
}

export async function fetchProjectChannels(projectId: string): Promise<Channel[]> {
  const res = await requestJson(
    `/api/projects/${projectId}/channels`,
    { method: "GET" },
    (d) => ChannelListResponseSchema.parse(d)
  );
  return res.channels;
}

export async function createProjectChannel(
  projectId: string,
  input: { name: string; description: string }
): Promise<Channel> {
  const res = await requestJson(
    `/api/projects/${projectId}/channels`,
    { method: "POST", body: JSON.stringify(input) },
    (d) => ChannelResponseSchema.parse(d)
  );
  return res.channel;
}

export async function updateChannelApi(
  channelId: string,
  input: {
    name: string;
    description: string;
    memberUserIds?: string[];
    memberAgentIds?: string[];
  }
): Promise<Channel> {
  const res = await requestJson(
    `/api/channels/${channelId}`,
    { method: "PATCH", body: JSON.stringify(input) },
    (d) => ChannelResponseSchema.parse(d)
  );
  return res.channel;
}

export async function deleteChannelApi(channelId: string): Promise<DeleteChannelResponse> {
  return requestJson(`/api/channels/${channelId}`, { method: "DELETE" }, (d) =>
    DeleteChannelResponseSchema.parse(d)
  );
}

export async function fetchChannelThreads(channelId: string): Promise<Thread[]> {
  const res = await requestJson(
    `/api/channels/${channelId}/threads`,
    { method: "GET" },
    (d) => ThreadListResponseSchema.parse(d)
  );
  return res.threads;
}

export async function createChannelThread(
  channelId: string,
  input: { body: string; title?: string }
): Promise<CreateThreadResponse> {
  return requestJson(
    `/api/channels/${channelId}/threads`,
    { method: "POST", body: JSON.stringify(input) },
    (d) => CreateThreadResponseSchema.parse(d)
  );
}

export async function fetchThreadMessages(threadId: string): Promise<Message[]> {
  const res = await requestJson(
    `/api/threads/${threadId}/messages`,
    { method: "GET" },
    (d) => MessageListResponseSchema.parse(d)
  );
  return res.messages;
}

export async function postThreadReply(
  threadId: string,
  input: { body: string }
): Promise<PostMessageResponse> {
  return requestJson(
    `/api/threads/${threadId}/messages`,
    { method: "POST", body: JSON.stringify(input) },
    (d) => PostMessageResponseSchema.parse(d)
  );
}

export async function toggleMessageReaction(
  messageId: string,
  emoji: ReactionEmoji
): Promise<ToggleReactionResponse> {
  return requestJson(
    `/api/messages/${messageId}/reactions`,
    { method: "POST", body: JSON.stringify({ emoji }) },
    (d) => ToggleReactionResponseSchema.parse(d)
  );
}

export async function fetchThreadRuns(threadId: string): Promise<RunSummary[]> {
  const res = await requestJson(
    `/api/threads/${threadId}/runs`,
    { method: "GET" },
    (d) => ThreadRunsResponseSchema.parse(d)
  );
  return res.runs;
}

export async function fetchProjectRuns(projectId: string): Promise<RunSummary[]> {
  const res = await requestJson(
    `/api/projects/${projectId}/runs`,
    { method: "GET" },
    (d) => ThreadRunsResponseSchema.parse(d)
  );
  return res.runs;
}

export async function replyPermissionApi(params: {
  runId: string;
  requestId: string;
  optionId: string;
  decision: "allow" | "deny";
}): Promise<PermissionReplyResponse> {
  return requestJson(
    `/api/runs/${params.runId}/permissions/${params.requestId}/reply`,
    {
      method: "POST",
      body: JSON.stringify({
        optionId: params.optionId,
        decision: params.decision
      })
    },
    (d) => PermissionReplyResponseSchema.parse(d)
  );
}

export async function cancelRunApi(runId: string): Promise<CancelRunResponse> {
  return requestJson(
    `/api/runs/${runId}/cancel`,
    { method: "POST" },
    (d) => CancelRunResponseSchema.parse(d)
  );
}

export async function replyQuestionApi(params: {
  threadId: string;
  questionId: string;
  answer?: string;
  optionId?: string | null;
  answers?: QuestionAnswerItem[];
}): Promise<ReplyQuestionResponse> {
  return requestJson(
    `/api/threads/${params.threadId}/questions/${params.questionId}/reply`,
    {
      method: "POST",
      body: JSON.stringify({
        answer: params.answer,
        optionId: params.optionId,
        answers: params.answers,
      }),
    },
    (d) => ReplyQuestionResponseSchema.parse(d)
  );
}

export async function resolveApprovalApi(params: {
  threadId: string;
  approvalId: string;
  decision: "approve" | "changes_requested";
  feedback?: string;
}): Promise<{ ok: boolean; approval: unknown }> {
  return requestJson(
    `/api/threads/${params.threadId}/approvals/${params.approvalId}/decision`,
    {
      method: "POST",
      body: JSON.stringify({
        decision: params.decision,
        feedback: params.feedback,
      }),
    },
    (d) => d as { ok: boolean; approval: unknown }
  );
}

export async function fetchScratchpadsApi(threadId: string): Promise<Array<{
  threadId: string;
  agentId: string;
  agentHandle: string;
  agentDisplayName: string;
  agentAvatar?: string | null;
  content: string;
  updatedAt: string;
}>> {
  const res = await requestJson<{ scratchpads: Array<any> }>(
    `/api/threads/${threadId}/scratchpads`,
    { method: "GET" },
    (d) => d as { scratchpads: Array<any> }
  );
  return res.scratchpads ?? [];
}
