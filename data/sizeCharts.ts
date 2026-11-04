import type { Category } from "./products";

/**
 * Tabla de talles por tipo de prenda. Las medidas son placeholders: completar con las reales (en cm, prenda en plano).
 * `null` = no lleva tabla (accesorios).
 */
export type SizeChart = { columns: string[]; measures: Record<string, string[]> };

const PENDING = "[CM]";

const chart = (columns: string[], sizes: string[], values: Record<string, string[]> = {}): SizeChart => ({
  columns,
  measures: Object.fromEntries(sizes.map((s) => [s, values[s] ?? columns.map(() => PENDING)])),
});

const COLUMNS: Record<Exclude<Category, "accesorios">, string[]> = {
  buzos: ["Ancho", "Largo", "Manga"],
  remeras: ["Ancho", "Largo", "Manga"],
  pantalones: ["Cintura", "Largo", "Tiro"],
};

export function sizeChartFor(category: Category, sizes: string[]): SizeChart | null {
  if (category === "accesorios") return null;
  return chart(COLUMNS[category], sizes);
}
