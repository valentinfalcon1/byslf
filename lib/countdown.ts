/**
 * Días que faltan para el drop. `dropDate` viene de lib/site.ts como "dd.mm" (ej. "15.12") o "dd.mm.aaaa".
 * Sin año se toma la próxima vez que llega esa fecha. Se cuenta por DÍAS (no por horas) a propósito:
 * no hay una hora de lanzamiento definida y no queremos inventarla.
 * El "hoy" se calcula en hora de Córdoba, para que todos vean el mismo número sin importar su zona.
 */
export function daysUntil(dropDate: string | null, now: Date = new Date()): number | null {
  if (!dropDate) return null;
  const m = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/.exec(dropDate.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const explicitYear = m[3] ? Number(m[3]) : null;

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Cordoba", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(now)
    .split("-")
    .map(Number);
  const todayUTC = Date.UTC(today[0], today[1] - 1, today[2]);

  const at = (year: number) => {
    const t = new Date(Date.UTC(year, month - 1, day));
    // Fecha imposible (31.02, 40.13…): getUTC* se corre solo y no coincide.
    return t.getUTCMonth() === month - 1 && t.getUTCDate() === day ? t.getTime() : null;
  };

  let target = at(explicitYear ?? today[0]);
  if (target === null) return null;
  if (explicitYear === null && target < todayUTC) target = at(today[0] + 1);
  if (target === null) return null;

  const days = Math.round((target - todayUTC) / 86_400_000);
  return days < 0 ? null : days; // con año explícito y ya pasada: no se muestra
}

/** Texto para mostrar. */
export function countdownText(days: number | null): string {
  if (days === null) return "Fecha a confirmar";
  if (days === 0) return "Es hoy";
  return days === 1 ? "Falta 1 día" : `Faltan ${days} días`;
}
