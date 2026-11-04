// Vuelve transparente el fondo (flood fill desde los bordes) de los monograma recortado de la plancha.
import sharp from "sharp";
for (const f of ["monogram"]) {
  const p = `public/img/logo/${f}.png`;
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const seen = new Uint8Array(w * h);
  const near = (i) => Math.abs(data[i] - 29) < 7 && Math.abs(data[i + 1] - 29) < 7 && Math.abs(data[i + 2] - 27) < 7;
  const q = [];
  const push = (x, y) => { const k = y * w + x; if (!seen[k] && near(k * 4)) { seen[k] = 1; q.push(k); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (q.length) {
    const k = q.pop(), x = k % w, y = (k / w) | 0;
    data[k * 4 + 3] = 0;
    if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1);
  }
  await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toFile(p + ".tmp");
  const fs = await import("node:fs"); fs.renameSync(p + ".tmp", p);
}
console.log("done");
