import { useEffect, useState, type JSX } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ALLOWED_REACTION_EMOJIS,
  resolveMsg,
  type Message,
  type ProjectSummary,
  type ReactionEmoji
} from "@ade/shared";
import {
  ChatApiError,
  createChannelThread,
  createProjectChannel,
  deleteChannelApi,
  fetchChannelThreads,
  fetchProjectAgents,
  fetchProjectChannels,
  fetchThreadMessages,
  postThreadReply,
  toggleMessageReaction,
  updateChannelApi
} from "../api/chat.js";
import { translateApiError } from "../i18n/vi.js";
import {
  registerServerMessages,
  upsertThreadMessageCache,
  useChatRealtime
} from "../hooks/useChatRealtime.js";
import { ChannelSettingsModal, CreateChannelModal } from "./ChannelModals.js";
import { MentionComposer } from "./MentionComposer.js";
import { MessageBody } from "./MessageBody.js";
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

  const pushToast = (text: string): void => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const navigate = (nextPath: string, replace = false): void => {
    if (replace) {
      window.history.replaceState(null, "", nextPath);
    } else {
      window.history.pushState(null, "", nextPath);
    }
    setPathname(nextPath);
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
      navigate(`/projects/${activeProject.id}/channels/${activeChannel.id}`, true);
    }
  }, [activeChannel, activeProject.id, route.channelId, route.projectId]);

  const threadsQuery = useQuery({
    queryKey: ["threads", activeChannel?.id ?? ""],
    queryFn: () => fetchChannelThreads(activeChannel!.id),
    enabled: Boolean(activeChannel),
    retry: 1
  });

  const activeThreadId = route.threadId;
  const messagesQuery = useQuery({
    queryKey: ["messages", activeThreadId ?? ""],
    queryFn: async () => {
      const msgs = await fetchThreadMessages(activeThreadId!);
      registerServerMessages(queryClient, msgs);
      return msgs;
    },
    enabled: Boolean(activeThreadId)
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
    options: { threadId: string; inThreadPanel: boolean; replyCount?: number }
  ): JSX.Element => {
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
    return (
      <article
        key={msg.id}
        data-testid={
          options.inThreadPanel
            ? `message-item-${msg.id}`
            : `thread-row-${options.threadId}`
        }
        className="ade-msg-card"
      >
        <div
          className={
            msg.authorType === "agent"
              ? "ade-avatar ade-avatar--agent"
              : "ade-avatar ade-avatar--human"
          }
        >
          {projectInitials(authorName)}
        </div>

        <div className="ade-msg-main">
          <div className="ade-msg-meta">
            <span className="ade-msg-author">{authorName}</span>
            <span className="ade-msg-time">{formatShortTime(msg.createdAt)}</span>
          </div>

          <MessageBody
            body={msg.body}
            validMentions={msg.mentions}
            humanMentions={msg.humanMentions}
          />

          {msg.reactions.length > 0 && (
            <div className="ade-reactions">
              {msg.reactions.map((r) => (
                <button
                  key={r.emoji}
                  type="button"
                  data-testid={`reaction-pill-${msg.id}-${r.emoji}`}
                  className={
                    r.reactedByMe ? "ade-reaction-pill is-mine" : "ade-reaction-pill"
                  }
                  onClick={() => reactMut.mutate({ messageId: msg.id, emoji: r.emoji })}
                >
                  <span>{r.emoji}</span>
                  <span>{r.count}</span>
                </button>
              ))}
            </div>
          )}

          {!options.inThreadPanel && (options.replyCount ?? 0) > 0 && (
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
              <span>{options.replyCount} phản hồi</span>
            </button>
          )}
        </div>

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
            className="ade-emoji-btn"
            aria-label="Mở bảng biểu cảm"
            onClick={() =>
              setOpenPickerMsgId((cur) => (cur === msg.id ? null : msg.id))
            }
          >
            +
          </button>
          {!options.inThreadPanel && (
            <button
              type="button"
              data-testid={`reply-in-thread-btn-${options.threadId}`}
              className="ade-emoji-btn"
              onClick={() =>
                navigate(
                  `/projects/${activeProject.id}/channels/${activeChannel!.id}/threads/${options.threadId}`
                )
              }
            >
              Trả lời
            </button>
          )}
        </div>

        {openPickerMsgId === msg.id && (
          <div
            className="ade-msg-toolbar"
            style={{ display: "inline-flex", top: "var(--space-lg)" }}
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

  return (
    <div data-testid="chat-workspace" className="ade-workspace">
      {/* Nền mờ đóng ngăn kéo trái trên Mobile (< 768px) */}
      {mobileSidebarOpen && (
        <div
          data-testid="mobile-drawer-backdrop"
          className="ade-backdrop"
          style={{ zIndex: 34 }}
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Khối điều hướng trái: nội tuyến trên Desktop/Tablet, ngăn kéo trượt trên Mobile (< 768px) */}
      <div
        data-testid="mobile-left-drawer"
        className={mobileSidebarOpen ? "ade-left-drawer is-open" : "ade-left-drawer"}
      >
        {/* Cột 1: Thanh Dự án (64px) */}
        <aside className="ade-rail" aria-label="Danh sách dự án">
          <div className="ade-rail-list">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                data-testid={`project-rail-item-${p.id}`}
                title={p.name}
                className={
                  p.id === activeProject.id ? "ade-rail-item is-active" : "ade-rail-item"
                }
                onClick={() => {
                  setMobileSidebarOpen(false);
                  navigate(`/projects/${p.id}/channels/_`);
                }}
              >
                {projectInitials(p.name)}
              </button>
            ))}
            <button
              type="button"
              data-testid="add-project-btn"
              aria-label="Thêm dự án"
              className="ade-rail-item"
              disabled
              title="Wizard tạo dự án mở ở Phase P5"
            >
              +
            </button>
          </div>

          <div className="ade-rail-footer">
            <button
              type="button"
              data-testid="theme-toggle-btn"
              className="ade-rail-item"
              aria-label="Đổi chế độ Sáng / Tối / Hệ thống"
              title={`Chế độ hiện tại: ${themeMode}`}
              onClick={onCycleTheme}
            >
              {themeMode === "dark" ? "☾" : themeMode === "light" ? "☀" : "◐"}
            </button>
            <button
              type="button"
              data-testid="project-settings-btn"
              className="ade-rail-item"
              aria-label="Cài đặt dự án"
              disabled
              title="Cài đặt dự án mở ở Phase P5"
            >
              ⚙
            </button>
          </div>
        </aside>

        {/* Cột 2: Kênh & Đội ngũ */}
        <nav
          data-testid="channel-sidebar"
          aria-label="Kênh và thành viên"
          className="ade-sidebar"
        >
          <div className="ade-sidebar-head">
            <h1 data-testid="active-project-name" className="ade-sidebar-title">
              {activeProject.name}
            </h1>
            <div className="ade-mode-group">
              <span
                data-testid="ws-status-pill"
                className={
                  realtime.connected
                    ? "ade-chip ade-chip--ok"
                    : "ade-chip ade-chip--warn"
                }
              >
                {realtime.connected ? "Trực tuyến" : "Mất kết nối"}
              </span>
              <button
                type="button"
                data-testid="mobile-drawer-close-btn"
                className="ade-btn ade-btn--icon ade-icon-btn ade-mobile-only"
                aria-label="Đóng"
                onClick={() => setMobileSidebarOpen(false)}
              >
                ×
              </button>
            </div>
          </div>

          <div className="ade-sidebar-section">
            <div className="ade-sidebar-section-head">
              <span>Kênh</span>
              <button
                type="button"
                data-testid="create-channel-btn"
                className="ade-btn ade-btn--icon ade-icon-btn"
                aria-label="Tạo kênh mới"
                onClick={() => setCreateModalOpen(true)}
              >
                +
              </button>
            </div>
            {channels.map((ch) => (
              <button
                key={ch.id}
                type="button"
                data-testid={`channel-item-${ch.id}`}
                className={
                  ch.id === activeChannel?.id ? "ade-nav-row is-active" : "ade-nav-row"
                }
                onClick={() => {
                  setMobileSidebarOpen(false);
                  navigate(`/projects/${activeProject.id}/channels/${ch.id}`);
                }}
              >
                <span># {ch.name}</span>
              </button>
            ))}
          </div>

          <div className="ade-sidebar-section">
            <div className="ade-sidebar-section-head">
              <span>Đồng nghiệp</span>
            </div>
            {colleagues.map((col) => (
              <div
                key={col.id}
                data-testid={`colleague-item-${col.id}`}
                className="ade-nav-row"
              >
                <span className="ade-presence-dot" />
                <span>
                  {col.name} ({col.handle})
                </span>
              </div>
            ))}
          </div>

          <div className="ade-sidebar-section">
            <div className="ade-sidebar-section-head">
              <span>Bot / Agent</span>
            </div>
            {agents.map((ag) => (
              <div
                key={ag.id}
                data-testid={`agent-sidebar-item-${ag.handle.slice(1)}`}
                className={
                  ag.enabled
                    ? "ade-nav-row"
                    : "ade-nav-row ade-agent-row--disabled"
                }
              >
                <span>{ag.handle}</span>
                {!ag.enabled && <span className="ade-chip">Tắt</span>}
              </div>
            ))}
          </div>
        </nav>
      </div>

      {/* Cột 3: Khung trò chuyện Kênh */}
      <main className="ade-channel-col">
        {activeChannel && (
          <header className="ade-channel-topbar">
            <div className="ade-channel-topbar-left">
              <button
                type="button"
                data-testid="mobile-sidebar-btn"
                className="ade-btn ade-btn--icon ade-icon-btn ade-mobile-only"
                aria-label="Mở danh sách dự án và kênh"
                onClick={() => setMobileSidebarOpen(true)}
              >
                ☰
              </button>
              <div className="ade-channel-heading">
                <h2 data-testid="channel-header-name" className="ade-channel-name">
                  # {activeChannel.name}
                </h2>
                {activeChannel.description.length > 0 && (
                  <p data-testid="channel-header-desc" className="ade-channel-desc">
                    {activeChannel.description}
                  </p>
                )}
              </div>
            </div>

            <div className="ade-mode-group">
              <button
                type="button"
                data-testid="channel-members-pill"
                className="ade-btn"
                onClick={() => setSettingsModalTab("members")}
              >
                Thành viên · {activeChannel.members.length}
              </button>
              <button
                type="button"
                data-testid="channel-settings-btn"
                className="ade-btn ade-btn--icon"
                aria-label="Cài đặt kênh"
                onClick={() => setSettingsModalTab("general")}
              >
                ⚙
              </button>
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

        <div data-testid="thread-list" className="ade-feed">
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
            (threadsQuery.data ?? []).map((thr) =>
              renderMessageCard(thr.rootMessage, {
                threadId: thr.id,
                inThreadPanel: false,
                replyCount: thr.replyCount
              })
            )
          )}
        </div>

        {activeChannel && (
          <MentionComposer
            inputTestId="channel-composer-input"
            sendBtnTestId="channel-send-btn"
            resizerTestId="channel-composer-resizer"
            resizerAriaLabel="Kéo đổi chiều cao khung nhập kênh"
            heightToggleTestId="channel-height-toggle-btn"
            placeholder={`Nhắn tin vào #${activeChannel.name} — nhấn @ để gọi đồng nghiệp hay agent`}
            sendLabel="Gửi"
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
                if (res.systemMessage) {
                  navigate(
                    `/projects/${activeProject.id}/channels/${activeChannel.id}/threads/${res.thread.id}`
                  );
                }
                return true;
              } catch (err) {
                if (err instanceof ChatApiError) {
                  pushToast(translateApiError(err.code));
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
            className="ade-thread-backdrop"
            onClick={() =>
              navigate(`/projects/${activeProject.id}/channels/${activeChannel.id}`)
            }
          />
          <div
            role="separator"
            tabIndex={0}
            aria-orientation="vertical"
            aria-label="Kéo đổi độ rộng ngăn Thread"
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

          <section
            data-testid="thread-panel"
            aria-label="Ngăn phản hồi Thread"
            className="ade-thread-panel"
            style={{ width: `${threadWidth}px` }}
          >
            <header data-testid="thread-panel-topbar" className="ade-thread-topbar">
              <div className="ade-mode-group">
                <strong>Thread</strong>
                <span data-testid="thread-panel-channel" className="ade-chip">
                  #{activeChannel.name}
                </span>
                <span data-testid="thread-panel-reply-count" className="ade-chip">
                  {replyPanelMsgs.filter((m) => m.kind !== "system").length} phản hồi
                </span>
              </div>

              <div className="ade-mode-group">
                <button
                  type="button"
                  data-testid="thread-width-toggle-btn"
                  className="ade-btn ade-btn--icon ade-icon-btn"
                  aria-label="Đổi độ rộng ngăn Thread"
                  onClick={() => persistThreadWidth(threadWidth < 560 ? 640 : 448)}
                >
                  ⇔
                </button>
                <button
                  type="button"
                  data-testid="thread-close-btn"
                  className="ade-btn ade-btn--icon ade-icon-btn"
                  aria-label="Đóng ngăn Thread"
                  onClick={() =>
                    navigate(`/projects/${activeProject.id}/channels/${activeChannel.id}`)
                  }
                >
                  ×
                </button>
              </div>
            </header>

            <div data-testid="message-list" className="ade-feed">
              {rootPanelMsg &&
                renderMessageCard(rootPanelMsg, {
                  threadId: activeThreadId,
                  inThreadPanel: true
                })}
              <div className="ade-thread-divider">
                <span>
                  {replyPanelMsgs.filter((m) => m.kind !== "system").length} phản hồi
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
                  return true;
                } catch (err) {
                  if (err instanceof ChatApiError) {
                    pushToast(translateApiError(err.code));
                  }
                  return false;
                }
              }}
            />
          </section>
        </>
      )}

      {/* Modals */}
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
