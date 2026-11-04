"use client";

import { useRef, useState } from "react";
import { Button } from "./Button";

const TEXT = {
  confirmar: {
    button: "Confirmar mi suscripción",
    done: "¡Listo! Tu suscripción está confirmada. Vas a ser de los primeros en enterarte.",
  },
  baja: {
    button: "Darme de baja",
    done: "Te diste de baja. No vas a recibir más avisos.",
  },
} as const;

/**
 * La acción se hace con un botón (POST), no con solo abrir el link: los programas que revisan los mails
 * (antivirus, antispam) abren los links solos y, si bastara con abrirlos, confirmarían o darían de baja sin querer.
 */
export function NewsletterAction({ action, token }: { action: keyof typeof TEXT; token: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "invalid" | "error">("idle");
  const inFlight = useRef(false);

  async function run() {
    if (inFlight.current) return;
    inFlight.current = true;
    setState("sending");
    try {
      const res = await fetch("/api/newsletter/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action === "confirmar" ? "confirm" : "unsubscribe", token }),
      });
      setState(res.ok ? "done" : res.status === 404 || res.status === 400 ? "invalid" : "error");
    } catch {
      setState("error");
    } finally {
      inFlight.current = false;
    }
  }

  if (state === "done") return <p role="status" className="mt-8 text-lg text-paper">{TEXT[action].done}</p>;
  if (state === "invalid") return <p role="alert" className="mt-8 text-paper">Este link no es válido o ya venció.</p>;

  return (
    <div className="mt-8">
      <Button onClick={run} disabled={state === "sending"}>{state === "sending" ? "Un momento…" : TEXT[action].button}</Button>
      {state === "error" && <p role="alert" className="label mt-4 text-red-300">No pudimos procesar tu pedido. Probá de nuevo en un rato.</p>}
    </div>
  );
}
