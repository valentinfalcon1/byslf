// Genera los logos de la web a partir del PNG transparente oficial (assets/logo-byslf.png, 4500x4500):
//   byslf    = estrellas + BYSLF  (hero)
//   wordmark = solo BYSLF         (header, footer)
//   stars    = solo estrellas     (design system)
import sharp from "sharp";

const SRC = "assets/logo-byslf.png";
const OUT = "public/img/logo/";
const SPLIT = 2150; // fila (px del original) entre las estrellas y el wordmark

// En dos pasos: sharp aplica trim antes que extract si van encadenados.
const trimmed = async (region) => sharp(await sharp(SRC).extract(region).toBuffer()).trim({ threshold: 1 }).toBuffer();

const jobs = {
  byslf: [{ left: 0, top: 0, width: 4500, height: 4500 }, 1600],
  wordmark: [{ left: 0, top: SPLIT, width: 4500, height: 4500 - SPLIT }, 1200],
  stars: [{ left: 0, top: 0, width: 4500, height: SPLIT - 50 }, 700],
};

for (const [name, [region, width]] of Object.entries(jobs)) {
  const buf = await trimmed(region);
  const info = await sharp(buf).resize({ width }).png({ compressionLevel: 9 }).toFile(`${OUT}${name}.png`);
  console.log(name, info.width, "x", info.height);
}
