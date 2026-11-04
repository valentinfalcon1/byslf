import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = {
  variant?: "primary" | "secondary";
  /** Color del fondo donde vive el botón; el anillo del primario lo usa para "recortar" el contorno doble. */
  ringOn?: "ink" | "night" | "paper" | "surface";
  href?: string;
  className?: string;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

const ring = {
  ink: "[--ring:var(--color-ink)]",
  night: "[--ring:var(--color-night)]",
  paper: "[--ring:var(--color-paper)]",
  surface: "[--ring:var(--color-surface)]",
};

export function Button({ variant = "primary", ringOn = "ink", href, className = "", children, ...rest }: Props) {
  const cls = `btn ${variant === "primary" ? `btn-primary ${ring[ringOn]}` : "btn-secondary"} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls} onClick={rest.onClick as React.MouseEventHandler<HTMLAnchorElement> | undefined}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
