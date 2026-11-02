import type { HTMLAttributes, JSX, ReactNode } from "react";
import { Button } from "./Button.js";

export type NotificationItemType = "mention" | "approval";

export interface NotificationItemProps extends HTMLAttributes<HTMLDivElement> {
  itemType?: NotificationItemType;
  title: string;
  time: string;
  unread?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}

export function NotificationItem({
  itemType = "mention",
  title,
  time,
  unread = true,
  actionLabel,
  onAction,
  children,
  className = "",
  ...props
}: NotificationItemProps): JSX.Element {
  const isApproval = itemType === "approval";

  return (
    <div
      className={`p-3 rounded-lg border transition-colors ${
        isApproval
          ? "bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
          : "bg-surface dark:bg-surface-2 border-rule"
      } ${className}`.trim()}
      {...props}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span
          className={`text-xs font-semibold truncate ${
            isApproval ? "text-amber-900 dark:text-amber-200" : "text-ink"
          }`}
        >
          {title}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[0.68rem] text-muted font-mono">{time}</span>
          {unread && <span className="w-1.5 h-1.5 rounded-full bg-rose-600 inline-block" />}
        </div>
      </div>

      {children && <div className="text-xs text-muted mb-2 leading-relaxed">{children}</div>}

      {isApproval && actionLabel && onAction && (
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            variant="primary"
            onClick={(e) => {
              e.stopPropagation();
              onAction();
            }}
          >
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
