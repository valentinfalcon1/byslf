import type { Metadata } from "next";
import Link from "next/link";
import { ComingSoon } from "@/components/ComingSoon";
import { SHOP_VISIBLE } from "@/lib/site";
import { Logo } from "@/components/Logo";
import { Shop } from "@/components/Shop";
import { CATEGORIES, getProducts, type Category } from "@/data/products";

export const metadata: Metadata = { title: "Tienda" };

export default async function TiendaPage({ searchParams }: { searchParams: Promise<{ cat?: string; drop?: string }> }) {
  if (!SHOP_VISIBLE) return <ComingSoon />;
  const { cat, drop } = await searchParams;
  const products = await getProducts();
  const initialCat = (CATEGORIES.some((c) => c.value === cat) ? cat : "todo") as Category | "todo";

  return (
    <>
      <div className="bg-night">
        <div className="container-x relative py-10 md:py-16">
          <nav aria-label="Breadcrumb" className="label text-slate-text">
            <Link href="/" className="hover:text-paper">Inicio</Link>
            <span aria-hidden="true"> / </span>
            <span aria-current="page" className="text-paper">Tienda</span>
          </nav>
          <h1 className="display mt-4 text-[clamp(4.5rem,18vw,12rem)]">Tienda</h1>
          <p className="label mt-4 text-slate-text">{products.length} productos</p>
          <Logo variant="secondary" decorative className="pointer-events-none absolute bottom-6 right-4 hidden w-56 md:block lg:right-8 lg:w-72" />
        </div>
      </div>
      <Shop products={products} initialCat={initialCat} initialDrop={drop === "001"} />
    </>
  );
}
