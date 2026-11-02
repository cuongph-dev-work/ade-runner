import type { JSX, SVGProps } from "react";

export type IconName =
  | "close"
  | "settings"
  | "plus"
  | "menu"
  | "bell"
  | "search"
  | "send"
  | "reply"
  | "collapse"
  | "expand"
  | "smile"
  | "user"
  | "bot"
  | "check"
  | "alert"
  | "at"
  | "mention";

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 20, className = "", ...props }: IconProps): JSX.Element {
  const commonProps = {
    width: size,
    height: size,
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: `ade-icon ade-icon--${name} ${className}`.trim(),
    ...props
  };

  switch (name) {
    case "close":
      return (
        <svg {...commonProps}>
          <path d="M5 5l10 10M15 5L5 15" />
        </svg>
      );

    case "settings":
      return (
        <svg {...commonProps}>
          <path d="M10 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />
          <path d="M16 10a6 6 0 0 1-.2 1.5l1.6 1.2-1.5 2.6-1.9-.8a6 6 0 0 1-1.3.8l-.3 2h-3l-.3-2a6 6 0 0 1-1.3-.8l-1.9.8-1.5-2.6 1.6-1.2A6 6 0 0 1 4 10a6 6 0 0 1 .2-1.5L2.6 7.3l1.5-2.6 1.9.8a6 6 0 0 1 1.3-.8l.3-2h3l.3 2a6 6 0 0 1 1.3.8l1.9-.8 1.5 2.6-1.6 1.2c.1.5.2 1 .2 1.5z" />
        </svg>
      );

    case "plus":
      return (
        <svg {...commonProps}>
          <path d="M10 4v12M4 10h12" />
        </svg>
      );

    case "menu":
      return (
        <svg {...commonProps}>
          <path d="M3 6h14M3 10h14M3 14h14" />
        </svg>
      );

    case "bell":
      return (
        <svg {...commonProps}>
          <path d="M14.5 7.5a4.5 4.5 0 0 0-9 0c0 5-2 6.5-2 6.5h13s-2-1.5-2-6.5z" />
          <path d="M8.5 16.5a1.8 1.8 0 0 0 3 0" />
        </svg>
      );

    case "search":
      return (
        <svg {...commonProps}>
          <circle cx="8.5" cy="8.5" r="5" />
          <path d="M12.5 12.5L16.5 16.5" />
        </svg>
      );

    case "send":
      return (
        <svg {...commonProps}>
          <path d="M17 3L8.5 11.5" />
          <path d="M17 3L11.5 17L8.5 11.5L3 8.5L17 3Z" />
        </svg>
      );

    case "reply":
      return (
        <svg {...commonProps}>
          <path d="M8 6L4 10l4 4" />
          <path d="M4 10h8a4 4 0 0 1 4 4v1" />
        </svg>
      );

    case "collapse":
      return (
        <svg {...commonProps}>
          <path d="M4 14l6-6 6 6" />
        </svg>
      );

    case "expand":
      return (
        <svg {...commonProps}>
          <path d="M4 6l6 6 6-6" />
        </svg>
      );

    case "smile":
      return (
        <svg {...commonProps}>
          <circle cx="10" cy="10" r="7" />
          <path d="M7.5 8.5h.01M12.5 8.5h.01" />
          <path d="M7 12a3 3 0 0 0 6 0" />
        </svg>
      );

    case "user":
      return (
        <svg {...commonProps}>
          <circle cx="10" cy="7" r="3.5" />
          <path d="M4.5 16.5c0-2.8 2.5-5 5.5-5s5.5 2.2 5.5 5" />
        </svg>
      );

    case "bot":
      return (
        <svg {...commonProps}>
          <rect x="4" y="6" width="12" height="10" rx="2" />
          <path d="M10 2v4M7 11h.01M13 11h.01" />
        </svg>
      );

    case "check":
      return (
        <svg {...commonProps}>
          <path d="M4 10.5l4 4 8-9" />
        </svg>
      );

    case "alert":
      return (
        <svg {...commonProps}>
          <path d="M10 3.5l7 12H3l7-12z" />
          <path d="M10 8.5v3M10 14h.01" />
        </svg>
      );

    case "at":
    case "mention":
      return (
        <svg {...commonProps}>
          <circle cx="10" cy="10" r="3.5" />
          <path d="M13.5 10v1.5a2 2 0 0 0 4 0V10a7.5 7.5 0 1 0-3 6" />
        </svg>
      );

    default:
      return (
        <svg {...commonProps}>
          <circle cx="10" cy="10" r="6" />
        </svg>
      );
  }
}
