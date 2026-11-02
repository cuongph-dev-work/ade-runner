import type { HTMLAttributes, JSX, ReactNode } from "react";

export type NotificationBadgeType = "count" | "dot" | "gate" | "mention";

export interface NotificationBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  type?: NotificationBadgeType;
  badgeType?: NotificationBadgeType; // alias matching Figma 'Type' prop
  count?: number;
  label?: string;
  children?: ReactNode;
}

export function NotificationBadge({
  type = "count",
  badgeType,
  count,
  label,
  className = "",
  children,
  ...props
}: NotificationBadgeProps): JSX.Element {
  const effectiveType = badgeType || type;

  if (effectiveType === "dot") {
    return (
      <span
        aria-hidden="true"
        className={`inline-block w-2 h-2 rounded-full bg-rose-600 dark:bg-rose-500 ${className}`.trim()}
        {...props}
      />
    );
  }

  if (effectiveType === "gate") {
    return (
      <span
        className={`px-1.5 py-0.5 rounded text-[0.62rem] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 ${className}`.trim()}
        {...props}
      >
        {children || label || "Chờ duyệt"}
      </span>
    );
  }

  if (effectiveType === "mention") {
    const text = children || label || (count !== undefined ? `@ ${count}` : "@");
    return (
      <span
        className={`px-1.5 py-0.5 rounded text-[0.62rem] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-200 border border-rose-300 dark:border-rose-700 font-mono ${className}`.trim()}
        {...props}
      >
        {text}
      </span>
    );
  }

  // "count"
  const displayCount = count !== undefined ? (count > 99 ? "99+" : count) : children;
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[0.65rem] font-bold bg-rose-600 text-white leading-none border border-white dark:border-zinc-900 ${className}`.trim()}
      {...props}
    >
      {displayCount}
    </span>
  );
}
