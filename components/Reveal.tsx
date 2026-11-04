"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Hace que el contenido aparezca (sube y se aclara) cuando entra en pantalla al hacer scroll.
 * Sin JavaScript, o con "reducir movimiento" activado, el contenido se ve siempre y quieto.
 * El estado oculto se pone recién después de cargar, así que nunca queda contenido invisible si algo falla.
 */
export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    el.dataset.reveal = "hidden";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.dataset.reveal = "shown";
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    // Red de seguridad: si por algún motivo el aviso nunca llega, no dejar el contenido oculto.
    const failsafe = window.setTimeout(() => (el.dataset.reveal = "shown"), 4000);
    return () => {
      io.disconnect();
      window.clearTimeout(failsafe);
    };
  }, []);

  return (
    <div ref={ref} className={className} style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  );
}
