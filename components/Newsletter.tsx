"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "./Button";
import { Reveal } from "./Reveal";

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState<{ confirm: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (inFlight.current) return; // evita doble envío con doble clic o Enter repetido
    inFlight.current = true;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website: new FormData(e.currentTarget).get("website") ?? "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No pudimos anotarte. Probá de nuevo en un rato.");
      setDone({ confirm: Boolean(data.confirm) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos anotarte. Probá de nuevo en un rato.");
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  return (
    <section id="newsletter" className="scroll-mt-24 border-y border-line bg-surface py-20">
      <Reveal className="container-x mx-auto max-w-2xl text-center">
        <h2 className="display text-5xl md:text-6xl">Enterate primero de cada drop</h2>
        <p className="mt-4 text-star">Los que se anotan se enteran antes que nadie.</p>

        {done ? (
          <p role="status" className="label mt-8 font-bold normal-case">
            {done.confirm
              ? "★★★ Casi listo: te mandamos un mail para confirmar. Revisá también Spam. ★★★"
              : "★★★ Listo, ya sos parte. ★★★"}
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-7 sm:flex-row sm:items-center sm:gap-6">
            {/* Campo trampa anti-bots: oculto para personas. */}
            <div aria-hidden="true" className="absolute -left-[9999px]">
              <label>Sitio web<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
            </div>
            <label htmlFor="newsletter-email" className="sr-only">Tu email</label>
            <input
              id="newsletter-email"
              type="email"
              required
              maxLength={120}
              autoComplete="email"
              placeholder="TU EMAIL"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "newsletter-error" : undefined}
              className="label h-14 w-full rounded-btn border border-line bg-ink px-5 text-paper placeholder:text-star focus:border-paper sm:flex-1"
            />
            <Button ringOn="surface" type="submit" disabled={sending}>{sending ? "Enviando…" : "Sumarme"}</Button>
          </form>
        )}

        {error && <p id="newsletter-error" role="alert" className="label mt-5 text-[11px] normal-case text-red-300">{error}</p>}

        {!done && (
          <p className="mt-6 text-[12px] leading-snug text-star">
            Al sumarte aceptás recibir avisos de los drops. Podés darte de baja cuando quieras.{" "}
            <Link href="/legal/privacidad" className="text-paper underline underline-offset-4">Política de privacidad</Link>.
          </p>
        )}
      </Reveal>
    </section>
  );
}
