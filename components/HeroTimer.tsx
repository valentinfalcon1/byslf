"use client";

import { useEffect, useState } from "react";
import { countdownText, daysUntil, timeLeft } from "@/lib/countdown";

const two = (n: number) => String(n).padStart(2, "0");

/**
 * Temporizador hasta el drop (días, horas, minutos y segundos), para la portada con la tienda cerrada.
 * Se calcula en el navegador: en el servidor se muestran guiones, así el número nunca queda fijo desde que se publicó.
 * Para lectores de pantalla se lee una sola frase estable ("Faltan N días"), no el conteo segundo a segundo.
 */
export function HeroTimer({ dropDate }: { dropDate: string | null }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = now ? timeLeft(dropDate, now) : null;
  const units = [
    ["Días", left?.days],
    ["Horas", left?.hours],
    ["Min", left?.minutes],
    ["Seg", left?.seconds],
  ] as const;

  return (
    <div className="mt-8" data-testid="hero-timer">
      <p className="sr-only">{now ? countdownText(daysUntil(dropDate, now)) : "Cuenta regresiva para el drop"}</p>
      <div aria-hidden="true" className="flex items-start justify-center gap-3 sm:gap-5">
        {units.map(([label, value], i) => (
          <div key={label} className="flex items-start gap-3 sm:gap-5">
            <div className="min-w-[3.5rem] sm:min-w-[5rem]">
              <p className="display text-4xl tabular-nums sm:text-6xl" data-unit={label}>{value === undefined ? "--" : two(value)}</p>
              <p className="label mt-1 text-[10px] text-star sm:text-[11px]">{label}</p>
            </div>
            {i < units.length - 1 && <span className="display pt-1 text-3xl text-slate sm:text-5xl">:</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
