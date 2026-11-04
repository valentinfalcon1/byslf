"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal } from "./Reveal";
import { TeaserCard } from "./TeaserCard";

/** Grilla de cards del drop. Solo una puede estar dada vuelta a la vez; se cierra con Escape o tocando afuera. */
export function TeaserGrid({ images, dropDate }: { images: string[]; dropDate: string | null }) {
  const [open, setOpen] = useState<number | null>(null);
  const grid = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    const onDown = (e: Event) => {
      if (grid.current && !grid.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div ref={grid} className="mx-auto grid max-w-sm grid-cols-1 gap-6 sm:max-w-none sm:grid-cols-3 md:gap-8">
      {images.map((image, i) => (
        <Reveal key={i} delay={i * 90}>
          <TeaserCard image={image} index={i} dropDate={dropDate} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
        </Reveal>
      ))}
    </div>
  );
}
