const SLOGANS = [
  "CREATE MORE",
  "SAME ENERGY DIFFERENT DAY.",
  "GRACIAS POR SER PARTE",
  "EST. 2026 — CÓRDOBA / ARG",
];

/** Cinta tipo sticker: franja `paper` rotada -1.6°, slogans en loop. Se frena con prefers-reduced-motion. */
export function Marquee({ className = "" }: { className?: string }) {
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {SLOGANS.map((s) => (
        <li key={s} className="flex items-center whitespace-nowrap">
          <span className="display px-6 text-[22px] md:text-[32px]">{s}</span>
          <span aria-hidden="true" className="text-[18px]">★★★</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={`overflow-hidden py-6 ${className}`}>
      <div className="-mx-4 -rotate-[1.6deg] bg-paper py-3 text-ink">
        <div className="marquee-track flex w-max">
          {row(false)}
          {row(true)}
        </div>
      </div>
    </div>
  );
}
