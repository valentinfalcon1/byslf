import sharp from "sharp";
const A = "assets/";
const o = "public/img/";
const px = async (f, x, y) => {
  const { data } = await sharp(A + f).extract({ left: x, top: y, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
  return [...data].slice(0, 3);
};
console.log("sheet bg", await px("image.png", 20, 20));
console.log("primary bg", await px("WhatsApp Image 2026-10-19 at 12.44.39.jpeg", 20, 20));
console.log("slate bg", await px("WhatsApp Image 2026-10-19 at 12.44.52.jpeg", 20, 20));

const crop = (f, out, left, top, width, height, w) =>
  sharp(A + f).extract({ left, top, width, height }).resize({ width: w }).png().toFile(o + out);

// logos: primary, wordmark y stars salen de assets/logo-byslf.png (ver prep-logo.mjs)
const P = "WhatsApp Image 2026-10-19 at 12.44.39.jpeg";
const S = "WhatsApp Image 2026-10-19 at 12.44.52.jpeg";
await crop(S, "logo/secondary.png", 230, 420, 1260, 760, 900);
// plancha de logos
await crop("image.png", "logo/monogram.png", 160, 1030, 430, 490, 300);

// mosaico lookbook (1254x1254)
const M = "image copy.png";
const tiles = {
  hoodie: [0, 0, 415, 490],
  tag: [418, 0, 418, 490],
  stickers: [840, 0, 414, 490],
  poster: [40, 497, 527, 380],
  label: [569, 497, 304, 380],
  bag: [874, 497, 380, 380],
  night: [0, 882, 413, 372],
  wall: [416, 882, 361, 372],
  pants: [780, 882, 474, 372],
};
for (const [k, [l, t, w, h]] of Object.entries(tiles))
  await sharp(A + M).extract({ left: l, top: t, width: w, height: h }).resize({ width: 800, withoutEnlargement: true }).jpeg({ quality: 85 }).toFile(o + `look/${k}.jpg`);
console.log("ok");
