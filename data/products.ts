/**
 * Fuente temporal de productos. Todo lo comercial (nombres, precios) es placeholder.
 * Cuando se conecte Shopify / Tiendanube, reemplazar `getProducts` / `getProduct`
 * por llamadas a la API manteniendo el tipo `Product`: ninguna página lee el array directo.
 */

export type Category = "buzos" | "remeras" | "pantalones" | "accesorios";

export type Color = { name: string; hex: string };

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: Category;
  /** Precio en ARS. `null` = todavía sin definir → se muestra [PRECIO]. */
  price: number | null;
  tag?: string;
  colors: Color[];
  sizes: string[];
  /** Primera imagen = principal. Si hay más fotos del producto, se suman acá y aparecen como miniaturas. */
  images: string[];
};

export const CATEGORIES: { value: Category | "todo"; label: string }[] = [
  { value: "todo", label: "Todo" },
  { value: "buzos", label: "Buzos" },
  { value: "remeras", label: "Remeras" },
  { value: "pantalones", label: "Pantalones" },
  { value: "accesorios", label: "Accesorios" },
];

export const SIZES = ["S", "M", "L"];

/** Cada artículo viene en un solo color. */
const NEGRO: Color[] = [{ name: "Negro", hex: "#191919" }];
const GRIS_TOPO: Color[] = [{ name: "Gris topo", hex: "#3e3a3b" }]; // tomado de la foto del producto

const img = (name: string) => `/img/products/${name}.jpg`;

export const products: Product[] = [
  { id: "p01", slug: "producto-01", name: "Byslf patch negra", category: "remeras", price: 55000, tag: "Drop 001", colors: NEGRO, sizes: SIZES, images: [img("byslf-patch-negra")] },
  { id: "p02", slug: "producto-02", name: "Byslf patch gris topo", category: "remeras", price: 55000, tag: "Drop 001", colors: GRIS_TOPO, sizes: SIZES, images: [img("byslf-patch-gris-topo")] },
  { id: "p03", slug: "producto-03", name: "Bermuda ID negra", category: "pantalones", price: 62000, tag: "Drop 001", colors: NEGRO, sizes: SIZES, images: [img("bermuda-id-negra")] },
];

/**
 * SOLO PARA PROBAR: con DEV_TEST_PRICE=1000 en .env.local, TODOS los productos quedan a $1000 para poder
 * hacer una compra de prueba con Mercado Pago (que no deja pagar montos grandes de prueba). Se ignora por completo en producción.
 */
function withTestPrice(p: Product): Product {
  const test = Number(process.env.DEV_TEST_PRICE);
  if (process.env.NODE_ENV === "production" || !Number.isFinite(test) || test <= 0) return p;
  return { ...p, price: test };
}

export async function getProducts(): Promise<Product[]> {
  return products.map(withTestPrice);
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  const p = products.find((x) => x.slug === slug);
  return p && withTestPrice(p);
}
