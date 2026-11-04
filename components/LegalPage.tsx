import type { ReactNode } from "react";
import { BUSINESS } from "@/lib/legal";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="container-x max-w-3xl py-14 md:py-20">
      <h1 className="display text-[clamp(1.9rem,8.6vw,3.75rem)]">{title}</h1>
      <p className="label mt-4 text-star">Última actualización: {BUSINESS.updated}</p>
      <div className="mt-10 space-y-10">{children}</div>
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="display mb-4 text-2xl md:text-3xl">{title}</h2>
      <div className="space-y-3 text-star [&_a]:text-paper [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-paper">{children}</div>
    </section>
  );
}
