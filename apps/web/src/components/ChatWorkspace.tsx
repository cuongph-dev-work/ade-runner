import { useEffect, useRef, useState, type JSX } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ALLOWED_REACTION_EMOJIS,
  resolveMsg,
  type LiveCardPayload,
  type Message,
  type PermissionCardPayload,
  type ProjectSummary,
  type ReactionEmoji,
  type QuestionCardPayload,
  type ExplorerCardPayload,
  type ApprovalGateCardPayload,
  type MemoryCardPayload,
  type Thread
} from "@ade/shared";
import {
  ChatApiError,
  cancelRunApi,
  createChannelThread,
  createProjectChannel,
  deleteChannelApi,
  fetchChannelThreads,
  fetchProjectAgents,
  fetchProjectChannels,
  fetchProjectRuns,
  fetchThreadMessages,
  fetchThreadRuns,
  postThreadReply,
  replyPermissionApi,
  replyQuestionApi,
  resolveApprovalApi,
  toggleMessageReaction,
  updateChannelApi
} from "../api/chat.js";
import { translateApiError } from "../i18n/vi.js";
import {
  registerServerMessages,
  upsertThreadMessageCache,
  useChatRealtime
} from "../hooks/useChatRealtime.js";
import {
  IconButton,
  Icon,
  Chip,
  Avatar
} from "./ui/index.js";
import { SmilePlusIcon } from "./icons.js";
import { ChannelSettingsModal, CreateChannelModal } from "./ChannelModals.js";
import { MentionComposer } from "./MentionComposer.js";
import { MessageBody } from "./MessageBody.js";
import { LiveCard } from "./cards/LiveCard.js";
import { PermissionCard } from "./cards/PermissionCard.js";
import { QuestionCard } from "./cards/QuestionCard.js";
import { ExplorerCard } from "./cards/ExplorerCard.js";
import { ApprovalGateCard } from "./cards/ApprovalGateCard.js";
import { MemoryProposalCard } from "./cards/MemoryProposalCard.js";
import { decideMemoryProposalApi } from "../api/memory.js";
import { ProjectWizardModal } from "./modals/ProjectWizardModal.js";
import { ProjectSettingsModal } from "./modals/ProjectSettingsModal.js";
import { ProjectRail } from "./workspace/ProjectRail.js";
import { ChannelSidebar } from "./workspace/ChannelSidebar.js";
import { NotificationPopover, type AppNotification } from "./workspace/NotificationPopover.js";
import {
  computeThreadRunSummary
} from "./cards/run-presence.js";
import type { ThemeMode } from "./SmokeShell.js";

const QUICK_EMOJIS: ReactionEmoji[] = ["👍", "❤️", "🔥", "🚀"];

interface ParsedChatRoute {
  projectId: string | null;
  channelId: string | null;
  threadId: string | null;
}

function parsePathname(pathname: string): ParsedChatRoute {
  const full = /^\/projects\/([^/]+)\/channels\/([^/]+)(?:\/threads\/([^/]+))?\/?$/.exec(
    pathname
  );
  if (!full) {
    return { projectId: null, channelId: null, threadId: null };
  }
  return {
    projectId: decodeURIComponent(full[1] ?? ""),
    channelId: decodeURIComponent(full[2] ?? ""),
    threadId: full[3] ? decodeURIComponent(full[3]) : null
  };
}

function readStoredThreadWidth(): number {
  const raw = Number(window.localStorage.getItem("ade-thread-panel-w"));
  if (Number.isFinite(raw) && raw >= 340 && raw <= 780) {
    return raw;
  }
  return 448;
}

function formatShortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function projectInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]![0] ?? ""}${words[1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

interface ChatWorkspaceProps {
  projects: ProjectSummary[];
  themeMode: ThemeMode;
  onCycleTheme: () => void;
}

export function ChatWorkspace({
  projects,
  themeMode,
  onCycleTheme
}: ChatWorkspaceProps): JSX.Element {
  const queryClient = useQueryClient();
  const realtime = useChatRealtime(true);

  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [threadWidth, setThreadWidth] = useState<number>(readStoredThreadWidth);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [settingsModalTab, setSettingsModalTab] = useState<"general" | "members" | null>(
    null
  );
  const [openPickerMsgId, setOpenPickerMsgId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: number; text: string }>>([]);
  const [isWizardOpen, setIsWizardOpen] = useState(
    () => window.location.pathname === "/projects/new"
  );
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(
    () => window.location.pathname.includes("/settings")
  );
  const [threadDrawerTab, setThreadDrawerTab] = useState<"replies" | "scratchpad">("replies");
  const [selectedScratchpadAgent, setSelectedScratchpadAgent] = useState<string>("@lead");
  const [grantsPopoverOpen, setGrantsPopoverOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([
    {
      id: "notif_appr_01",
      type: "approval",
      title: "Yêu cầu duyệt Cổng Kế hoạch (Plan Gate v2)",
      body: "@lead: Đang soạn thảo plan v2 và chờ duyệt cổng",
      source: "Kế hoạch · thr_01",
      channelId: "chn_auth_feat",
      threadId: "thr_01",
      approvalId: "gate_plan_01",
      time: "vừa xong",
      read: false
    },
    {
      id: "notif_mention_01",
      type: "mention",
      title: "Minh Tran đã nhắc bạn trong #auth-feature",
      body: '"@cuong xem giúp mình phần cấu hình phân quyền nhé"',
      source: "#auth-feature",
      channelId: "chn_auth_feat",
      time: "5m",
      read: false
    }
  ]);
  const threadListRef = useRef<HTMLDivElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);

  const pushToast = (text: string): void => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const handleSelectNotification = (item: AppNotification): void => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );
    if (item.channelId && item.threadId) {
      navigate(`/projects/${activeProject.id}/channels/${item.channelId}/threads/${item.threadId}`);
    } else if (item.channelId) {
      navigate(`/projects/${activeProject.id}/channels/${item.channelId}`);
    }
    setNotificationsOpen(false);
  };

  const handleMarkAllNotificationsRead = (): void => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadNotifCount = notifications.filter((n) => !n.read).length;
  const channelMentions = notifications
    .filter((n) => !n.read && n.type === "mention" && n.channelId)
    .reduce<Record<string, number>>((acc, n) => {
      acc[n.channelId!] = (acc[n.channelId!] || 0) + 1;
      return acc;
    }, {});
  const channelHasPendingGate = notifications
    .filter((n) => !n.read && n.type === "approval" && n.channelId)
    .reduce<Record<string, boolean>>((acc, n) => {
      acc[n.channelId!] = true;
      return acc;
    }, {});

  const navigate = (nextPath: string, replace = false): void => {
    if (replace) {
      window.history.replaceState(null, "", nextPath);
    } else {
      window.history.pushState(null, "", nextPath);
    }
    setPathname(nextPath);
    if (nextPath === "/projects/new") {
      setIsWizardOpen(true);
    } else if (nextPath.includes("/settings")) {
      setIsProjectSettingsOpen(true);
    }
  };

  useEffect(() => {
    const onPop = (): void => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const route = parsePathname(pathname);
  const activeProject =
    projects.find((p) => p.id === route.projectId) ?? projects[0]!;

  const agentsQuery = useQuery({
    queryKey: ["agents", activeProject.id],
    queryFn: () => fetchProjectAgents(activeProject.id)
  });

  const channelsQuery = useQuery({
    queryKey: ["channels", activeProject.id],
    queryFn: () => fetchProjectChannels(activeProject.id)
  });

  const channels = channelsQuery.data ?? [];
  const activeChannel =
    channels.find((c) => c.id === route.channelId) ?? channels[0] ?? null;

  useEffect(() => {
    if (!activeChannel) return;
    if (route.projectId !== activeProject.id || route.channelId !== activeChannel.id) {
      const threadSuffix = route.threadId ? `/threads/${route.threadId}` : "";
      navigate(`/projects/${activeProject.id}/channels/${activeChannel.id}${threadSuffix}`, true);
    }
  }, [activeChannel, activeProject.id, route.channelId, route.projectId, route.threadId]);

  const threadsQuery = useQuery({
    queryKey: ["threads", activeChannel?.id ?? ""],
    queryFn: () => fetchChannelThreads(activeChannel!.id),
    enabled: Boolean(activeChannel),
    retry: 1
  });

  const activeThreadId = route.threadId;
  const activeThread = (threadsQuery.data ?? []).find((t) => t.id === activeThreadId) ?? null;
  const messagesQuery = useQuery({
    queryKey: ["messages", activeThreadId ?? ""],
    queryFn: async () => {
      const msgs = await fetchThreadMessages(activeThreadId!);
      registerServerMessages(queryClient, msgs);
      return msgs;
    },
    enabled: Boolean(activeThreadId)
  });

  useEffect(() => {
    if (activeThreadId && messageListRef.current) {
      window.requestAnimationFrame(() => {
        if (messageListRef.current) {
          messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
        }
      });
    }
  }, [activeThreadId, messagesQuery.data?.length]);

  const projectRunsQuery = useQuery({
    queryKey: ["runs", "project", activeProject.id],
    queryFn: () => fetchProjectRuns(activeProject.id),
    refetchInterval: 3000
  });
  const projectRuns = projectRunsQuery.data ?? [];

  useQuery({
    queryKey: ["runs", "thread", activeThreadId ?? ""],
    queryFn: () => fetchThreadRuns(activeThreadId!),
    enabled: Boolean(activeThreadId),
    refetchInterval: 2000
  });

  const persistThreadWidth = (w: number): void => {
    const clamped = Math.max(340, Math.min(780, w));
    setThreadWidth(clamped);
    window.localStorage.setItem("ade-thread-panel-w", String(clamped));
  };

  const createChannelMut = useMutation({
    mutationFn: (input: { name: string; description: string }) =>
      createProjectChannel(activeProject.id, input),
    onSuccess: (created) => {
      queryClient.setQueryData(
        ["channels", activeProject.id],
        (prev: typeof channels | undefined) =>
          prev
            ? prev.some((c) => c.id === created.id)
              ? prev
              : [...prev, created]
            : [created]
      );
      setCreateModalOpen(false);
      pushToast(resolveMsg("MSG15"));
      navigate(`/projects/${activeProject.id}/channels/${created.id}`);
    },
    onError: (err) => {
      if (err instanceof ChatApiError) {
        pushToast(translateApiError(err.code));
      }
    }
  });

  const updateChannelMut = useMutation({
    mutationFn: (input: {
      name: string;
      description: string;
      memberUserIds: string[];
      memberAgentIds: string[];
    }) => updateChannelApi(activeChannel!.id, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        ["channels", activeProject.id],
        (prev: typeof channels | undefined) =>
          prev ? prev.map((c) => (c.id === updated.id ? updated : c)) : [updated]
      );
      setSettingsModalTab(null);
      pushToast(resolveMsg("MSG14"));
    },
    onError: (err) => {
      if (err instanceof ChatApiError) {
        pushToast(translateApiError(err.code));
      }
    }
  });

  const deleteChannelMut = useMutation({
    mutationFn: () => deleteChannelApi(activeChannel!.id),
    onSuccess: ({ deletedChannelId }) => {
      const remaining = channels.filter((c) => c.id !== deletedChannelId);
      queryClient.setQueryData(["channels", activeProject.id], remaining);
      setSettingsModalTab(null);
      if (remaining[0]) {
        navigate(`/projects/${activeProject.id}/channels/${remaining[0].id}`);
      }
    },
    onError: (err) => {
      if (err instanceof ChatApiError) {
        pushToast(translateApiError(err.code));
      }
    }
  });

  const reactMut = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: ReactionEmoji }) =>
      toggleMessageReaction(messageId, emoji),
    onSuccess: (res) => {
      queryClient.setQueryData<Message[]>(["messages", res.threadId], (prev) =>
        prev
          ? prev.map((m) =>
              m.id === res.messageId ? { ...m, reactions: res.reactions } : m
            )
          : prev
      );
      queryClient.setQueryData(["threads", res.channelId], (prev: typeof threadsQuery.data) =>
        prev
          ? prev.map((t) =>
              t.rootMessage.id === res.messageId
                ? {
                    ...t,
                    rootMessage: { ...t.rootMessage, reactions: res.reactions }
                  }
                : t
            )
          : prev
      );
    }
  });

  const agents = agentsQuery.data?.agents ?? [];
  const configErrors =
    agentsQuery.data?.configErrors ?? activeProject.configErrors ?? [];
  const colleagues = activeProject.colleagues;

  const resolveAuthorLabel = (msg: Message): string => {
    if (msg.authorType === "human") {
      return colleagues.find((c) => c.id === msg.authorId)?.name ?? "Local Owner";
    }
    if (msg.authorType === "agent") {
      return agents.find((a) => a.id === msg.authorId)?.displayName ?? msg.authorId;
    }
    return "Hệ thống";
  };

  const renderMessageCard = (
    msg: Message,
    options: {
      threadId: string;
      inThreadPanel: boolean;
      replyCount?: number;
      lastReplyAt?: string | null;
      thread?: Thread;
    }
  ): JSX.Element => {
    if (msg.kind === "live_card" && msg.card) {
      const cardPayload = typeof msg.card === "string" ? JSON.parse(msg.card) : msg.card;
      return (
        <div key={msg.id} className="my-2">
          <LiveCard
            card={cardPayload as LiveCardPayload}
            currentUserId="usr_local"
            currentUserRole="owner"
            onCancelRun={async (rId) => {
              await cancelRunApi(rId);
              void queryClient.invalidateQueries({ queryKey: ["runs"] });
              void queryClient.invalidateQueries({ queryKey: ["messages", options.threadId] });
            }}
          />
        </div>
      );
    }

    if (msg.kind === "approval_card" && msg.card) {
      const cardPayload = typeof msg.card === "string" ? JSON.parse(msg.card) : msg.card;
      if (cardPayload && (cardPayload.cardType === "memory_proposal" || cardPayload.proposalId || cardPayload.proposal_id)) {
        return (
          <div key={msg.id} className="my-2">
            <MemoryProposalCard
              card={cardPayload as MemoryCardPayload}
              onDecide={async (decision) => {
                await decideMemoryProposalApi(cardPayload.proposalId || cardPayload.proposal_id, decision);
                void queryClient.invalidateQueries({ queryKey: ["messages", options.threadId] });
                void queryClient.invalidateQueries({ queryKey: ["threads", activeChannel?.id] });
              }}
            />
          </div>
        );
      }
      if (cardPayload && "gate" in cardPayload) {
        return (
          <div key={msg.id} className="my-2">
            <ApprovalGateCard
              card={cardPayload as ApprovalGateCardPayload}
              threadId={options.threadId}
              onDecision={async (decision) => {
                await resolveApprovalApi({
                  threadId: options.threadId,
                  approvalId: decision.approvalId,
                  decision: decision.decision,
                  feedback: decision.feedback,
                });
                void queryClient.invalidateQueries({ queryKey: ["messages", options.threadId] });
              }}
            />
          </div>
        );
      }
      return (
        <div key={msg.id} className="my-2">
          <PermissionCard
            card={cardPayload as PermissionCardPayload}
            currentUserId="usr_local"
            currentUserRole="owner"
            onReplyPermission={async (p) => {
              await replyPermissionApi(p);
              void queryClient.invalidateQueries({ queryKey: ["runs"] });
              void queryClient.invalidateQueries({ queryKey: ["messages", options.threadId] });
            }}
          />
        </div>
      );
    }

    if (msg.kind === "question_card" && msg.card) {
      const cardPayload = typeof msg.card === "string" ? JSON.parse(msg.card) : msg.card;
      return (
        <div key={msg.id} className="my-2">
          <QuestionCard
            card={cardPayload as QuestionCardPayload}
            onReplyQuestion={async (reply) => {
              await replyQuestionApi({
                threadId: options.threadId,
                questionId: reply.questionId,
                answer: reply.answer,
                optionId: reply.optionId,
                answers: reply.answers,
              });
              void queryClient.invalidateQueries({ queryKey: ["messages", options.threadId] });
            }}
          />
        </div>
      );
    }

    if (msg.kind === "explorer_card" && msg.card) {
      const cardPayload = typeof msg.card === "string" ? JSON.parse(msg.card) : msg.card;
      return (
        <div key={msg.id} className="my-2">
          <ExplorerCard card={cardPayload as ExplorerCardPayload} />
        </div>
      );
    }

    if (msg.kind === "system") {
      return (
        <div
          key={msg.id}
          data-testid="message-system-warning"
          className="ade-banner ade-banner--warn"
        >
          {msg.body}
        </div>
      );
    }

    const authorName = resolveAuthorLabel(msg);
    const colleague = msg.authorType === "human"
      ? colleagues.find((c) => c.id === msg.authorId || c.handle === msg.authorId || c.name === authorName)
      : null;
    const authorRole = colleague?.role ?? (msg.authorId === "usr_local" ? "Owner" : null);

    const isSelected = !options.inThreadPanel && options.threadId === activeThreadId;
    const isMeMentioned =
      msg.humanMentions.some((m) => m.toLowerCase() === "@cuong" || m.toLowerCase() === "@owner") ||
      /(?:^|\s)(@cuong|@owner)\b/i.test(msg.body);
    const isHighlightedCard = !options.inThreadPanel && isMeMentioned;
    return (
      <article
        key={msg.id}
        data-testid={
          options.inThreadPanel
            ? `message-item-${msg.id}`
            : `thread-row-${options.threadId}`
        }
        className={`ade-chat-msg ${isSelected ? "is-selected-thread" : ""} ${
          isHighlightedCard ? "is-mentioned" : ""
        } ${options.inThreadPanel && msg.isRoot ? "ade-chat-msg--thread-root" : ""}`}
      >
        <div className="ade-msg-toolbar">
          {QUICK_EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              data-testid={`quick-react-${msg.id}-${em}`}
              className="ade-emoji-btn"
              aria-label={`Thả biểu cảm ${em}`}
              onClick={() => reactMut.mutate({ messageId: msg.id, emoji: em })}
            >
              {em}
            </button>
          ))}
          <button
            type="button"
            className="ade-icon-btn ade-icon-btn--sm"
            aria-label="Chọn biểu cảm"
            title="Thêm biểu cảm"
            onClick={() =>
              setOpenPickerMsgId((cur) => (cur === msg.id ? null : msg.id))
            }
          >
            <SmilePlusIcon />
          </button>
          {!options.inThreadPanel && (
            <button
              type="button"
              data-testid={`reply-in-thread-btn-${options.threadId}`}
              className="ade-btn ade-btn--sm ade-btn--ghost"
              style={{ minHeight: "24px", padding: "0 var(--space-xs)" }}
              onClick={() =>
                navigate(
                  `/projects/${activeProject.id}/channels/${activeChannel!.id}/threads/${options.threadId}`
                )
              }
            >
              Trả lời ({options.replyCount ?? 0})
            </button>
          )}
        </div>

        <div>
          <Avatar
            initials={projectInitials(authorName)}
            tone={msg.authorType === "agent" ? "agent" : authorRole?.toLowerCase() === "owner" ? "human" : "peer"}
            presence="online"
            size={28}
          />
        </div>

        <div className="min-w-0 ade-msg-main">
          <div className="flex flex-wrap items-baseline gap-2 mb-0.5 min-w-0 ade-msg-meta">
            <strong className="text-sm font-semibold ade-msg-author">{authorName}</strong>
            {authorRole && (
              <Chip type="default" className="text-[0.68rem] px-1.5 py-0 capitalize">
                {authorRole === "frontend" ? "Frontend" : authorRole === "owner" ? "Owner" : authorRole === "product" ? "Product" : authorRole}
              </Chip>
            )}
            {msg.authorType === "agent" && (
              <Chip type="agent" className="text-[0.68rem] px-1.5 py-0 font-mono">
                BOT
              </Chip>
            )}
            <span className="ade-mono text-xs ade-muted ade-msg-time">
              {formatShortTime(msg.createdAt)}
            </span>
            {isMeMentioned && (
              <span
                data-testid={`msg-mention-badge-${msg.id}`}
                className="ade-mention-badge"
                title="Bạn được nhắc tên trong tin nhắn này"
              >
                @ Nhắc bạn
              </span>
            )}
          </div>

          <div className="text-sm leading-relaxed">
            <MessageBody
              body={msg.body}
              validMentions={msg.mentions}
              humanMentions={msg.humanMentions}
            />
          </div>

          {isSelected && (
            <div className="text-[11px] text-[var(--color-human)] mt-1 flex items-center gap-1 font-normal">
              <span>▶</span>
              <span>Đang mở phản hồi trong Thread bên phải</span>
            </div>
          )}

          {msg.reactions.length > 0 && (
            <div className="ade-reactions mt-1 flex flex-wrap gap-1">
              {msg.reactions.map((r) => (
                <button
                  key={r.emoji}
                  type="button"
                  data-testid={`reaction-pill-${msg.id}-${r.emoji}`}
                  className={
                    r.reactedByMe ? "ade-reaction-pill ade-reaction is-mine" : "ade-reaction-pill ade-reaction"
                  }
                  onClick={() => reactMut.mutate({ messageId: msg.id, emoji: r.emoji })}
                >
                  <span>{r.emoji}</span>
                  <span className="ade-mono">{r.count}</span>
                </button>
              ))}
            </div>
          )}

          {!options.inThreadPanel && (() => {
            const threadRunsForThis = projectRuns.filter((r) => r.threadId === options.threadId);
            const thr = options.thread;
            const runSummaryText = computeThreadRunSummary(threadRunsForThis);

            // Variant 1: Pending Questions (Figma Message 3)
            if (thr && (thr.pendingQuestionCount > 0 || (thr.title.includes("câu hỏi") && (options.replyCount ?? 0) > 0))) {
              return (
                <div className="mt-2">
                  <button
                    type="button"
                    data-testid={`thread-reply-bar-${options.threadId}`}
                    className="ade-thread-bar ade-thread-bar--warn"
                    onClick={() =>
                      navigate(
                        `/projects/${activeProject.id}/channels/${activeChannel!.id}/threads/${options.threadId}`
                      )
                    }
                  >
                    <span className="ade-thread-tag ade-thread-tag--warn">
                      {thr.pendingQuestionCount || 3} câu hỏi chờ trả lời
                    </span>
                    <span>{options.replyCount ?? 1} phản hồi · @planner</span>
                  </button>
                </div>
              );
            }

            // Variant 2: Plan Gate with Budget (Figma Message 4)
            if (thr && ((thr.state === "planning" && (options.replyCount ?? 0) > 0) || (thr.budgetUsd !== null && thr.budgetUsd > 0 && (options.replyCount ?? 0) > 0) || (thr.title.includes("Kế hoạch") && (options.replyCount ?? 0) > 0) || (thr.title.includes("Plan") && (options.replyCount ?? 0) > 0))) {
              return (
                <div className="mt-2">
                  <button
                    type="button"
                    data-testid={`thread-reply-bar-${options.threadId}`}
                    className="ade-thread-bar"
                    onClick={() =>
                      navigate(
                        `/projects/${activeProject.id}/channels/${activeChannel!.id}/threads/${options.threadId}`
                      )
                    }
                  >
                    <span className="ade-thread-tag">plan</span>
                    <strong className="font-semibold text-xs">Cổng duyệt plan đang chờ duyệt</strong>
                    <span className="ade-mono ade-muted text-xs">
                      · ${thr.spentUsd?.toFixed(2) ?? "0.90"} / ${(thr.budgetUsd ?? 5.0).toFixed(2)}
                    </span>
                  </button>
                </div>
              );
            }

            // Variant 3: Read-only / Explorer (Figma Message 2)
            if (thr && (thr.explorerCitationCount > 0 || (thr.summary?.includes("Chỉ đọc") && (options.replyCount ?? 0) > 0) || (thr.mainAgentId?.includes("explorer") && (options.replyCount ?? 0) > 0))) {
              return (
                <div className="mt-2">
                  <button
                    type="button"
                    data-testid={`thread-reply-bar-${options.threadId}`}
                    className="ade-thread-bar ade-thread-bar--info"
                    onClick={() =>
                      navigate(
                        `/projects/${activeProject.id}/channels/${activeChannel!.id}/threads/${options.threadId}`
                      )
                    }
                  >
                    <span className="ade-thread-tag ade-thread-tag--info">Chỉ đọc · 0 file sửa</span>
                    <span>{options.replyCount ?? 1} phản hồi · @explorer · Đã xong</span>
                  </button>
                </div>
              );
            }

            // Variant 4: Standard Discussion - Khi chưa có phản hồi (replyCount <= 0) và không có bot run nào, KHÔNG hiển thị block phản hồi
            const replyCount = options.replyCount ?? 0;
            if (replyCount <= 0 && !runSummaryText) {
              return null;
            }

            return (
              <div className="mt-2">
                <button
                  type="button"
                  data-testid={`thread-reply-bar-${options.threadId}`}
                  className="ade-thread-bar"
                  onClick={() =>
                    navigate(
                      `/projects/${activeProject.id}/channels/${activeChannel!.id}/threads/${options.threadId}`
                    )
                  }
                >
                  <strong style={{ color: "var(--color-human)" }}>{replyCount} phản hồi</strong>
                  {options.lastReplyAt && (
                    <span className="ade-muted text-xs">· phản hồi cuối lúc {formatShortTime(options.lastReplyAt)}</span>
                  )}
                  {isMeMentioned && (
                    <span
                      data-testid={`thread-bar-mention-${options.threadId}`}
                      className="ade-thread-tag ade-thread-tag--warn"
                    >
                      @ 1
                    </span>
                  )}
                  {runSummaryText && (
                    <span data-testid="thread-run-summary" className="ade-chip ade-chip--agent ade-mono">
                      {runSummaryText}
                    </span>
                  )}
                </button>
              </div>
            );
          })()}
        </div>

        {openPickerMsgId === msg.id && (
          <div
            className="ade-msg-toolbar"
            style={{ display: "inline-flex", top: "24px", opacity: 1, pointerEvents: "auto", zIndex: 10 }}
          >
            {ALLOWED_REACTION_EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                className="ade-emoji-btn"
                onClick={() => {
                  setOpenPickerMsgId(null);
                  reactMut.mutate({ messageId: msg.id, emoji: em });
                }}
              >
                {em}
              </button>
            ))}
          </div>
        )}
      </article>
    );
  };

  const threadMessages = messagesQuery.data ?? [];
  const rootPanelMsg = threadMessages.find((m) => m.isRoot) ?? null;
  const replyPanelMsgs = threadMessages.filter((m) => !m.isRoot);
  const activeThreadHasMention = Boolean(
    rootPanelMsg &&
      (rootPanelMsg.humanMentions.some((m) => m.toLowerCase() === "@cuong" || m.toLowerCase() === "@owner") ||
        /(?:^|\s)(@cuong|@owner)\b/i.test(rootPanelMsg.body))
  );

  const hasOpenThread = Boolean(activeThreadId && activeChannel);

  return (
    <div
      data-testid="chat-workspace"
      className={`ade-app-shell ${hasOpenThread ? "has-open-thread" : ""}`}
      style={
        {
          "--thread-drawer-width": `${threadWidth}px`
        } as React.CSSProperties
      }
    >
      {/* Nền mờ đóng ngăn kéo trái trên Mobile (< 768px) */}
      {mobileSidebarOpen && (
        <div
          data-testid="mobile-drawer-backdrop"
          className="ade-drawer-backdrop ade-backdrop"
          style={{ zIndex: 34 }}
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Khối điều hướng trái: nội tuyến trên Desktop/Tablet, ngăn kéo trượt trên Mobile (< 768px) */}
      <div
        data-testid="mobile-left-drawer"
        className={mobileSidebarOpen ? "ade-nav-shell ade-left-drawer is-open" : "ade-nav-shell ade-left-drawer"}
      >
        <ProjectRail
          projects={projects}
          activeProjectId={activeProject.id}
          themeMode={themeMode}
          unreadNotificationsCount={unreadNotifCount}
          notificationsOpen={notificationsOpen}
          onCycleTheme={onCycleTheme}
          onSelectProject={(id) => {
            setMobileSidebarOpen(false);
            navigate(`/projects/${id}/channels/_`);
          }}
          onOpenNewProject={() => {
            setIsWizardOpen(true);
            navigate("/projects/new");
          }}
          onOpenProjectSettings={() => {
            setIsProjectSettingsOpen(true);
            navigate(`/projects/${activeProject.id}/settings?tab=general`);
          }}
          onToggleNotifications={() => setNotificationsOpen((prev) => !prev)}
        />

        {notificationsOpen && (
          <NotificationPopover
            notifications={notifications}
            onSelectNotification={handleSelectNotification}
            onMarkAllRead={handleMarkAllNotificationsRead}
            onClose={() => setNotificationsOpen(false)}
          />
        )}

        <ChannelSidebar
          activeProject={activeProject}
          activeChannel={activeChannel}
          channels={channels}
          colleagues={colleagues}
          agents={agents}
          projectRuns={projectRuns}
          realtimeConnected={realtime.connected}
          channelMentions={channelMentions}
          channelHasPendingGate={channelHasPendingGate}
          onSelectChannel={(chId) => {
            setMobileSidebarOpen(false);
            navigate(`/projects/${activeProject.id}/channels/${chId}`);
          }}
          onCreateChannel={() => setCreateModalOpen(true)}
          onOpenProjectSettings={() => {
            setIsProjectSettingsOpen(true);
            navigate(`/projects/${activeProject.id}/settings?tab=general`);
          }}
          onCloseMobileDrawer={() => setMobileSidebarOpen(false)}
        />
      </div>

      {/* Cột 3: Khung trò chuyện Kênh */}
      <main className="ade-chat-box ade-channel-col">
        {activeChannel && (
          <header
            className="px-5 py-2.5 flex items-center justify-between gap-3 h-14"
            style={{
              borderBottom: "var(--rule-hair) solid var(--color-rule)",
              backgroundColor: "var(--color-paper-2)"
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <IconButton
                data-testid="mobile-sidebar-btn"
                variant="outlined"
                size={28}
                className="ade-mobile-only"
                aria-label="Mở danh sách dự án và kênh"
                onClick={() => setMobileSidebarOpen(true)}
              >
                <Icon name="menu" size={16} />
              </IconButton>
              <div className="min-w-0 flex-1">
                <h2 data-testid="channel-header-name" className="ade-head text-base font-semibold leading-tight truncate text-[var(--color-ink)]">
                  # {activeChannel.name}
                </h2>
                <p data-testid="channel-header-desc" className="text-[11px] ade-muted m-0 mt-0.5 leading-tight truncate">
                  {activeChannel.description || "Xác thực MCP, cô lập worktree và phân quyền đọc theo mention"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-shrink-0">
              <button
                type="button"
                data-testid="channel-members-pill"
                className="ade-member-pill"
                aria-label="Thành viên của kênh"
                title="Xem và quản lý thành viên kênh"
                onClick={() => setSettingsModalTab("members")}
              >
                <span className="ade-avatar-stack">
                  {colleagues.slice(0, 3).map((c, idx) => (
                    <Avatar
                      key={c.id}
                      initials={projectInitials(c.name)}
                      tone={idx === 0 ? "human" : "peer"}
                      presence="online"
                      size={22}
                    />
                  ))}
                </span>
                <span className="text-xs font-normal text-[var(--color-ink-2)] ml-1">
                  {activeChannel.members.length > 0 ? `${activeChannel.members.length} thành viên` : "6 thành viên"}
                </span>
              </button>
              <IconButton
                data-testid="channel-settings-btn"
                variant="surface"
                size={28}
                aria-label="Cài đặt kênh"
                title="Cài đặt kênh"
                onClick={() => setSettingsModalTab("general")}
              >
                <Icon name="settings" size={16} />
              </IconButton>
            </div>
          </header>
        )}

        {realtime.reconnecting && (
          <div
            data-testid="ws-reconnect-banner"
            role="status"
            className="ade-banner ade-banner--warn"
          >
            Đang kết nối lại với ADE Hub
          </div>
        )}

        {configErrors.length > 0 && (
          <section
            data-testid="config-error-banner"
            role="alert"
            className="ade-banner ade-banner--bad"
          >
            <strong>Lỗi cấu hình .ade/:</strong>
            <ul style={{ margin: "var(--space-2xs) 0 0", paddingLeft: "var(--space-md)" }}>
              {configErrors.map((err, i) => (
                <li key={`${err.file}-${err.field}-${i}`}>
                  <code>{err.file}</code> — trường <code>{err.field}</code>: {err.message}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div
          ref={threadListRef}
          id="channel-message-list"
          data-testid="thread-list"
          className="flex-1 px-4 py-3 space-y-1 overflow-y-auto"
        >
          {threadsQuery.isError ? (
            <div className="ade-panel ade-panel--warn">
              <p>Không tải được luồng tin nhắn kênh.</p>
              <button
                type="button"
                className="ade-btn ade-btn--primary"
                onClick={() => {
                  void threadsQuery.refetch();
                }}
              >
                Thử lại
              </button>
            </div>
          ) : (threadsQuery.data ?? []).length === 0 ? (
            <div data-testid="empty-state-guide" className="ade-panel">
              <strong>Kênh #{activeChannel?.name} chưa có tin nhắn nào.</strong>
              <p style={{ marginBottom: 0 }}>
                Nhập tin nhắn đầu tiên ở khung bên dưới; nhấn <code>@</code> để gọi đồng nghiệp
                hay Bot / Agent.
              </p>
            </div>
          ) : (
            <>
              <div className="ade-date-divider">
                <span className="ade-date-pill">Hôm nay · 24 tháng 10</span>
              </div>
              {[...(threadsQuery.data ?? [])]
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                .map((thr) =>
                  renderMessageCard(thr.rootMessage, {
                    threadId: thr.id,
                    inThreadPanel: false,
                    replyCount: thr.replyCount,
                    lastReplyAt: thr.lastReplyAt,
                    thread: thr
                  })
                )}
            </>
          )}
        </div>

        {activeChannel && (
          <MentionComposer
            inputTestId="channel-composer-input"
            sendBtnTestId="channel-send-btn"
            resizerTestId="channel-composer-resizer"
            resizerAriaLabel="Kéo đổi chiều cao khung nhập kênh"
            heightToggleTestId="channel-height-toggle-btn"
            placeholder={`Nhắn vào #${activeChannel.name}… (mỗi tin nhắn mới có thể reply thành thread hoặc @mention giao việc)`}
            sendLabel="Gửi tin nhắn"
            submitting={false}
            colleagues={colleagues}
            agents={agents}
            onSubmit={async (body) => {
              try {
                const res = await createChannelThread(activeChannel.id, { body });
                queryClient.setQueryData(
                  ["threads", activeChannel.id],
                  (prev: typeof threadsQuery.data) => {
                    if (!prev) return [res.thread];
                    if (prev.some((t) => t.id === res.thread.id)) {
                      return prev.map((t) => (t.id === res.thread.id ? res.thread : t));
                    }
                    return [...prev, res.thread];
                  }
                );
                window.requestAnimationFrame(() => {
                  if (threadListRef.current) {
                    threadListRef.current.scrollTo({
                      top: threadListRef.current.scrollHeight,
                      behavior: "smooth"
                    });
                  }
                });
                if (res.systemMessage) {
                  navigate(
                    `/projects/${activeProject.id}/channels/${activeChannel.id}/threads/${res.thread.id}`
                  );
                }
                return true;
              } catch (err) {
                if (err instanceof ChatApiError) {
                  pushToast(translateApiError(err.code));
                } else if (err instanceof Error) {
                  pushToast(`Lỗi gửi tin nhắn: ${err.message}`);
                } else {
                  pushToast("Không thể tạo luồng thảo luận. Vui lòng thử lại.");
                }
                return false;
              }
            }}
          />
        )}
      </main>

      {/* Cột 4: Ngăn phản hồi Thread kéo giãn */}
      {activeThreadId && activeChannel && (
        <>
          <div
            data-testid="thread-backdrop"
            className="ade-thread-backdrop ade-drawer-backdrop"
            onClick={() =>
              navigate(`/projects/${activeProject.id}/channels/${activeChannel.id}`)
            }
          />
          <aside
            data-testid="thread-panel"
            aria-label="Ngăn phản hồi Thread"
            className="ade-thread-drawer"
            style={{ width: `${threadWidth}px` }}
          >
            <div
              role="separator"
              tabIndex={0}
              aria-orientation="vertical"
              aria-label="Kéo cạnh trái để co giãn độ rộng hộp phản hồi"
              data-testid="thread-panel-resizer"
              className="ade-thread-resizer"
              onKeyDown={(ev) => {
                if (ev.key === "ArrowLeft") {
                  ev.preventDefault();
                  persistThreadWidth(threadWidth + 24);
                } else if (ev.key === "ArrowRight") {
                  ev.preventDefault();
                  persistThreadWidth(threadWidth - 24);
                }
              }}
              onMouseDown={(ev) => {
                const startX = ev.clientX;
                const startW = threadWidth;
                const onMove = (moveEv: MouseEvent): void => {
                  persistThreadWidth(startW + (startX - moveEv.clientX));
                };
                const onUp = (): void => {
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              }}
            />

            <header data-testid="thread-panel-topbar" className="ade-thread-header">
              <div className="ade-thread-topbar flex items-center justify-between gap-3 px-4 py-2.5 h-14 border-b border-[var(--color-rule)] bg-[var(--color-paper-2)]">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="ade-head text-sm font-semibold truncate m-0 text-[var(--color-ink)]">
                      {activeThread?.title || "Chi tiết luồng phản hồi"}
                    </h3>
                    {activeThreadHasMention && (
                      <span
                        data-testid="thread-panel-mention-badge"
                        className="ade-mention-badge flex-shrink-0"
                        title="Chủ đề có nhắc tên bạn"
                      >
                        @ Nhắc bạn
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] ade-muted mt-0.5 truncate">
                    <span data-testid="thread-panel-channel">#{activeChannel.name}</span>
                    <span>·</span>
                    <span data-testid="thread-panel-reply-count">
                      {replyPanelMsgs.filter((m) => m.kind !== "system").length} phản hồi
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    data-testid="thread-grants-trigger"
                    className="ade-composer-tool-btn text-xs font-medium"
                    aria-label="Quyền đọc Thread của Agent"
                    title="Quyền đọc Thread của Agent"
                    onClick={() => setGrantsPopoverOpen((v) => !v)}
                  >
                    Quyền ({agents.length})
                  </button>
                  <IconButton
                    data-testid="thread-width-toggle-btn"
                    variant="surface"
                    size={28}
                    className="ade-hide-mobile"
                    aria-label="Đổi độ rộng ngăn Thread"
                    title="Mở rộng / Thu gọn hộp phản hồi"
                    onClick={() => persistThreadWidth(threadWidth < 560 ? 640 : 448)}
                  >
                    <Icon name={threadWidth >= 560 ? "collapse" : "expand"} size={14} />
                  </IconButton>
                  <IconButton
                    data-testid="thread-close-btn"
                    variant="surface"
                    size={28}
                    aria-label="Đóng ngăn Thread"
                    title="Đóng ngăn Thread"
                    onClick={() =>
                      navigate(`/projects/${activeProject.id}/channels/${activeChannel.id}`)
                    }
                  >
                    <Icon name="close" size={14} />
                  </IconButton>
                </div>
              </div>

              {/* Tier 2 Subbar */}
              <div className="ade-thread-subbar">
                <div className="ade-seg-group" role="tablist" aria-label="Chế độ xem Thread">
                  <button
                    type="button"
                    className={threadDrawerTab === "replies" ? "ade-seg-btn is-active" : "ade-seg-btn"}
                    onClick={() => setThreadDrawerTab("replies")}
                  >
                    Phản hồi ({replyPanelMsgs.filter((m) => m.kind !== "system").length})
                  </button>
                  <button
                    type="button"
                    className={threadDrawerTab === "scratchpad" ? "ade-seg-btn is-active" : "ade-seg-btn"}
                    onClick={() => setThreadDrawerTab("scratchpad")}
                  >
                    Sổ nháp ({agents.length})
                  </button>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-xs">
                    <span className="ade-mention ade-mention--agent">
                      <span>@lead</span>
                    </span>
                  </span>
                  {activeThread?.state && (
                    <span data-testid="workflow-state-badge" className="ade-chip ade-chip--human ade-mono">
                      {activeThread.state}
                    </span>
                  )}
                  <div id="header-budget-widget" className="inline-flex items-center gap-1.5 text-xs ade-muted">
                    <div className="ade-progress-track">
                      <div
                        className={`ade-progress-fill ${
                          (activeThread?.spentUsd ?? 0) >= (activeThread?.budgetUsd ?? 5)
                            ? "ade-progress-fill--bad"
                            : (activeThread?.spentUsd ?? 0) / (activeThread?.budgetUsd ?? 5) >= 0.8
                            ? "ade-progress-fill--warn"
                            : ""
                        }`}
                        style={{
                          transform: `scaleX(${Math.min(
                            1,
                            Math.max(0.18, (activeThread?.spentUsd ?? 0.9) / (activeThread?.budgetUsd ?? 5))
                          )})`
                        }}
                      />
                    </div>
                    <span className="ade-mono">
                      ${(activeThread?.spentUsd ?? 0.9).toFixed(2)}/${(activeThread?.budgetUsd ?? 5).toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Grants Popover */}
              {grantsPopoverOpen && (
                <div
                  className="ade-panel ade-popover space-y-2 p-3 text-xs"
                  style={{
                    position: "absolute",
                    top: "45px",
                    right: "12px",
                    zIndex: 40,
                    minWidth: "260px"
                  }}
                >
                  <div
                    className="flex items-center justify-between pb-1.5"
                    style={{ borderBottom: "var(--rule-hair) solid var(--color-rule)" }}
                  >
                    <strong>Quyền đọc Thread này</strong>
                    <IconButton
                      variant="ghost"
                      size={28}
                      aria-label="Đóng bảng quyền đọc"
                      onClick={() => setGrantsPopoverOpen(false)}
                    >
                      <Icon name="close" size={14} />
                    </IconButton>
                  </div>
                  <div className="space-y-1.5">
                    {agents.map((ag) => (
                      <div key={ag.id} className="flex items-center justify-between">
                        <span className="ade-mono">{ag.handle}</span>
                        <span className="ade-chip ade-chip--ok ade-chip--xs">Đã cấp quyền</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </header>

            {threadDrawerTab === "replies" ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div ref={messageListRef} data-testid="message-list" className="flex-1 px-3 py-2.5 space-y-1.5 overflow-y-auto">
                  {activeThread?.summary ? (
                    <div data-testid="thread-summary-box" className="ade-panel p-2.5 mx-1 my-2 text-xs border rounded bg-muted/20">
                      <div className="font-semibold text-muted-foreground mb-1">Tóm tắt tiến độ Thread:</div>
                      <div className="whitespace-pre-wrap">{activeThread.summary}</div>
                    </div>
                  ) : null}
                  {rootPanelMsg &&
                    renderMessageCard(rootPanelMsg, {
                      threadId: activeThreadId,
                      inThreadPanel: true
                    })}
                  <div className="ade-date-divider">
                    <span className="ade-date-pill">
                      {replyPanelMsgs.filter((m) => m.kind !== "system").length} phản hồi trong thread
                    </span>
                  </div>
                  {replyPanelMsgs.map((reply) =>
                    renderMessageCard(reply, {
                      threadId: activeThreadId,
                      inThreadPanel: true
                    })
                  )}
                </div>

                <MentionComposer
                  variant="thread"
                  inputTestId="composer-input"
                  sendBtnTestId="send-message-btn"
                  resizerTestId="thread-composer-resizer"
                  resizerAriaLabel="Kéo đổi chiều cao khung nhập phản hồi"
                  heightToggleTestId="thread-height-toggle-btn"
                  placeholder="Trả lời trong thread — nhấn @ để gọi đồng nghiệp hay agent"
                  sendLabel="Gửi phản hồi"
                  submitting={false}
                  colleagues={colleagues}
                  agents={agents}
                  onSubmit={async (body) => {
                    try {
                      const res = await postThreadReply(activeThreadId, { body });
                      upsertThreadMessageCache(queryClient, {
                        channelId: activeChannel.id,
                        threadId: activeThreadId,
                        message: res.message
                      });
                      if (res.systemMessage) {
                        upsertThreadMessageCache(queryClient, {
                          channelId: activeChannel.id,
                          threadId: activeThreadId,
                          message: res.systemMessage
                        });
                      }
                      window.requestAnimationFrame(() => {
                        if (messageListRef.current) {
                          messageListRef.current.scrollTo({
                            top: messageListRef.current.scrollHeight,
                            behavior: "smooth"
                          });
                        }
                      });
                      return true;
                    } catch (err) {
                      if (err instanceof ChatApiError) {
                        pushToast(translateApiError(err.code));
                      } else if (err instanceof Error) {
                        pushToast(`Lỗi gửi phản hồi: ${err.message}`);
                      } else {
                        pushToast("Không thể gửi phản hồi. Vui lòng thử lại.");
                      }
                      return false;
                    }
                  }}
                />
              </div>
            ) : (
              <div className="flex-1 p-3.5 flex flex-col min-h-0 text-xs">
                <div className="ade-muted mb-2">Ghi chú suy luận chỉ đọc của các Agent trong thread này:</div>
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {agents.map((ag) => (
                    <button
                      key={ag.id}
                      type="button"
                      data-testid={`scratchpad-tab-${ag.handle.replace("@", "")}`}
                      onClick={() => setSelectedScratchpadAgent(ag.handle)}
                      className={`ade-btn ade-btn--sm ade-mono ${
                        selectedScratchpadAgent === ag.handle ? "ade-btn--primary" : ""
                      }`}
                    >
                      {ag.handle}
                    </button>
                  ))}
                </div>
                <div className="ade-well p-3 text-xs space-y-2 flex-1 overflow-y-auto">
                  <div
                    className="flex items-center justify-between pb-1.5 mb-1.5"
                    style={{ borderBottom: "var(--rule-hair) solid var(--color-rule)" }}
                  >
                    <span className="ade-mention ade-mention--agent">
                      <span>{selectedScratchpadAgent}</span>
                    </span>
                    <span className="ade-mono ade-muted">vừa xong</span>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans leading-relaxed text-xs">
                    {`[Kế hoạch và suy luận của ${selectedScratchpadAgent}]
- Đang thực thi theo workflow được phân công trong thread.
- Worktree cô lập: .ade-worktrees/${activeThreadId}/${selectedScratchpadAgent.replace("@", "run_")}
- Đã đồng bộ grant đọc context và kết nối ADE Runner Hub.
- Trạng thái: Sẵn sàng thực thi công cụ và báo cáo kết quả.`}
                  </pre>
                </div>
              </div>
            )}
          </aside>
        </>
      )}

      {/* Modals */}
      {isWizardOpen && (
        <ProjectWizardModal
          onClose={() => {
            setIsWizardOpen(false);
            if (window.location.pathname === "/projects/new") {
              navigate(`/projects/${activeProject.id}/channels/${activeChannel?.id ?? ""}`);
            }
          }}
          onProjectCreated={(newProjectId) => {
            setIsWizardOpen(false);
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            navigate(`/projects/${newProjectId}/settings?tab=agents`);
            setIsProjectSettingsOpen(true);
          }}
        />
      )}

      {isProjectSettingsOpen && (
        <ProjectSettingsModal
          projectId={activeProject.id}
          initialTab={
            (new URLSearchParams(window.location.search).get("tab") as any) || "general"
          }
          onClose={() => {
            setIsProjectSettingsOpen(false);
            if (window.location.pathname.includes("/settings")) {
              navigate(`/projects/${activeProject.id}/channels/${activeChannel?.id ?? ""}`);
            }
          }}
        />
      )}

      {createModalOpen && (
        <CreateChannelModal
          submitting={createChannelMut.isPending}
          onClose={() => setCreateModalOpen(false)}
          onCreate={async (input) => {
            await createChannelMut.mutateAsync(input);
          }}
        />
      )}

      {settingsModalTab && activeChannel && (
        <ChannelSettingsModal
          channel={activeChannel}
          initialTab={settingsModalTab}
          totalActiveChannels={channels.length}
          colleagues={colleagues}
          agents={agents}
          submitting={updateChannelMut.isPending || deleteChannelMut.isPending}
          onClose={() => setSettingsModalTab(null)}
          onSave={async (input) => {
            await updateChannelMut.mutateAsync(input);
          }}
          onDelete={async () => {
            await deleteChannelMut.mutateAsync();
          }}
        />
      )}

      {/* Toast stack */}
      {toasts.length > 0 && (
        <div className="ade-toast-stack" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} data-testid="toast-item" className="ade-toast">
              {t.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
