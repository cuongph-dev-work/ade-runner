import type { HTMLAttributes, JSX, ReactNode } from "react";

export type ChipType = "default" | "human" | "agent" | "ok" | "danger";

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  type?: ChipType;
  chipType?: ChipType; // alias matching Figma 'Type' prop
  children: ReactNode;
}

export function Chip({
  type = "default",
  chipType,
  className = "",
  children,
  ...props
}: ChipProps): JSX.Element {
  const effectiveType = chipType || type;
  const typeClass =
    effectiveType === "human"
      ? "ade-chip--human"
      : effectiveType === "agent"
        ? "ade-chip--agent"
        : effectiveType === "ok"
          ? "ade-chip--ok"
          : effectiveType === "danger"
            ? "ade-chip--bad"
            : "";

  return (
    <span className={`ade-chip ${typeClass} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}
