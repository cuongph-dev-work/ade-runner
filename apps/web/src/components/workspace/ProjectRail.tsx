import React from "react";
import type { ProjectSummary } from "@ade/shared";
import { Icon, Avatar, NotificationBadge } from "../ui/index.js";

function projectInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AD";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export interface ProjectRailProps {
  projects: ProjectSummary[];
  activeProjectId: string;
  themeMode: "light" | "dark" | "system";
  unreadNotificationsCount?: number;
  notificationsOpen?: boolean;
  onCycleTheme: () => void;
  onSelectProject: (id: string) => void;
  onOpenNewProject: () => void;
  onOpenProjectSettings: () => void;
  onToggleNotifications?: () => void;
}

export const ProjectRail: React.FC<ProjectRailProps> = ({
  projects,
  activeProjectId,
  themeMode,
  unreadNotificationsCount = 0,
  notificationsOpen = false,
  onCycleTheme,
  onSelectProject,
  onOpenNewProject,
  onOpenProjectSettings,
  onToggleNotifications
}) => {
  return (
    <aside className="ade-project-rail ade-rail" aria-label="Danh sách dự án">
      <div className="flex flex-col items-center gap-2 ade-rail-list">
        {projects.map((p) => (
          <button
            key={p.id}
            type="button"
            data-testid={`project-rail-item-${p.id}`}
            title={p.name}
            className={
              p.id === activeProjectId ? "ade-rail-btn ade-rail-item is-active" : "ade-rail-btn ade-rail-item"
            }
            onClick={() => onSelectProject(p.id)}
          >
            {projectInitials(p.name)}
          </button>
        ))}
        <button
          type="button"
          data-testid="add-project-btn"
          aria-label="Tạo dự án mới"
          className="ade-rail-btn ade-rail-item"
          title="Tạo dự án mới"
          onClick={onOpenNewProject}
        >
          <Icon name="plus" size={18} />
        </button>
      </div>

      <div className="flex flex-col items-center gap-2 ade-rail-footer">
        {onToggleNotifications && (
          <div className="relative">
            <button
              type="button"
              data-testid="rail-notifications-btn"
              className={`ade-rail-btn ade-rail-item relative ${notificationsOpen ? "is-active" : ""}`}
              aria-label="Thông báo"
              title="Thông báo (@mention và cổng duyệt)"
              onClick={onToggleNotifications}
            >
              <Icon name="bell" size={18} />
            </button>
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 pointer-events-none" data-testid="rail-unread-badge">
                <NotificationBadge type="count" count={unreadNotificationsCount} />
              </span>
            )}
          </div>
        )}
        <button
          type="button"
          data-testid="theme-toggle-btn"
          className="ade-rail-btn ade-rail-item"
          aria-label="Đổi chế độ Sáng / Tối / Hệ thống"
          title={`Chế độ hiện tại: ${themeMode}`}
          onClick={onCycleTheme}
        >
          {themeMode === "dark" ? "☾" : themeMode === "light" ? "☀" : "◐"}
        </button>
        <button
          type="button"
          data-testid="project-settings-btn"
          className="ade-rail-btn ade-rail-item"
          aria-label="Cài đặt dự án"
          title="Cài đặt dự án (.ade/)"
          onClick={onOpenProjectSettings}
        >
          <Icon name="settings" size={18} />
        </button>
        <Avatar tone="human" presence="online" size={28} title="Cuong PH (Đang trực tuyến)">
          CP
        </Avatar>
      </div>
    </aside>
  );
};
