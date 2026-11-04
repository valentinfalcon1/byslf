"use client";

import { useMemo, useState } from "react";
import { CATEGORIES, type Category, type Product } from "@/data/products";
import { CloseIcon, ChevronDownIcon } from "./icons";
import { Button } from "./Button";
import { ProductCard } from "./ProductCard";

const PAGE_SIZE = 6;

const SORTS = [
  { value: "destacados", label: "Destacados" },
  { value: "precio-asc", label: "Precio: menor a mayor" },
  { value: "precio-desc", label: "Precio: mayor a menor" },
  { value: "nombre", label: "Nombre A–Z" },
] as const;
type Sort = (typeof SORTS)[number]["value"];

export function Shop({ products, initialCat, initialDrop }: { products: Product[]; initialCat: Category | "todo"; initialDrop: boolean }) {
  const [cat, setCat] = useState<Category | "todo">(initialCat);
  const [drop, setDrop] = useState(initialDrop);
  const [sort, setSort] = useState<Sort>("destacados");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const list = useMemo(() => {
    const filtered = products.filter((p) => (cat === "todo" || p.category === cat) && (!drop || p.tag === "Drop 001"));
    const price = (p: Product) => p.price ?? 0;
    if (sort === "precio-asc") filtered.sort((a, b) => price(a) - price(b));
    if (sort === "precio-desc") filtered.sort((a, b) => price(b) - price(a));
    if (sort === "nombre") filtered.sort((a, b) => a.name.localeCompare(b.name, "es"));
    return filtered;
  }, [products, cat, drop, sort]);

  const shown = list.slice(0, visible);
  const categories = CATEGORIES.filter((c) => c.value === "todo" || products.some((p) => p.category === c.value));

  return (
    <section className="container-x py-10 md:py-14">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div role="group" aria-label="Filtrar por categoría" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
          {categories.map((c) => {
            const active = cat === c.value;
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={active}
                onClick={() => { setCat(c.value); setVisible(PAGE_SIZE); }}
                className={`label shrink-0 rounded-full border px-5 py-2.5 font-bold transition-colors ${active ? "border-paper bg-paper text-ink" : "border-line text-paper hover:border-star"}`}
              >
                {c.label}
              </button>
            );
          })}
          {drop && (
            <button type="button" onClick={() => setDrop(false)} aria-label="Quitar filtro Drop 001" className="label inline-flex shrink-0 items-center gap-2 rounded-full border border-slate px-4 py-2.5 font-bold text-slate-text">
              Drop 001 <CloseIcon width={14} height={14} />
            </button>
          )}
        </div>

        <div className="relative md:w-64">
          <label htmlFor="orden" className="sr-only">Ordenar por</label>
          <select
            id="orden"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="label h-12 w-full appearance-none rounded-btn border border-line bg-surface pl-5 pr-11 text-paper"
          >
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-star" />
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="py-24 text-center">
          <p className="display text-4xl">Nada por acá</p>
          <p className="label mt-3 text-star">Probá con otra categoría.</p>
        </div>
      ) : (
        <ul className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
          {shown.map((p, i) => (
            <li key={p.id}><ProductCard product={p} priority={i < 4} /></li>
          ))}
        </ul>
      )}

      {visible < list.length && (
        <div className="mt-14 flex justify-center">
          <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>Cargar más</Button>
        </div>
      )}
    </section>
  );
}
