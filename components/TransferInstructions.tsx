"use client";

import { useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import type { Shipping } from "@/lib/shipping";
import { INSTAGRAM_USER, TRANSFER_ACCOUNT, instagramChatUrl } from "@/lib/transfer";
import { Button } from "./Button";
import { useCart } from "./cart/CartProvider";

export type TransferOrder = { orderId: string; code: string; amount: number; expiresAt: string };

/**
 * Pantalla del pago por transferencia: datos de la cuenta, monto exacto y código para el concepto.
 * Al tocar "Ya transferí" se mandan los datos de envío al servidor (que te los manda por mail, sin guardarlos)
 * y se abre el chat de Instagram para que el cliente mande el comprobante.
 */
export function TransferInstructions({ order, shipping }: { order: TransferOrder; shipping: Shipping }) {
  const { clear } = useCart();
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const chat = instagramChatUrl();
  const until = new Date(order.expiresAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });

  async function notify() {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setState("sending");
    try {
      const res = await fetch("/api/checkout/transfer/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.orderId, shipping }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No pudimos enviar tus datos. Probá de nuevo.");
      clear(); // el pedido ya está reservado y avisado: se vacía el carrito
      setState("sent");
      // El navegador puede bloquear la ventana nueva; por eso abajo queda también el link a mano.
      if (chat) {
        try {
          window.open(chat, "_blank", "noopener,noreferrer");
        } catch {
          /* queda el link */
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos enviar tus datos. Probá de nuevo.");
      setState("idle");
    } finally {
      inFlight.current = false;
    }
  }

  const rows: [string, string][] = [
    ["Titular", TRANSFER_ACCOUNT.holder],
    ["Banco", TRANSFER_ACCOUNT.bank],
    ["CBU / CVU", TRANSFER_ACCOUNT.cbu],
    ["Alias", TRANSFER_ACCOUNT.alias],
  ];

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h2 className="display text-3xl">Pagá por transferencia</h2>
        <p className="mt-3 text-star">Reservamos tu pedido hasta el <strong className="text-paper">{until}</strong>. Pasado ese plazo, el stock se libera.</p>
      </div>

      <section aria-labelledby="t1" className="rounded-card border border-line bg-surface p-6">
        <h3 id="t1" className="label font-bold">1. Transferí exactamente {formatPrice(order.amount)}</h3>
        <dl className="label mt-4 space-y-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4"><dt className="text-star">{k}</dt><dd className="break-all text-right font-bold">{v}</dd></div>
          ))}
          <div className="flex justify-between gap-4 border-t border-line pt-2"><dt className="text-star">Concepto</dt><dd className="font-bold">{order.code}</dd></div>
        </dl>
        <p className="mt-4 text-[13px] text-star">Poné el código <strong className="text-paper">{order.code}</strong> en el concepto o la referencia, para que podamos reconocer tu pago.</p>
      </section>

      <section aria-labelledby="t2" className="rounded-card border border-line bg-surface p-6">
        <h3 id="t2" className="label font-bold">2. Mandanos el comprobante por Instagram</h3>
        <p className="mt-3 text-[13px] text-star">
          Al tocar el botón se abre nuestro chat de Instagram (<strong className="text-paper">@{INSTAGRAM_USER}</strong>) para que nos mandes la captura, y nos llegan tus datos de envío. No se guardan en el sitio.
        </p>
        {state === "sent" ? (
          <div role="status" className="mt-5 space-y-3">
            <p className="font-bold">¡Listo! Ya tenemos tus datos. Falta que nos mandes el comprobante por Instagram.</p>
            {chat ? (
              <a href={chat} target="_blank" rel="noopener noreferrer" className="label inline-block font-bold underline underline-offset-4">Abrir el chat de Instagram</a>
            ) : (
              <p className="text-star">Mandalo al Instagram @{INSTAGRAM_USER}.</p>
            )}
            <p className="text-[13px] text-star">Cuando confirmemos el pago te escribimos para coordinar el envío.</p>
          </div>
        ) : (
          <>
            {error && <p role="alert" className="label mt-4 text-red-300">{error}</p>}
            <Button className="mt-5 w-full" onClick={notify} disabled={state === "sending"}>
              {state === "sending" ? "Enviando…" : "Ya transferí, enviar comprobante"}
            </Button>
          </>
        )}
      </section>
    </div>
  );
}
