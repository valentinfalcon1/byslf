import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Button } from "@/components/Button";
import { DropDate } from "@/components/DropDate";
import { GlobeIcon } from "@/components/icons";
import { HeroTimer } from "@/components/HeroTimer";
import { Logo } from "@/components/Logo";
import { Marquee } from "@/components/Marquee";
import { Newsletter } from "@/components/Newsletter";
import { ProductCard } from "@/components/ProductCard";
import { Reveal } from "@/components/Reveal";
import { Spotlight } from "@/components/Spotlight";
import { TeaserGrid } from "@/components/TeaserGrid";
import { getProducts } from "@/data/products";
import { DROP_DATE, LAUNCHED } from "@/lib/site";

// El lookbook se ve siempre, también con la tienda cerrada: muestra el estilo de la marca.
const LOOK = [
  { src: "poster-subte", alt: "Afiche con el logo BYSLF repetido, en una estación de subte con bancos azules", box: "aspect-[10/7]" },
  { src: "create-more", alt: "Las palabras CREATE MORE en letras negras, desenfocadas, sobre fondo claro", box: "aspect-[5/6]" },
];

/** Retraso de la animación de entrada (CSS puro, funciona sin JavaScript). */
const delay = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;

export default async function Home() {
  const latest = (await getProducts()).slice(0, 3);

  return (
    <>
      {/* Hero */}
      <Spotlight className="relative overflow-hidden">
        {/* Foto de fondo: ya viene borrosa; se oscurece para que el logo y los textos se lean bien. */}
        <Image src="/img/hero-bg.jpg" alt="" fill priority sizes="100vw" className="object-cover opacity-[0.16] grayscale" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/50 via-transparent to-ink" aria-hidden="true" />
        <div className="hero-glow" aria-hidden="true" />
        <div className="container-x relative flex flex-col items-center pb-10 pt-14 text-center md:pt-20">
          <p className="rise label font-bold text-star" style={delay(0.05)}>
            <span aria-hidden="true">●</span> Drop 001 — {LAUNCHED ? "Disponible ahora" : "Próximamente"}
          </p>
          <div className="pop mt-4 w-full max-w-[560px]" style={delay(0.2)}>
            <Logo variant="primary" priority className="floaty w-full" />
          </div>
          {!LAUNCHED && DROP_DATE && (
            <div className="rise" style={delay(0.4)}>
              <HeroTimer dropDate={DROP_DATE} />
            </div>
          )}
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
        <div className="grid gap-4 md:grid-cols-[2fr_1fr] md:gap-6">
          {LOOK.map((l, i) => (
            <Reveal key={l.src} delay={i * 80}>
              <div className={`group relative overflow-hidden rounded-card border border-line ${l.box} md:aspect-auto md:h-[480px]`}>
                <Image
                  src={`/img/look/${l.src}.jpg`}
                  alt={l.alt}
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <Newsletter />
    </>
  );
}
