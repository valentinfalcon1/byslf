import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/data/products";
import { CATEGORIES } from "@/data/products";
import { formatPrice } from "@/lib/format";
import { transferPrice } from "@/lib/transfer";
import { Tag } from "./Tag";

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const category = CATEGORIES.find((c) => c.value === product.category)?.label ?? product.category;
  return (
    <article className="group">
      <Link href={`/producto/${product.slug}`} className="block">
        <div className="relative aspect-square overflow-hidden rounded-card border border-line bg-surface">
          <Image
            src={product.images[0]}
            alt={`${product.name} — ${category}`}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 280px, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
          />
          {product.tag && <Tag className="absolute left-3 top-3">{product.tag}</Tag>}
        </div>
        <div className="mt-4 space-y-1">
          <h3 className="label font-bold text-paper">{product.name}</h3>
          <p className="label text-star">{category}</p>
          <p className="label font-bold text-paper">{formatPrice(product.price)}</p>
          {product.price !== null && <p className="label text-[11px] text-star">{formatPrice(transferPrice(product.price))} con transferencia</p>}
        </div>
      </Link>
    </article>
  );
}
