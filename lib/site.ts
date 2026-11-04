/**
 * Interruptor del modo teaser.
 * false → "misterioso": productos borrosos/ocultos, sin tienda, carrito ni precios; el llamado es anotarse al aviso.
 * true  → sitio completo (Tienda, Producto, Carrito).
 */
export const LAUNCHED: boolean = false || process.env.NEXT_PUBLIC_LAUNCHED === "true"; // la variable solo sirve para pruebas

/** Redes de la marca. Es la única fuente: el pie, la home y el pago por transferencia leen de acá. */
export const SOCIAL = {
  instagram: { user: "byslfco", url: "https://www.instagram.com/byslfco" },
  tiktok: { user: "byslf_", url: "https://www.tiktok.com/@byslf_" },
} as const;

/** Fecha del drop para mostrar en el teaser (ej. "15.11"). `null` = se muestra "???". */
export const DROP_DATE: "15.12" | null = "15.12";
