/**
 * Interruptor del modo teaser.
 * false → "misterioso": productos borrosos/ocultos, sin tienda, carrito ni precios; el llamado es anotarse al aviso.
 * true  → sitio completo (Tienda, Producto, Carrito).
 */
export const LAUNCHED: boolean = false || process.env.NEXT_PUBLIC_LAUNCHED === "true"; // la variable solo sirve para pruebas

/**
 * Modo presentación: se ve la tienda completa (fotos nítidas, productos, precios y fichas) pero NO se puede comprar
 * (sin carrito ni checkout; el servidor sigue rechazando compras). Sirve mientras LAUNCHED es false.
 * Se activa con NEXT_PUBLIC_PREVIEW=true en Vercel (y Redeploy), o cambiando el false de acá abajo.
 */
export const PREVIEW: boolean = false || process.env.NEXT_PUBLIC_PREVIEW === "true";

/** ¿Se muestran la tienda y las fichas? Con la tienda abierta o en modo presentación. */
export const SHOP_VISIBLE: boolean = LAUNCHED || PREVIEW;

/** Redes de la marca. Es la única fuente: el pie, la home y el pago por transferencia leen de acá. */
export const SOCIAL = {
  instagram: { user: "byslfco", url: "https://www.instagram.com/byslfco" },
  tiktok: { user: "byslf_", url: "https://www.tiktok.com/@byslf_" },
} as const;

/** Fecha y hora del lanzamiento, tal como se muestra en la sección "primer vistazo" del teaser. */
export const LAUNCH_LABEL = "15/11 · 17hs";

/** Fecha del drop para mostrar en el teaser (ej. "15.11"). `null` = se muestra "???". */
export const DROP_DATE: "15.12" | null = "15.12";
