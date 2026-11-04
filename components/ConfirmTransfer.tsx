"use client";

import { useRef, useState } from "react";
import { Button } from "./Button";

/** Botón de la página de confirmación: solo al tocarlo se confirma (abrir el link no hace nada, por los antivirus/previsualizadores). */
export function ConfirmTransfer({ orderId, token, alreadyPaid }: { orderId: string; token: string; alreadyPaid: boolean }) {
  const [state, setState] = useState<"idle" | "sending" | "paid" | "out_of_stock" | "invalid" | "error">(alreadyPaid ? "paid" : "idle");
  const inFlight = useRef(false);

  async function run() {
    if (inFlight.current) return;
    inFlight.current = true;
    setState("sending");
    try {
      const res = await fetch("/api/admin/confirm-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, token }),
      });
      const data = await res.json().catch(() => ({}));
      setState(res.ok ? "paid" : data.status === "out_of_stock" ? "out_of_stock" : res.status === 403 ? "invalid" : "error");
    } catch {
      setState("error");
    } finally {
      inFlight.current = false;
    }
  }

  if (state === "paid") return <p role="status" className="mt-8 font-bold">Pago confirmado. El stock queda descontado. Ya podés preparar el pedido.</p>;
  return (
    <>
      {state === "out_of_stock" && (
        <p role="alert" className="mt-6 text-red-300">La reserva había vencido y ya no queda stock. Devolvele la plata al comprador.</p>
      )}
      {state === "invalid" && <p role="alert" className="mt-6 text-red-300">Este link no es válido.</p>}
      {state === "error" && <p role="alert" className="mt-6 text-red-300">No pudimos confirmar. Probá de nuevo.</p>}
      <Button className="mt-8" onClick={run} disabled={state === "sending" || state === "out_of_stock"}>
        {state === "sending" ? "Confirmando…" : "Confirmar que llegó la plata"}
      </Button>
    </>
  );
}
