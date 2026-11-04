import type { ReactNode } from "react";

export function Tag({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-block rounded-tag bg-paper px-2 py-[3px] font-mono text-[11px] font-bold uppercase leading-none tracking-label text-ink ${className}`}
    >
      {children}
    </span>
  );
}
