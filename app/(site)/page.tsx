import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Button } from "@/components/Button";
import { DropDate } from "@/components/DropDate";
import { GlobeIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { Marquee } from "@/components/Marquee";
import { Newsletter } from "@/components/Newsletter";
import { ProductCard } from "@/components/ProductCard";
import { Reveal } from "@/components/Reveal";
import { Spotlight } from "@/components/Spotlight";
import { TeaserGrid } from "@/components/TeaserGrid";
import { getProducts } from "@/data/products";
import { DROP_DATE, LAUNCHED, SOCIAL } from "@/lib/site";

const LOOK = [
  { src: "hoodie", alt: "Buzo negro con el logo BYSLF en la espalda", span: "row-span-2" },
  { src: "wall", alt: "Logo BYSLF negro sobre una pared de cemento", span: "" },
  { src: "pants", alt: "Pantalón cargo negro con el monograma BY", span: "row-span-2" },
  { src: "poster", alt: "Afiche de BYSLF pegado en la calle junto a fotos de skate", span: "" },
  { src: "night", alt: "Buzo negro de noche con el logo en la espalda", span: "" },
  { src: "stickers", alt: "Stickers del logo, el monograma BY y las tres estrellas", span: "" },
];

/** Retraso de la animación de entrada (CSS puro, funciona sin JavaScript). */
const delay = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;

export default async function Home() {
  const latest = (await getProducts()).slice(0, 3);

  return (
    <>
      {/* Hero */}
      <Spotlight className="relative overflow-hidden">
        <div className="hero-glow" aria-hidden="true" />
        <div className="container-x relative flex flex-col items-center pb-10 pt-14 text-center md:pt-20">
          <p className="rise label font-bold text-star" style={delay(0.05)}>
            <span aria-hidden="true">●</span> Drop 001 — {LAUNCHED ? "Disponible ahora" : "Próximamente"}
          </p>
          <div className="pop mt-4 w-full max-w-[560px]" style={delay(0.2)}>
            <Logo variant="primary" priority className="floaty w-full" />
          </div>
          <h1 className="rise display mt-6 text-4xl sm:text-6xl md:mt-10 md:text-7xl" style={delay(0.55)}>Create more</h1>
          <div className="rise mt-8 flex flex-wrap justify-center gap-6" style={delay(0.7)}>
            {LAUNCHED ? <Button href="/tienda" className="pulse">Ver el drop</Button> : <Button href="#newsletter" className="pulse">Quiero el aviso</Button>}
            <Button href="#lookbook" variant="secondary">Lookbook</Button>
          </div>
          <div className="rise label mt-12 flex items-center gap-6 text-star" style={delay(0.85)}>
            <span>EST. 2026</span>
            <GlobeIcon aria-hidden="true" />
            <span>Córdoba / ARG</span>
          </div>
        </div>
      </Spotlight>

      <Marquee />

      {/* Lo nuevo / teaser del drop */}
      <section id="drop" className="container-x scroll-mt-24 py-16 md:py-24">
        <Reveal className="mb-10 flex items-end justify-between gap-4">
          <div>
            <h2 className="display text-5xl md:text-7xl">{LAUNCHED ? "Lo nuevo" : "Drop 001"}</h2>
            {!LAUNCHED && <DropDate dropDate={DROP_DATE} />}
          </div>
          {LAUNCHED && <Link href="/tienda" className="label font-bold underline underline-offset-4 hover:text-star">Ver todo</Link>}
        </Reveal>
        {LAUNCHED ? (
          <div className="mx-auto grid max-w-sm grid-cols-1 gap-6 sm:max-w-none sm:grid-cols-3 md:gap-8">
            {latest.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <ProductCard product={p} priority={i < 2} />
              </Reveal>
            ))}
          </div>
        ) : (
          <TeaserGrid images={latest.map((p) => `/img/teaser/${p.slug}.jpg`)} dropDate={DROP_DATE} />
        )}
      </section>

      {/* Lookbook */}
      <section id="lookbook" className="container-x py-16 md:py-24">
        <Reveal>
          <h2 className="display mb-10 text-5xl md:text-7xl">Lookbook</h2>
        </Reveal>
        <div className="grid grid-flow-dense auto-rows-[200px] grid-cols-2 gap-4 md:auto-rows-[260px] md:grid-cols-4 md:gap-6">
          {LOOK.map((l, i) => (
            <Reveal key={l.src} className={l.span} delay={i * 80}>
              <div className="group relative h-full overflow-hidden rounded-card border border-line">
                {/* En modo teaser las fotos se ven tapadas: se intuye, no se ve. */}
                <Image
                  src={`/img/look/${l.src}.jpg`}
                  alt={LAUNCHED ? l.alt : ""}
                  fill
                  sizes="(min-width: 768px) 25vw, 50vw"
                  className={
                    LAUNCHED
                      ? "object-cover transition-transform duration-700 group-hover:scale-105"
                      : "scale-110 object-cover blur-xl brightness-50 grayscale transition-all duration-700 group-hover:scale-[1.18] group-hover:brightness-[0.65]"
                  }
                />
              </div>
            </Reveal>
          ))}
          <Reveal className="col-span-2 md:col-span-4" delay={LOOK.length * 80}>
            <div className="flex flex-col items-center justify-center gap-3 rounded-card bg-paper p-6 text-center text-ink md:flex-row md:justify-between md:px-10 md:text-left">
              <p className="display text-3xl md:text-5xl">Etiquetanos con #BYSLF</p>
              <a href={SOCIAL.instagram.url} target="_blank" rel="noopener noreferrer" className="label font-bold underline underline-offset-4">@{SOCIAL.instagram.user}</a>
            </div>
          </Reveal>
        </div>
      </section>

      <Newsletter />
    </>
  );
}
