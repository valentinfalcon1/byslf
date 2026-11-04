import Link from "next/link";
import { BUSINESS, CONSUMER_DEFENSE_URL } from "@/lib/legal";
import { LAUNCHED, SOCIAL } from "@/lib/site";
import { Button } from "./Button";
import { InstagramIcon } from "./icons";
import { Logo } from "./Logo";
import { Stars } from "./Stars";

const COLUMNS = [
  {
    title: "Tienda",
    links: LAUNCHED
      ? [
        { label: "Todo", href: "/tienda" },
        { label: "Remeras", href: "/tienda?cat=remeras" },
        { label: "Pantalones", href: "/tienda?cat=pantalones" },
      ]
      : [{ label: "Próximamente", href: "/#newsletter" }],
  },
  {
    title: "Ayuda",
    links: [
      { label: "Guía de talles", href: "#" },
      { label: "Envíos y cambios", href: "/legal/cambios-y-devoluciones" },
      { label: "Contacto", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Términos y condiciones", href: "/legal/terminos" },
      { label: "Política de privacidad", href: "/legal/privacidad" },
      { label: "Política de cookies", href: "/legal/cookies" },
      { label: "Cambios y devoluciones", href: "/legal/cambios-y-devoluciones" },
    ],
  },
  {
    title: "Seguinos",
    links: [
      { label: "Instagram", href: SOCIAL.instagram.url, external: true },
      { label: "TikTok", href: SOCIAL.tiktok.url, external: true },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-footer pt-16 text-paper">
      <div className="container-x grid gap-12 md:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <Logo variant="wordmark" className="h-14 w-auto" />
          <p className="label mt-6 max-w-[28ch] text-star">Create more.</p>
          <a
            href={SOCIAL.instagram.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Instagram @${SOCIAL.instagram.user}`}
            className="mt-6 inline-flex h-11 w-11 items-center justify-center rounded-btn border border-line text-paper transition-colors hover:bg-surface"
          >
            <InstagramIcon />
          </a>
          {/* Obligatorio para vender a distancia: acceso visible y directo desde el inicio, sin registro. */}
          <div className="mt-6">
            <Button href="/arrepentimiento" variant="secondary">Botón de arrepentimiento</Button>
          </div>
        </div>

        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="label mb-4 font-bold text-paper">{c.title}</h2>
            <ul className="space-y-2">
              {c.links.map((l) => (
                <li key={l.label}>
                  {"external" in l ? (
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className="label text-star transition-colors hover:text-paper">
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className="label text-star transition-colors hover:text-paper">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="container-x mt-16 border-t border-line pt-6 text-center">
        <p className="label text-[11px] text-star">
          {BUSINESS.legalName} · CUIT {BUSINESS.cuit} · {BUSINESS.address} · {BUSINESS.email}
        </p>
        <p className="label mt-2 text-[11px] text-star">
          <a href={CONSUMER_DEFENSE_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-paper">
            Defensa del Consumidor — reclamos
          </a>
        </p>
      </div>

      <div className="container-x flex flex-col items-center justify-between gap-3 py-6 sm:flex-row">
        <p className="label text-star">© BYSLF®</p>
        <Stars className="text-star" />
        <p className="label text-star">EST. 2026 — Córdoba / ARG</p>
      </div>
    </footer>
  );
}
