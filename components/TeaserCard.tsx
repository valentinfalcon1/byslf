"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { countdownText, daysUntil } from "@/lib/countdown";
import { CloseIcon } from "./icons";
import { Stars } from "./Stars";
import { Tag } from "./Tag";

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Tarjeta "bloqueada" del drop. La foto se intuye pero no se ve: es una versión diminuta y borrosa (el efecto NO la revela).
 *  - Con mouse: se inclina en 3D y un brillo sigue al cursor.
 *  - Al tocarla (o Enter/Espacio) se da vuelta y muestra la fecha, cuántos días faltan y un botón para anotarse.
 * Todo el movimiento se apaga con "reducir movimiento" del sistema.
 */
export function TeaserCard({
  image,
  index,
  dropDate,
  open,
  onToggle,
}: {
  image: string;
  index: number;
  dropDate: string | null;
  open: boolean;
  onToggle: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const frontBtn = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const raf = useRef(0);
  const firstRender = useRef(true);
  const [days, setDays] = useState<number | null>(null);

  // Los días se calculan en el navegador: si no, el número quedaría fijo desde que se publicó el sitio.
  useEffect(() => setDays(daysUntil(dropDate)), [dropDate]);

  // Manejo del foco: al abrir va al botón de cerrar; al cerrar vuelve a la card (salvo que el foco ya esté en otra).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (open) closeBtn.current?.focus({ preventScroll: true });
    else {
      const a = document.activeElement;
      if (!a || a === document.body || wrap.current?.contains(a)) frontBtn.current?.focus({ preventScroll: true });
    }
  }, [open]);

  function reset() {
    cancelAnimationFrame(raf.current);
    const el = wrap.current;
    if (!el) return;
    for (const v of ["--rx", "--ry", "--mx", "--my"]) el.style.removeProperty(v);
  }

  function onMove(e: PointerEvent) {
    if (e.pointerType !== "mouse" || open || reducedMotion()) return;
    const el = wrap.current;
    if (!el) return;
    const { clientX, clientY } = e;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const x = (clientX - r.left) / r.width;
      const y = (clientY - r.top) / r.height;
      el.style.setProperty("--rx", `${(0.5 - y) * 14}deg`);
      el.style.setProperty("--ry", `${(x - 0.5) * 14}deg`);
      el.style.setProperty("--mx", `${x * 100}%`);
      el.style.setProperty("--my", `${y * 100}%`);
    });
  }

  return (
    <article>
      <div ref={wrap} className="tilt" onPointerMove={onMove} onPointerLeave={reset}>
        <div className="tilt-inner">
          <div className={`card3d ${open ? "is-flipped" : ""}`}>
            {/* Frente */}
            <div className="face front relative aspect-square overflow-hidden rounded-card border border-line bg-surface">
              <Image
                src={image}
                alt=""
                fill
                sizes="(min-width: 1024px) 280px, 50vw"
                className="scale-110 object-cover blur-xl brightness-[0.45] grayscale"
              />
              <span aria-hidden="true" className="sheen" style={{ "--d": `${index * 0.9}s` } as CSSProperties} />
              <span aria-hidden="true" className="scanline" />
              <span aria-hidden="true" className="glare absolute inset-0" />
              <Tag className="absolute left-3 top-3">Drop 001</Tag>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
                <span aria-hidden="true" className="q-mark display text-6xl text-paper/90 md:text-7xl">?</span>
                <Stars twinkle className="label text-star" />
              </div>
              <button
                ref={frontBtn}
                type="button"
                aria-expanded={open}
                aria-label={`Producto misterioso ${index + 1} del Drop 001. Tocá para ver cuándo sale.`}
                tabIndex={open ? -1 : 0}
                onClick={onToggle}
                className="absolute inset-0 cursor-pointer rounded-card"
              />
            </div>

            {/* Dorso: fecha y botón para anotarse. Inalcanzable (inert) mientras está cerrado. */}
            <div
              inert={!open}
              aria-hidden={!open}
              className="face face-back flex flex-col items-center justify-center gap-2.5 overflow-hidden rounded-card border border-slate bg-night p-4 text-center"
              onClick={(e) => e.target === e.currentTarget && onToggle()}
            >
              <button
                ref={closeBtn}
                type="button"
                onClick={onToggle}
                aria-label="Cerrar"
                className="absolute right-1.5 top-1.5 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-text transition-colors hover:text-paper"
              >
                <CloseIcon width={16} height={16} />
              </button>
              <p className="label mt-2 text-[11px] text-slate-text">Sale el</p>
              <p className="display text-[clamp(1.9rem,6vw,3rem)] text-paper">{dropDate ?? "???"}</p>
              <p className="label text-[11px] text-slate-text" aria-live="polite">{countdownText(days)}</p>
              <a
                href="#newsletter"
                onClick={(e) => {
                  // El scroll se hace a mano: al cerrar la card este mismo link pasa a `inert` en pleno clic y Chrome
                  // a veces descarta la navegación al ancla. El href queda para quien abre el link sin JavaScript.
                  e.preventDefault();
                  onToggle();
                  document.getElementById("newsletter")?.scrollIntoView?.({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
                }}
                className="label mt-1 inline-flex items-center justify-center whitespace-nowrap rounded-btn bg-paper px-3 py-2.5 text-[10px] font-bold tracking-[0.08em] text-ink transition-transform hover:-translate-y-px md:px-4 md:text-[11px] md:tracking-label"
              >
                Quiero el aviso
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-1">
        <h3 className="label font-bold text-paper">??? 0{index + 1}</h3>
        <p className="label text-star">Próximamente</p>
        <p className="label font-bold text-paper">$ ???</p>
      </div>
    </article>
  );
}
