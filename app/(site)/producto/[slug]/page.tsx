import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LAUNCHED } from "@/lib/site";
import { ProductCard } from "@/components/ProductCard";
import { ProductDetail } from "@/components/ProductDetail";
import { getProduct, getProducts } from "@/data/products";

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  return { title: LAUNCHED ? (product?.name ?? "Producto") : "Próximamente" };
}

export default async function ProductoPage({ params }: Params) {
  if (!LAUNCHED) redirect("/tienda");
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const look = (await getProducts()).filter((p) => p.slug !== slug).slice(0, 4);

  return (
    <>
      <nav aria-label="Breadcrumb" className="container-x label pt-6 text-star">
        <Link href="/" className="hover:text-paper">Inicio</Link>
        <span aria-hidden="true"> / </span>
        <Link href="/tienda" className="hover:text-paper">Tienda</Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page" className="text-paper">{product.name}</span>
      </nav>

      <ProductDetail product={product} />

      <section className="bg-night py-16 md:py-24">
        <div className="container-x">
          <h2 className="display mb-10 text-5xl md:text-7xl">Completá el look</h2>
          <div className="grid max-w-3xl grid-cols-2 gap-4 md:gap-6">
            {look.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      </section>
    </>
  );
}
