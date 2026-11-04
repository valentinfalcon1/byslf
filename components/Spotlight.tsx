"use client";

import { useRef, type ReactNode } from "react";

/** Contenedor cuyo fondo (`.hero-glow`) tiene un brillo que sigue al mouse. En pantallas táctiles queda quieto. */
export function Spotlight({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  const raf = useRef(0);

  function onMove(e: React.PointerEvent) {
    if (e.pointerType !== "mouse" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    const { clientX, clientY } = e;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--sx", `${((clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty("--sy", `${((clientY - r.top) / r.height) * 100}%`);
    });
  }

  return (
    <section ref={ref} className={className} onPointerMove={onMove}>
      {children}
    </section>
  );
}
