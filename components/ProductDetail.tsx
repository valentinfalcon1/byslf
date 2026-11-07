"use client";

import Image from "next/image";
import { forwardRef, useRef, useState } from "react";
import type { Product } from "@/data/products";
import { formatPrice } from "@/lib/format";
import { POLICY } from "@/lib/legal";
import { sizeChartFor, type SizeChart } from "@/data/sizeCharts";
import { Button } from "./Button";
import { useCart } from "./cart/CartProvider";
import { CloseIcon, MinusIcon, PlusIcon } from "./icons";
import { SizeTable } from "./SizeTable";
import { Tag } from "./Tag";

const ACCORDIONS = [
  { title: "Descripción", body: "[DESCRIPCIÓN DEL PRODUCTO]" },
  { title: "Materiales y cuidado", body: "[MATERIALES Y INSTRUCCIONES DE LAVADO]" },
  { title: "Envíos y cambios", body: `Envíos a toda Argentina a través de Correo Argentino. Despachamos en ${POLICY.dispatchDays} días hábiles y la entrega demora ${POLICY.deliveryDays} días hábiles según el destino. Cambios de talle o color dentro de los ${POLICY.exchangeDays} días.` },
];

export function ProductDetail({ product }: { product: Product }) {
  const { add } = useCart();
  const [active, setActive] = useState(0);
  const [color, setColor] = useState(product.colors[0]);
  const [size, setSize] = useState<string | null>(null);
  const [missingSize, setMissingSize] = useState(false);
  const guide = useRef<HTMLDialogElement>(null);
  const chart = sizeChartFor(product.category, product.sizes);

  function addToCart() {
    if (!size) return setMissingSize(true);
    add({ slug: product.slug, name: product.name, image: product.images[0], price: product.price, color: color.name, size });
  }

  return (
    <div className="container-x grid gap-10 py-8 md:py-14 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
      {/* Galería */}
      <div>
        <div className="relative aspect-square overflow-hidden rounded-img border border-line bg-surface">
          <Image
            key={product.images[active]}
            src={product.images[active]}
            alt={`${product.name} — vista ${active + 1} de ${product.images.length}`}
            fill
            priority
            sizes="(min-width: 1024px) 600px, 100vw"
            className="object-cover"
          />
          {product.tag && <Tag className="absolute left-4 top-4">{product.tag}</Tag>}
        </div>
        {product.images.length > 1 && (
        <ul className="mt-4 grid grid-cols-4 gap-3">
          {product.images.slice(0, 4).map((src, i) => (
            <li key={src + i}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Ver imagen ${i + 1}`}
                aria-current={active === i}
                className={`relative block aspect-square w-full overflow-hidden rounded-card border-2 transition-colors ${active === i ? "border-slate" : "border-line hover:border-slate"}`}
              >
                <Image src={src} alt="" fill sizes="120px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
        )}
      </div>

      {/* Info */}
      <div className="lg:sticky lg:top-28 lg:self-start">
        <h1 className="display text-4xl md:text-6xl">{product.name}</h1>
        <span aria-hidden="true" className="mt-5 block h-0.5 w-12 bg-slate" />
        <p className="label mt-4 text-xl font-bold">{formatPrice(product.price)}</p>
        <p className="label mt-1 text-star">[CUOTAS — ej. 3 cuotas sin interés]</p>

        <fieldset className="mt-8">
          <legend className="label mb-3 font-bold">Color: <span className="text-slate-text">{color.name}</span></legend>
          <div className="flex gap-3">
            {product.colors.map((c) => {
              const on = c.name === color.name;
              return (
                <button
                  key={c.name}
                  type="button"
                  aria-label={c.name}
                  aria-pressed={on}
                  onClick={() => setColor(c)}
                  className={`h-11 w-11 rounded-full border border-star transition-shadow ${on ? "shadow-[0_0_0_3px_var(--color-ink),0_0_0_5px_var(--color-slate)]" : ""}`}
                  style={{ background: c.hex }}
                />
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <legend className="label font-bold">Talle</legend>
            {chart && (
              <button type="button" onClick={() => guide.current?.showModal()} className="label text-slate-text underline underline-offset-4 hover:text-paper">
                Guía de talles
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((s) => {
              const on = s === size;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => { setSize(s); setMissingSize(false); }}
                  className={`label h-12 min-w-14 rounded-btn border px-4 font-bold transition-colors ${on ? "border-paper bg-paper text-ink" : "border-line hover:border-slate"}`}
                >
                  {s}
                </button>
              );
            })}
          </div>
          {missingSize && <p role="alert" className="label mt-3 text-paper">↑ Elegí tu talle primero.</p>}
        </fieldset>

        <Button className="mt-8 w-full" onClick={addToCart}>Agregar al carrito</Button>

        <div className="mt-10 border-t border-line">
          {ACCORDIONS.map((a, i) => (
            <details key={a.title} open={i === 0} className="group border-b border-line">
              <summary className="label flex cursor-pointer list-none items-center justify-between py-5 font-bold [&::-webkit-details-marker]:hidden">
                {a.title}
                <PlusIcon className="group-open:hidden" />
                <MinusIcon className="hidden group-open:block" />
              </summary>
              <p className="pb-5 text-star">{a.body}</p>
            </details>
          ))}
          {chart && (
            <details className="group border-b border-line">
              <summary className="label flex cursor-pointer list-none items-center justify-between py-5 font-bold [&::-webkit-details-marker]:hidden">
                Tabla de talles
                <PlusIcon className="group-open:hidden" />
                <MinusIcon className="hidden group-open:block" />
              </summary>
              <div className="pb-5"><SizeTable chart={chart} selected={size} /></div>
            </details>
          )}
        </div>
      </div>

      {chart && <SizeGuide ref={guide} chart={chart} selected={size} />}
    </div>
  );
}

const SizeGuide = forwardRef<HTMLDialogElement, { chart: SizeChart; selected: string | null }>(function SizeGuide({ chart, selected }, ref) {
  return (
    <dialog
      ref={ref}
      aria-label="Guía de talles"
      // click en el fondo (backdrop) cierra
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      className="m-auto w-[min(92vw,520px)] rounded-img border border-line bg-surface p-0 text-paper backdrop:bg-black/70"
    >
      <div className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="display text-3xl">Guía de talles</h2>
          <button type="button" aria-label="Cerrar guía de talles" onClick={(e) => e.currentTarget.closest("dialog")?.close()} className="inline-flex h-11 w-11 items-center justify-center rounded-btn hover:bg-ink">
            <CloseIcon />
          </button>
        </div>
        <div className="mt-6"><SizeTable chart={chart} selected={selected} /></div>
      </div>
    </dialog>
  );
});
