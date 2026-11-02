import type { HTMLAttributes, JSX, ReactNode } from "react";

export type AvatarTone = "human" | "peer" | "agent" | "lead";
export type AvatarPresence = "online" | "busy" | "running" | "offline" | null;
export type AvatarSize = 22 | 28 | 32 | 40 | "22" | "28" | "32" | "40";

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: AvatarTone;
  presence?: AvatarPresence;
  presenceTestId?: string;
  size?: AvatarSize;
  initials?: string;
  children?: ReactNode;
}

export function Avatar({
  tone = "human",
  presence = null,
  presenceTestId,
  size = 28,
  initials,
  className = "",
  children,
  ...props
}: AvatarProps): JSX.Element {
  const sizeNum = Number(size);
  const sizeClass =
    sizeNum === 22
      ? "ade-avatar--xs"
      : sizeNum === 28
        ? "ade-avatar--sm"
        : sizeNum === 32
          ? "ade-avatar--md"
          : sizeNum === 40
            ? "ade-avatar--lg"
            : "";

  const toneClass =
    tone === "lead"
      ? "ade-avatar--lead"
      : tone === "agent"
        ? "ade-avatar--agent"
        : tone === "peer"
          ? "ade-avatar--peer"
          : "ade-avatar--human";

  const presenceClass =
    presence === "online"
      ? "ade-presence--online"
      : presence === "busy"
        ? "ade-presence--busy"
        : presence === "running"
          ? "ade-presence--running"
          : "";

  return (
    <span className={`ade-avatar ${toneClass} ${sizeClass} ${className}`.trim()} {...props}>
      {children || initials}
      {(presenceClass || presenceTestId) && (
        <span
          data-testid={presenceTestId}
          className={`ade-presence ade-presence-dot ${presenceClass}`.trim()}
        />
      )}
    </span>
  );
}
