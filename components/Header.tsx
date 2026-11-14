"use client";

import Link from "next/link";
import { useState } from "react";
import { DROP_DATE, LAUNCHED, PREVIEW, SHOP_VISIBLE } from "@/lib/site";
import { useCart } from "./cart/CartProvider";
import { BagIcon, CloseIcon, MenuIcon, SearchIcon } from "./icons";
import { Logo } from "./Logo";

const NAV = SHOP_VISIBLE
  ? [
      { href: "/tienda", label: "Tienda" },
      { href: "/tienda?drop=001", label: "Drop 001" },
      { href: "/#lookbook", label: "Lookbook" },
    ]
  : [
      { href: "/#drop", label: "Drop 001" },
      { href: "/#lookbook", label: "Lookbook" },
    ];

const iconBtn =
  "relative inline-flex h-11 w-11 items-center justify-center rounded-btn text-paper transition-colors hover:bg-surface";

export function Header() {
  const [open, setOpen] = useState(false);
  const { count: cartCount, open: openCart } = useCart();

  return (
    <>
      {/* Barra superior: info de envío */}
      <div className="bg-paper px-4 py-2 text-center text-ink">
        <p className="label font-bold text-[11px]">
          {LAUNCHED ? (
            "Envíos a toda Argentina"
          ) : PREVIEW ? (
            <Link href="/tienda" className="hover:underline">★★★ Drop 001 — Mirá las prendas. La tienda abre el {DROP_DATE?.replace(".", "/") ?? "???"} ★★★</Link>
          ) : (
            <Link href="/#newsletter" className="hover:underline">★★★ Drop 001 — Próximamente. Anotate al aviso ★★★</Link>
          )}
        </p>
      </div>

      <header className="sticky top-0 z-40 border-b border-line bg-ink/95 backdrop-blur">
        <div className="container-x flex h-16 items-center justify-between gap-6">
          <Link href="/" aria-label="BYSLF — inicio" className="shrink-0">
            <Logo variant="wordmark" className="h-8 w-auto md:h-9" priority />
          </Link>

          <nav aria-label="Principal" className="hidden md:block">
            <ul className="flex items-center gap-8">
              {NAV.map((n) => (
                <li key={n.label}>
                  <Link href={n.href} className="label font-bold text-paper transition-colors hover:text-star">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1">
            {LAUNCHED && (
              <>
                <button type="button" className={iconBtn} aria-label="Buscar">
                  <SearchIcon />
                </button>
                <button type="button" className={iconBtn} aria-label={`Carrito, ${cartCount} productos`} onClick={openCart}>
                  <BagIcon />
                  <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-paper px-1 font-mono text-[10px] font-bold leading-none text-ink">
                    {cartCount}
                  </span>
                </button>
              </>
            )}
            <button
              type="button"
              className={`${iconBtn} md:hidden`}
              aria-label={open ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={open}
              aria-controls="menu-mobile"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {open && (
          <nav id="menu-mobile" aria-label="Principal" className="border-t border-line bg-ink md:hidden">
            <ul className="container-x py-4">
              {NAV.map((n) => (
                <li key={n.label} className="border-b border-line last:border-0">
                  <Link href={n.href} onClick={() => setOpen(false)} className="display block py-4 text-3xl">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>
    </>
  );
}
