// Genera las fotos "tapadas" del teaser: chicas y ya borrosas, para que el original NUNCA viaje al navegador mientras
// la tienda está cerrada (el blur de CSS solo las tapa a la vista; la foto completa se podría bajar igual).
// Uso: node scripts/make-teaser-images.mjs   (correrlo cada vez que cambie la foto principal de un producto)
import sharp from "sharp";
import { readFileSync, mkdirSync } from "node:fs";

const src = readFileSync("data/products.ts", "utf8");
const products = [...src.matchAll(/slug: "([^"]+)".*?images: \[img\("([^"]+)"\)/g)].map((m) => ({ slug: m[1], file: m[2] }));
if (!products.length) throw new Error("No encontré productos en data/products.ts");

mkdirSync("public/img/teaser", { recursive: true });
for (const { slug, file } of products) {
  await sharp(`public/img/products/${file}.jpg`)
    .resize(72, 72, { fit: "cover" }) // tan chica que el detalle (logo, parches) no existe más
    .blur(3)
    .jpeg({ quality: 70 })
    .toFile(`public/img/teaser/${slug}.jpg`);
  console.log("ok", slug);
}
