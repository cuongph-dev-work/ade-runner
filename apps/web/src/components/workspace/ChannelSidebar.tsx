import React from "react";
import type {
  Channel,
  ColleagueSummary,
  ProjectSummary,
  RunSummary
} from "@ade/shared";
import { Icon, IconButton, Avatar, NotificationBadge } from "../ui/index.js";
import { isAgentRunning } from "../cards/run-presence.js";

function projectInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AD";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function getAgentInitials(handleOrName: string): string {
  const map: Record<string, string> = {
    "@lead": "LD",
    "@explorer": "EX",
    "@planner": "PL",
    "@spec": "SP",
    "@coder": "CD",
    "@tester": "TS",
    "@reviewer": "RV",
    "@cuong": "CP",
    "@minh": "MT",
    "@lan-anh": "LA"
  };
  if (map[handleOrName]) return map[handleOrName];
  return String(handleOrName || "AG").replace(/^@/, "").slice(0, 2).toUpperCase();
}

export interface ChannelSidebarProps {
  activeProject: ProjectSummary;
  activeChannel: Channel | null;
  channels: Channel[];
  colleagues: ColleagueSummary[];
  agents: Array<{
    id: string;
    handle: string;
    displayName: string;
    enabled: boolean;
    harness?: string;
  }>;
  projectRuns: RunSummary[];
  realtimeConnected: boolean;
  channelMentions?: Record<string, number>;
  channelHasPendingGate?: Record<string, boolean>;
  onSelectChannel: (channelId: string) => void;
  onCreateChannel: () => void;
  onOpenProjectSettings: () => void;
  onCloseMobileDrawer: () => void;
}

export const ChannelSidebar: React.FC<ChannelSidebarProps> = ({
  activeProject,
  activeChannel,
  channels,
  colleagues,
  agents,
  projectRuns,
  realtimeConnected,
  channelMentions = {},
  channelHasPendingGate = {},
  onSelectChannel,
  onCreateChannel,
  onOpenProjectSettings,
  onCloseMobileDrawer
}) => {
  return (
    <aside
      data-testid="channel-sidebar"
      aria-label="Kênh và thành viên"
      className="ade-channel-sidebar ade-sidebar"
    >
      <div className="space-y-4">
        {/* Header: Project Name & Online Status */}
        <div
          className="pb-2.5 flex items-center justify-between gap-2"
          style={{ borderBottom: "var(--rule-hair) solid var(--color-rule)" }}
        >
          <div className="min-w-0">
            <h1 data-testid="active-project-name" className="ade-head text-sm font-semibold truncate">
              {activeProject.name}
            </h1>
            <div className="text-xs ade-muted truncate">
              <span>Cuong-MBP · </span>
              <span data-testid="ws-status-pill">{realtimeConnected ? "online" : "offline"}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <IconButton
              data-testid="sidebar-project-settings-btn"
              variant="outlined"
              size={28}
              aria-label="Cài đặt dự án"
              title="Cài đặt dự án (.ade/)"
              onClick={onOpenProjectSettings}
            >
              <Icon name="settings" size={16} />
            </IconButton>
            <IconButton
              data-testid="mobile-drawer-close-btn"
              variant="ghost"
              size={28}
              className="ade-mobile-only"
              aria-label="Đóng"
              onClick={onCloseMobileDrawer}
            >
              <Icon name="close" size={16} />
            </IconButton>
          </div>
        </div>

        {/* Section Kênh chat */}
        <div>
          <div className="flex items-center justify-between mb-1 px-1">
            <span className="text-xs font-medium ade-muted">Kênh chat</span>
            <IconButton
              data-testid="create-channel-btn"
              variant="ghost"
              size={28}
              aria-label="Tạo kênh chat mới"
              title="Tạo kênh mới"
              onClick={onCreateChannel}
            >
              <Icon name="plus" size={14} />
            </IconButton>
          </div>
          <nav id="channel-list" data-testid="channel-list" className="space-y-0.5" aria-label="Danh sách kênh">
            {channels.map((ch) => {
              const mentionCount = channelMentions[ch.id] || 0;
              const hasGate = channelHasPendingGate[ch.id];
              const isActive = ch.id === activeChannel?.id;
              return (
                <button
                  key={ch.id}
                  type="button"
                  data-testid={`channel-item-${ch.id}`}
                  className={isActive ? "ade-nav-row is-active" : "ade-nav-row"}
                  onClick={() => onSelectChannel(ch.id)}
                >
                  <span className="truncate flex items-center gap-1">
                    <span className="ade-mono ade-muted text-xs">#</span>
                    <span className={isActive ? "font-semibold" : ""}>{ch.name}</span>
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {hasGate && (
                      <NotificationBadge
                        type="gate"
                        data-testid={`channel-gate-badge-${ch.id}`}
                      >
                        Chờ duyệt
                      </NotificationBadge>
                    )}
                    {mentionCount > 0 && (
                      <NotificationBadge
                        type="mention"
                        count={mentionCount}
                        data-testid={`channel-mention-badge-${ch.id}`}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Section Đồng nghiệp */}
        <div className="pt-3" style={{ borderTop: "var(--rule-hair) solid var(--color-rule)" }}>
          <div className="flex items-center justify-between mb-1 px-1">
            <span className="text-xs font-medium ade-muted">Đồng nghiệp</span>
            <span className="ade-mono text-xs ade-muted">{colleagues.length} online</span>
          </div>
          <div id="sidebar-human-list" className="space-y-0.5 mb-3">
            {colleagues.map((col) => {
              const isOwner =
                col.role?.toLowerCase() === "owner" ||
                col.handle === "@owner" ||
                col.handle === "@cuong";
              const formattedRole = col.role
                ? col.role.charAt(0).toUpperCase() + col.role.slice(1).toLowerCase()
                : "Member";
              return (
                <div
                  key={col.id}
                  data-testid={`colleague-item-${col.id}`}
                  className="ade-nav-row"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar
                      tone={isOwner ? "human" : "peer"}
                      presence="online"
                      size={22}
                    >
                      {projectInitials(col.name)}
                    </Avatar>
                    <span className="truncate text-xs">{col.name}</span>
                  </div>
                  <span className="ade-muted flex-shrink-0" style={{ fontSize: "0.7rem" }}>
                    {formattedRole}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Section Agents (.ade/) */}
          <div className="flex items-center justify-between mb-1 px-1">
            <span className="text-xs font-medium ade-muted">Agents (.ade/)</span>
            <span id="sidebar-agent-count" className="ade-mono text-xs ade-muted">
              {agents.filter((a) => a.enabled).length}/{agents.length}
            </span>
          </div>
          <div id="sidebar-agent-list" className="space-y-0.5">
            {agents.map((ag) => {
              const handleClean = ag.handle.startsWith("@") ? ag.handle.slice(1) : ag.handle;
              const running = isAgentRunning(projectRuns, ag.handle);
              const isLead = ag.handle === "@lead";
              const ini = getAgentInitials(ag.handle);
              const presence = !ag.enabled
                ? null
                : running
                  ? "running"
                  : isLead
                    ? "busy"
                    : "online";
              const harnessDisplay =
                ag.harness === "codex"
                  ? "codex"
                  : ag.harness === "claude-code" || ag.harness === "claude"
                    ? "claude"
                    : ag.handle === "@coder" || ag.handle === "@tester"
                      ? "codex"
                      : "claude";

              return (
                <div
                  key={ag.id}
                  data-testid={`agent-sidebar-item-${handleClean}`}
                  className={
                    ag.enabled
                      ? "ade-nav-row"
                      : "ade-nav-row ade-agent-row--disabled"
                  }
                  style={ag.enabled ? undefined : { opacity: 0.5 }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar
                      tone={isLead ? "lead" : "agent"}
                      presence={presence}
                      size={22}
                    >
                      {ini}
                    </Avatar>
                    <span className="ade-mono truncate text-xs">{ag.handle}</span>
                  </div>
                  {!ag.enabled ? (
                    <span className="ade-mono ade-muted flex-shrink-0" style={{ fontSize: "0.7rem" }}>
                      tắt
                    </span>
                  ) : (
                    <span className="ade-mono ade-muted flex-shrink-0" style={{ fontSize: "0.7rem" }}>
                      {harnessDisplay}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pt-2.5 mt-3 text-xs ade-muted" style={{ borderTop: "var(--rule-hair) solid var(--color-rule)" }}>
        <div className="ade-mono truncate" style={{ fontSize: "0.7rem" }}>
          /projects/{activeProject.id}/channels/{activeChannel?.id ?? "_"}
        </div>
      </div>
    </aside>
  );
};
