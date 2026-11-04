"use client";

import { useEffect, useState } from "react";
import { countdownText, daysUntil } from "@/lib/countdown";

/** "Fecha: 15.12 · Faltan N días". Los días se calculan en el navegador (si no, el número quedaría fijo desde que se publicó). */
export function DropDate({ dropDate }: { dropDate: string | null }) {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => setDays(daysUntil(dropDate)), [dropDate]);

  return (
    <p className="label mt-3 text-star">
      Fecha: {dropDate ?? "???"} · {days === null ? "Todavía no. Pronto." : `${countdownText(days)}.`}
    </p>
  );
}
