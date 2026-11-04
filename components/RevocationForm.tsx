"use client";

import { useState, type FormEvent } from "react";
import { Button } from "./Button";

const input = "h-14 w-full rounded-btn border border-line bg-surface px-5 text-paper normal-case placeholder:text-star focus:border-paper";

export function RevocationForm() {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSending(true);
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/arrepentimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(f)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No pudimos registrar tu pedido.");
      setCode(data.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos registrar tu pedido.");
    } finally {
      setSending(false);
    }
  }

  if (code) {
    return (
      <div role="status" className="rounded-card border border-line bg-surface p-8 text-center">
        <p className="label text-star">Recibimos tu pedido de arrepentimiento</p>
        <p className="display mt-4 text-4xl md:text-5xl">{code}</p>
        <p className="mt-6 text-star">Guardá este código: es el número de identificación de tu trámite. Nos vamos a comunicar con vos para coordinar la devolución, sin costo.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Campo trampa anti-bots: oculto para personas. */}
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label>Sitio web<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div>
        <label htmlFor="name" className="label mb-2 block font-bold">Nombre y apellido</label>
        <input id="name" name="name" required autoComplete="name" className={input} />
      </div>
      <div>
        <label htmlFor="email" className="label mb-2 block font-bold">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className={input} />
      </div>
      <div>
        <label htmlFor="orderRef" className="label mb-2 block font-bold">Número de pedido <span className="font-normal text-star">(opcional)</span></label>
        <input id="orderRef" name="orderRef" className={input} />
      </div>
      <div>
        <label htmlFor="details" className="label mb-2 block font-bold">Qué compraste <span className="font-normal text-star">(opcional, si no tenés el número)</span></label>
        <textarea id="details" name="details" rows={3} className={`${input} h-auto py-4`} />
      </div>

      {error && <p role="alert" className="label text-red-300">{error}</p>}
      <Button type="submit" disabled={sending} className="w-full">{sending ? "Enviando…" : "Arrepentirme de mi compra"}</Button>
    </form>
  );
}
