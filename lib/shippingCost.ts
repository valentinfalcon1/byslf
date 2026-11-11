/**
 * Costo de envío. Funciones puras: las usa el formulario (para mostrar el costo) y el servidor (que es quien lo cobra).
 * El navegador NUNCA manda un costo: solo manda método, provincia y código postal, y el servidor lo recalcula.
 */

/** delivery = a domicilio · branch = retiro en una sucursal de Correo Argentino · pickup = retiro en Córdoba (punto propio). */
export type DeliveryMethod = "delivery" | "branch" | "pickup";

/**
 * ¿Se ofrece el envío a domicilio? Por ahora NO: se vende solo a sucursal de Correo Argentino (y retiro).
 * Para reactivarlo, poné NEXT_PUBLIC_HOME_DELIVERY=true en Vercel y volvé a publicar. Es una función (no una constante) para poder probar los dos casos.
 */
export const homeDeliveryEnabled = () => process.env.NEXT_PUBLIC_HOME_DELIVERY === "true";

/** Envío gratis cuando el subtotal de los productos supera este monto (en pesos). */
export const FREE_SHIPPING_OVER = 100_000;

/** Dónde se retira el pedido (gratis, para cualquier comprador). */
export const PICKUP_POINT = "[PUNTO DE RETIRO EN CÓRDOBA]";

/** Códigos postales de la ciudad de Córdoba (capital). ⚠ Verificalos con el correo antes de lanzar: de esto depende qué envíos son gratis. */
export const CORDOBA_CAPITAL_ZIPS = { from: 5000, to: 5016 };

export type Zone = "capital" | "cordoba" | "centro" | "interior" | "patagonia";

export const ZONE_LABEL: Record<Zone, string> = {
  capital: "Córdoba capital",
  cordoba: "Resto de la provincia de Córdoba",
  centro: "Centro (CABA, Buenos Aires, Santa Fe, Entre Ríos, La Pampa)",
  interior: "Cuyo y Norte",
  patagonia: "Patagonia",
};

/**
 * Tarifas por zona, en pesos. `null` = [A DEFINIR]: todavía no se vende con envío a esa zona
 * (salvo que la compra supere el monto de envío gratis o se elija retiro). Editá solo esta tabla.
 */
export const RATES: Record<Zone, number | null> = {
  capital: 0, // envío gratis SOLO en Córdoba capital
  cordoba: null, // [A DEFINIR] resto de la provincia de Córdoba
  centro: 7500, // cotización aproximada (Buenos Aires: $6.739, redondeada)
  interior: 7500, // cotización aproximada (Corrientes, Jujuy)
  patagonia: 7800, // cotización aproximada (Chubut, Tierra del Fuego)
};

/**
 * Tarifas de envío A SUCURSAL de Correo Argentino, por zona (suele ser más barato que a domicilio). `null` = [A DEFINIR].
 * Acá no hay "capital gratis": a sucursal solo es gratis si la compra supera FREE_SHIPPING_OVER o si cargás 0 en la zona.
 */
export const BRANCH_RATES: Record<Zone, number | null> = {
  capital: null, // [A DEFINIR]
  cordoba: null, // [A DEFINIR]
  centro: 7500, // mismo valor que domicilio hasta cotizar sucursal por separado
  interior: 7500,
  patagonia: 7800,
};

const ZONE_OF: Record<string, Zone> = {
  "Córdoba": "cordoba",
  "Ciudad Autónoma de Buenos Aires": "centro", "Buenos Aires": "centro", "Santa Fe": "centro", "Entre Ríos": "centro", "La Pampa": "centro",
  "Catamarca": "interior", "Chaco": "interior", "Corrientes": "interior", "Formosa": "interior", "Jujuy": "interior", "La Rioja": "interior",
  "Mendoza": "interior", "Misiones": "interior", "Salta": "interior", "San Juan": "interior", "San Luis": "interior",
  "Santiago del Estero": "interior", "Tucumán": "interior",
  "Chubut": "patagonia", "Neuquén": "patagonia", "Río Negro": "patagonia", "Santa Cruz": "patagonia", "Tierra del Fuego": "patagonia",
};

/** Parte numérica del código postal ("5000" o "X5000ABC" → 5000), o null si no es válido. */
const zipNumber = (zip: string): number | null => {
  const m = /^[A-Za-z]?(\d{4})(?:[A-Za-z]{3})?$/.exec(zip.trim());
  return m ? Number(m[1]) : null;
};

/** Zona de destino. Dentro de Córdoba la zona sale del código postal (la localidad es texto libre y no es confiable). */
export function zoneOf(province: string, zip = ""): Zone | null {
  const zone = ZONE_OF[province];
  if (!zone) return null;
  if (zone !== "cordoba") return zone;
  const n = zipNumber(zip);
  return n !== null && n >= CORDOBA_CAPITAL_ZIPS.from && n <= CORDOBA_CAPITAL_ZIPS.to ? "capital" : "cordoba";
}

export type ShippingQuote =
  | { ok: true; cost: number; free: "pickup" | "threshold" | "zone" | null }
  | { ok: false; reason: "no_province" | "no_zip" | "no_rate" };

/** `subtotal` = suma de los productos, sin envío. `rates` solo se cambia en las pruebas. */
export function quoteShipping(method: DeliveryMethod, province: string, zip: string, subtotal: number, rates?: Record<Zone, number | null>): ShippingQuote {
  if (method === "pickup") return { ok: true, cost: 0, free: "pickup" };
  if (subtotal > FREE_SHIPPING_OVER) return { ok: true, cost: 0, free: "threshold" };
  const branch = method === "branch";
  // A sucursal no se pide código postal: la zona sale de la provincia (en Córdoba, "resto de la provincia").
  const zone = zoneOf(province, branch ? "" : zip);
  if (!zone) return { ok: false, reason: "no_province" };
  // A domicilio en Córdoba, sin un código postal válido no se puede saber si es la capital.
  if (!branch && ZONE_OF[province] === "cordoba" && zipNumber(zip) === null) return { ok: false, reason: "no_zip" };
  const rate = (rates ?? (branch ? BRANCH_RATES : RATES))[zone];
  if (rate === null || !Number.isFinite(rate) || rate < 0) return { ok: false, reason: "no_rate" };
  return { ok: true, cost: rate, free: rate === 0 ? "zone" : null };
}
