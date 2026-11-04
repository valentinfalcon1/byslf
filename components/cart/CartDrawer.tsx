"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { formatPrice } from "@/lib/format";
import { Button } from "../Button";
import { Stars } from "../Stars";
import { BagIcon, CloseIcon, MinusIcon, PlusIcon } from "../icons";
import { useCart } from "./CartProvider";

const qtyBtn = "inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-line text-paper transition-colors hover:bg-surface";

export function CartDrawer() {
  const { items, count, subtotal, isOpen, close, setQty, remove } = useCart();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, close]);

  return (
    <>
      <div
        aria-hidden="true"
        onClick={close}
        className={`fixed inset-0 z-50 bg-black/70 transition-opacity duration-300 motion-reduce:transition-none ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Carrito"
        inert={!isOpen}
        className={`fixed right-0 top-0 z-50 flex h-dvh w-full max-w-[440px] flex-col border-l border-line bg-ink transition-transform duration-300 motion-reduce:transition-none ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="display text-3xl">Tu carrito <span className="label not-italic text-star">({count})</span></h2>
          <button ref={closeRef} type="button" onClick={close} aria-label="Cerrar carrito" className="inline-flex h-11 w-11 items-center justify-center rounded-btn transition-colors hover:bg-surface">
            <CloseIcon />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
            <BagIcon width={40} height={40} className="text-star" />
            <p className="display text-3xl">Todavía no hay nada</p>
            <p className="label text-star">Sumá algo del drop y arrancamos.</p>
            <Button href="/tienda" onClick={close}>Ir a la tienda</Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
              {items.map((i) => (
                <li key={i.key} className="flex gap-4 py-5">
                  <Link href={`/producto/${i.slug}`} onClick={close} className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-card border border-line bg-surface">
                    <Image src={i.image} alt={i.name} fill sizes="96px" className="object-cover" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <p className="label font-bold">{i.name}</p>
                      <p className="label font-bold">{formatPrice(i.price)}</p>
                    </div>
                    <p className="label mt-1 text-star">{i.color} · Talle {i.size}</p>
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <div className="flex items-center gap-3">
                        <button type="button" className={qtyBtn} aria-label={`Restar uno a ${i.name}`} onClick={() => setQty(i.key, i.qty - 1)}><MinusIcon width={14} height={14} /></button>
                        <span className="label min-w-4 text-center font-bold" aria-live="polite">{i.qty}</span>
                        <button type="button" className={qtyBtn} aria-label={`Sumar uno a ${i.name}`} onClick={() => setQty(i.key, i.qty + 1)}><PlusIcon width={14} height={14} /></button>
                      </div>
                      <button type="button" onClick={() => remove(i.key)} className="label text-star underline underline-offset-4 hover:text-paper">Quitar</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="space-y-4 border-t border-line px-5 py-5">
              <div className="flex items-center justify-between">
                <span className="label text-star">Subtotal</span>
                <span className="label text-base font-bold">{formatPrice(subtotal)}</span>
              </div>
              <p className="label text-[11px] text-star">Envío gratis en Córdoba capital, retiro gratis y envío gratis en compras de más de $100.000. El resto se calcula al finalizar la compra.</p>
              <Button href="/checkout" onClick={close} className="w-full">Finalizar compra</Button>
              <p className="label text-center text-[11px] text-star"><Stars /> pagás de forma segura con Mercado Pago <Stars /></p>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
