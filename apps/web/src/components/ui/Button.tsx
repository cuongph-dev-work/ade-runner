import type { ButtonHTMLAttributes, JSX, ReactNode } from "react";

export type ButtonType = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonType;
  btnType?: ButtonType; // alias matching Figma 'Type' prop
  size?: ButtonSize;
  children: ReactNode;
}

export function Button({
  variant,
  btnType = "secondary",
  size = "md",
  className = "",
  type = "button",
  children,
  ...props
}: ButtonProps): JSX.Element {
  const effectiveType = variant || btnType;
  const typeClass =
    effectiveType === "primary"
      ? "ade-btn--primary"
      : effectiveType === "ghost"
        ? "ade-btn--ghost"
        : effectiveType === "danger"
          ? "ade-btn--danger"
          : "ade-btn--secondary";

  const sizeClass = size === "sm" ? "ade-btn--sm" : size === "lg" ? "ade-btn--lg" : "";

  return (
    <button
      type={type}
      className={`ade-btn ${typeClass} ${sizeClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
