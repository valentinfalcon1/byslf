"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "./Button";

const KEY = "byslf-cookie-notice";

/**
 * Aviso informativo: hoy el sitio solo usa almacenamiento necesario (carrito), sin analítica ni publicidad.
 * Si se suma analítica / píxeles, esto tiene que pasar a ser un pedido de consentimiento ANTES de activarlos.
 */
export function CookieNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  function accept() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setShow(false);
  }

  return (
    <div role="region" aria-label="Aviso de cookies" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface">
      <div className="container-x flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="label normal-case tracking-normal text-star">
          Usamos almacenamiento local solo para recordar tu carrito. No usamos cookies de publicidad ni de seguimiento.{" "}
          <Link href="/legal/cookies" className="text-paper underline underline-offset-4">Más info</Link>
        </p>
        <Button onClick={accept} ringOn="surface" className="shrink-0 self-start sm:self-auto">Entendido</Button>
      </div>
    </div>
  );
}
