import type { ButtonHTMLAttributes, JSX, ReactNode } from "react";

export type IconButtonVariant = "outlined" | "ghost" | "surface";
export type IconButtonSize = 28 | 32 | "28" | "32";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  children: ReactNode;
}

export function IconButton({
  variant = "ghost",
  size = 28,
  className = "",
  type = "button",
  children,
  ...props
}: IconButtonProps): JSX.Element {
  const sizeNum = Number(size);
  const sizeClass = sizeNum === 32 ? "ade-icon-btn--lg" : "ade-icon-btn--sm";
  const variantClass =
    variant === "outlined"
      ? "ade-icon-btn--outlined"
      : variant === "surface"
        ? "ade-icon-btn--surface"
        : "ade-icon-btn--ghost";

  return (
    <button
      type={type}
      className={`ade-icon-btn ${variantClass} ${sizeClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
