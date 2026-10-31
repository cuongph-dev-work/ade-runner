import { useEffect, useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  WsServerEventSchema,
  type AgentListResponse,
  type Channel,
  type Message,
  type ProjectSummary,
  type Thread
} from "@ade/shared";

const RECONNECT_DELAYS_MS = [1000, 2000, 5000];
const countedReplyIdsByClient = new WeakMap<QueryClient, Set<string>>();

function getCountedReplyIds(queryClient: QueryClient): Set<string> {
  let set = countedReplyIdsByClient.get(queryClient);
  if (!set) {
    set = new Set<string>();
    countedReplyIdsByClient.set(queryClient, set);
  }
  return set;
}

export function registerServerMessages(
  queryClient: QueryClient,
  messages: Message[]
): void {
  const seen = getCountedReplyIds(queryClient);
  for (const m of messages) {
    if (!m.isRoot && m.kind !== "system") {
      seen.add(m.id);
    }
  }
}

export function upsertThreadMessageCache(
  queryClient: QueryClient,
  params: {
    channelId: string;
    threadId: string;
    message: Message;
  }
): void {
  const { channelId, threadId, message } = params;

  queryClient.setQueryData<Message[]>(["messages", threadId], (prev) => {
    if (!prev) return [message];
    if (prev.some((m) => m.id === message.id)) {
      return prev.map((m) => (m.id === message.id ? message : m));
    }
    return [...prev, message];
  });

  if (!message.isRoot && message.kind !== "system") {
    const seen = getCountedReplyIds(queryClient);
    if (!seen.has(message.id)) {
      seen.add(message.id);
      queryClient.setQueryData<Thread[]>(["threads", channelId], (prev) =>
        prev
          ? prev.map((t) =>
              t.id === threadId
                ? {
                    ...t,
                    replyCount: t.replyCount + 1,
                    lastReplyAt: message.createdAt,
                    participantIds: t.participantIds.includes(message.authorId)
                      ? t.participantIds
                      : [...t.participantIds, message.authorId]
                  }
                : t
            )
          : prev
      );
    }
  }
}

export interface RealtimeState {
  connected: boolean;
  reconnecting: boolean;
}

export function useChatRealtime(enabled: boolean): RealtimeState {
  const queryClient = useQueryClient();
  const [state, setState] = useState<RealtimeState>({
    connected: false,
    reconnecting: false
  });

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let ws: WebSocket | null = null;
    let retryAttempt = 0;
    let retryTimer: number | null = null;
    let hadConnectedBefore = false;

    const connect = (): void => {
      if (disposed) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

      ws.onmessage = (ev) => {
        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        const parsed = WsServerEventSchema.safeParse(parsedJson);
        if (!parsed.success) return;
        const frame = parsed.data;

        switch (frame.type) {
          case "ws.connected": {
            const wasReconnect = hadConnectedBefore;
            hadConnectedBefore = true;
            retryAttempt = 0;
            setState({ connected: true, reconnecting: false });
            if (wasReconnect) {
              void queryClient.invalidateQueries();
            }
            break;
          }

          case "channel.created": {
            queryClient.setQueryData<Channel[]>(
              ["channels", frame.data.projectId],
              (prev) => {
                if (!prev) return [frame.data.channel];
                if (prev.some((c) => c.id === frame.data.channel.id)) {
                  return prev.map((c) =>
                    c.id === frame.data.channel.id ? frame.data.channel : c
                  );
                }
                return [...prev, frame.data.channel];
              }
            );
            break;
          }

          case "channel.updated": {
            queryClient.setQueryData<Channel[]>(
              ["channels", frame.data.projectId],
              (prev) =>
                prev
                  ? prev.map((c) =>
                      c.id === frame.data.channel.id ? frame.data.channel : c
                    )
                  : [frame.data.channel]
            );
            break;
          }

          case "channel.deleted": {
            queryClient.setQueryData<Channel[]>(
              ["channels", frame.data.projectId],
              (prev) =>
                prev ? prev.filter((c) => c.id !== frame.data.channelId) : []
            );
            break;
          }

          case "thread.created": {
            queryClient.setQueryData<Thread[]>(
              ["threads", frame.data.channelId],
              (prev) => {
                if (!prev) return [frame.data.thread];
                if (prev.some((t) => t.id === frame.data.thread.id)) {
                  return prev.map((t) =>
                    t.id === frame.data.thread.id ? frame.data.thread : t
                  );
                }
                return [...prev, frame.data.thread];
              }
            );
            break;
          }

          case "message.posted": {
            upsertThreadMessageCache(queryClient, {
              channelId: frame.data.channelId,
              threadId: frame.data.threadId,
              message: frame.data.message
            });
            break;
          }

          case "message.reaction_toggled": {
            queryClient.setQueryData<Message[]>(
              ["messages", frame.data.threadId],
              (prev) =>
                prev
                  ? prev.map((m) =>
                      m.id === frame.data.messageId
                        ? { ...m, reactions: frame.data.reactions }
                        : m
                    )
                  : prev
            );
            queryClient.setQueryData<Thread[]>(
              ["threads", frame.data.channelId],
              (prev) =>
                prev
                  ? prev.map((t) =>
                      t.rootMessage.id === frame.data.messageId
                        ? {
                            ...t,
                            rootMessage: {
                              ...t.rootMessage,
                              reactions: frame.data.reactions
                            }
                          }
                        : t
                    )
                  : prev
            );
            break;
          }

          case "project.config_updated": {
            queryClient.setQueryData<AgentListResponse>(
              ["agents", frame.data.projectId],
              {
                agents: frame.data.agents,
                configErrors: frame.data.configErrors
              }
            );
            queryClient.setQueryData<ProjectSummary[]>(["projects"], (prev) =>
              prev
                ? prev.map((p) =>
                    p.id === frame.data.projectId
                      ? { ...p, configErrors: frame.data.configErrors }
                      : p
                  )
                : prev
            );
            break;
          }

          default:
            break;
        }
      };

      ws.onclose = () => {
        if (disposed) return;
        setState({ connected: false, reconnecting: true });
        const delay =
          RECONNECT_DELAYS_MS[Math.min(retryAttempt, RECONNECT_DELAYS_MS.length - 1)]!;
        retryAttempt += 1;
        retryTimer = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
      ws?.close();
    };
  }, [enabled, queryClient]);

  return state;
}
