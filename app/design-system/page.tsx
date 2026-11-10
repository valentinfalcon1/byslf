import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/Button";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Logo } from "@/components/Logo";
import { Marquee } from "@/components/Marquee";
import { ProductCard } from "@/components/ProductCard";
import { Stars } from "@/components/Stars";
import { Tag } from "@/components/Tag";
import { ArrowRightIcon, BagIcon, GlobeIcon, SearchIcon } from "@/components/icons";
import { products } from "@/data/products";

export const metadata: Metadata = { title: "Design system" };

const primary = [
  { token: "ink", hex: "#191919", use: "Fondo general" },
  { token: "surface", hex: "#222222", use: "Tarjetas, inputs" },
  { token: "line", hex: "#333333", use: "Bordes, divisores" },
  { token: "star", hex: "#A9A9A9", use: "Acento, texto secundario" },
  { token: "paper", hex: "#F2F2F2", use: "Texto principal, botón primario" },
  { token: "footer", hex: "#111111", use: "Footer" },
];
const secondary = [
  { token: "night", hex: "#21262A", use: "Secciones secundarias" },
  { token: "night-surface", hex: "#2A3035", use: "Tarjetas sobre night" },
  { token: "night-line", hex: "#3A4249", use: "Bordes sobre night" },
  { token: "slate", hex: "#778898", use: "Solo elementos grandes / decorativos" },
  { token: "slate-text", hex: "#9AA8B6", use: "Texto secundario sobre night" },
];

function Swatch({ token, hex, use }: { token: string; hex: string; use: string }) {
  return (
    <li className="overflow-hidden rounded-card border border-line">
      <div className="h-20" style={{ background: hex }} />
      <div className="bg-surface p-3">
        <p className="label font-bold">{token}</p>
        <p className="label text-star">{hex}</p>
        <p className="mt-1 text-[12px] leading-snug text-star">{use}</p>
      </div>
    </li>
  );
}

function Section({ title, children, night = false }: { title: string; children: React.ReactNode; night?: boolean }) {
  return (
    <section className={`py-14 ${night ? "bg-night" : ""}`}>
      <div className="container-x">
        <h2 className={`label mb-8 font-bold ${night ? "text-slate-text" : "text-star"}`}>— {title}</h2>
        {children}
      </div>
    </section>
  );
}

export default function DesignSystemPage() {
  // Página interna de diseño: no se publica en producción.
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <>
      <Header />
      <main>
        <div className="container-x py-14">
          <Tag>Design system</Tag>
          <h1 className="display mt-4 text-6xl md:text-8xl">Sistema BYSLF</h1>
        </div>

        <Section title="Logos">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="overflow-hidden rounded-img border border-line bg-ink"><Logo variant="primary" /></div>
            <div className="overflow-hidden rounded-img border border-night-line bg-night"><Logo variant="secondary" /></div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-10 rounded-img border border-line bg-surface p-8">
            <Logo variant="wordmark" className="h-14 w-auto" />
            <Logo variant="monogram" className="h-20 w-auto" />
            <Logo variant="stars" className="h-14 w-auto" />
          </div>
        </Section>

        <Section title="Paleta primaria — Negro">
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {primary.map((c) => <Swatch key={c.token} {...c} />)}
          </ul>
        </Section>

        <Section title="Paleta secundaria — Slate" night>
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {secondary.map((c) => <Swatch key={c.token} {...c} />)}
          </ul>
        </Section>

        <Section title="Tipografía">
          <div className="space-y-8">
            <div>
              <p className="label mb-2 text-star">Archivo 900 italic · títulos</p>
              <p className="display text-6xl md:text-8xl">Create more</p>
              <p className="display mt-2 text-3xl">Same energy. Different day.</p>
            </div>
            <div>
              <p className="label mb-2 text-star">Space Mono 400 / 700 · texto, nav, precios, etiquetas</p>
              <p className="max-w-prose">
                Cuerpo de texto a 14–15px con line-height 1.7. Las prendas están pensadas para el día a día, para los
                que son parte desde el primer día.
              </p>
              <p className="label mt-4 font-bold">Label · tracking amplio · [PRECIO]</p>
            </div>
          </div>
        </Section>

        <Section title="Botones y etiquetas">
          <div className="flex flex-wrap items-center gap-8">
            <Button>Ver el drop</Button>
            <Button variant="secondary">Lookbook</Button>
            <Button disabled>Agotado</Button>
            <Button>Agregar al carrito <ArrowRightIcon width={16} height={16} /></Button>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Tag>Nuevo</Tag>
            <Tag>Drop 001</Tag>
            <Stars className="text-star" />
          </div>
          <div className="mt-8 rounded-img bg-night p-8">
            <p className="label mb-6 text-slate-text">Sobre night (el anillo toma el color del fondo)</p>
            <div className="flex flex-wrap gap-8">
              <Button ringOn="night">Conocenos</Button>
              <Button variant="secondary">Secundario</Button>
            </div>
          </div>
        </Section>

        <Section title="Íconos (línea, stroke 2)">
          <div className="flex gap-6 text-paper">
            <SearchIcon width={28} height={28} />
            <BagIcon width={28} height={28} />
            <GlobeIcon width={28} height={28} />
            <ArrowRightIcon width={28} height={28} />
          </div>
        </Section>

        <Section title="Marquee">
          <Marquee />
        </Section>

        <Section title="ProductCard">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {products.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </Section>

        <Section title="Radios">
          <div className="flex flex-wrap items-end gap-6">
            {[["8px", "tag"], ["14px", "btn"], ["18px", "card"], ["22px", "img"]].map(([r, n]) => (
              <div key={n} className="text-center">
                <div className="h-24 w-24 border-2 border-paper" style={{ borderRadius: r }} />
                <p className="label mt-2 text-star">{n} · {r}</p>
              </div>
            ))}
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}
