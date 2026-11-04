/** Precio en ARS, o el placeholder mientras no haya precio real. */
export function formatPrice(price: number | null): string {
  if (price === null) return "[PRECIO]";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(price);
}
