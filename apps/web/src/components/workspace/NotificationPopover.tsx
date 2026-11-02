import React, { useState } from "react";
import { Icon, IconButton, NotificationBadge, NotificationItem } from "../ui/index.js";

export interface AppNotification {
  id: string;
  type: "mention" | "approval";
  title: string;
  body: string;
  source: string;
  channelId?: string;
  threadId?: string;
  approvalId?: string;
  time: string;
  read: boolean;
}

export interface NotificationPopoverProps {
  notifications: AppNotification[];
  onSelectNotification: (item: AppNotification) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
}

export const NotificationPopover: React.FC<NotificationPopoverProps> = ({
  notifications,
  onSelectNotification,
  onMarkAllRead,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<"all" | "approval" | "mention">("all");

  const unreadCount = notifications.filter((n) => !n.read).length;
  const approvalCount = notifications.filter((n) => n.type === "approval" && !n.read).length;
  const mentionCount = notifications.filter((n) => n.type === "mention" && !n.read).length;

  const filtered = notifications.filter((n) => {
    if (activeTab === "approval") return n.type === "approval";
    if (activeTab === "mention") return n.type === "mention";
    return true;
  });

  return (
    <div
      data-testid="notification-popover"
      className="ade-panel ade-popover space-y-3 p-3.5 text-xs"
      style={{
        position: "absolute",
        left: "72px",
        bottom: "48px",
        width: "360px",
        zIndex: 50,
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)"
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between pb-2"
        style={{ borderBottom: "var(--rule-hair) solid var(--color-rule)" }}
      >
        <div className="flex items-center gap-2">
          <strong className="text-sm font-semibold">Thông báo</strong>
          {unreadCount > 0 && (
            <NotificationBadge
              type="count"
              count={unreadCount}
              data-testid="notification-unread-badge"
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              data-testid="mark-all-read-btn"
              onClick={onMarkAllRead}
              className="text-xs ade-muted hover:underline"
              style={{ fontSize: "0.7rem" }}
            >
              Đã đọc tất cả
            </button>
          )}
          <IconButton
            data-testid="close-notification-btn"
            variant="ghost"
            size={28}
            aria-label="Đóng bảng thông báo"
            onClick={onClose}
          >
            <Icon name="close" size={14} />
          </IconButton>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5" role="tablist">
        <button
          type="button"
          data-testid="tab-all-notifications"
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            activeTab === "all"
              ? "bg-[var(--color-paper-2,#f6f2ee)] text-[var(--color-ink)] border border-[var(--color-rule-2)]"
              : "text-muted-foreground hover:bg-muted/40"
          }`}
          onClick={() => setActiveTab("all")}
        >
          Tất cả ({notifications.length})
        </button>
        <button
          type="button"
          data-testid="tab-approval-notifications"
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            activeTab === "approval"
              ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-300"
              : "text-muted-foreground hover:bg-muted/40"
          }`}
          onClick={() => setActiveTab("approval")}
        >
          Chờ duyệt ({approvalCount})
        </button>
        <button
          type="button"
          data-testid="tab-mention-notifications"
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            activeTab === "mention"
              ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-300"
              : "text-muted-foreground hover:bg-muted/40"
          }`}
          onClick={() => setActiveTab("mention")}
        >
          Nhắc tên ({mentionCount})
        </button>
      </div>

      {/* List */}
      <div
        data-testid="notification-list"
        className="space-y-2 max-h-[320px] overflow-y-auto pr-0.5"
      >
        {filtered.length === 0 ? (
          <div className="text-center py-6 ade-muted text-xs">
            Không có thông báo nào.
          </div>
        ) : (
          filtered.map((item) => (
            <NotificationItem
              key={item.id}
              data-testid={`notification-item-${item.id}`}
              itemType={item.type}
              title={item.title}
              time={item.time}
              unread={!item.read}
              actionLabel={item.type === "approval" ? "Xem & Duyệt" : undefined}
              onAction={() => onSelectNotification(item)}
              onClick={() => onSelectNotification(item)}
              className="cursor-pointer"
            >
              <div className="line-clamp-2">{item.body}</div>
              <div className="mt-1 text-[0.68rem] text-muted flex items-center gap-1 font-mono">
                <span>trong</span>
                <span className="font-semibold text-ink">{item.source}</span>
              </div>
            </NotificationItem>
          ))
        )}
      </div>
    </div>
  );
};
