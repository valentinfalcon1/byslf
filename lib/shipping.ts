/** Datos de envío: tipo y validación compartidos entre el formulario (navegador) y la API (servidor). */
import type { DeliveryMethod } from "./shippingCost";

export type Shipping = {
  /** A domicilio, a una sucursal de Correo Argentino, o retiro en Córdoba (sin domicilio no hace falta la dirección). */
  method: DeliveryMethod;
  name: string;
  lastname: string;
  email: string;
  /** Código de área sin 0 (ej. 351). */
  areaCode: string;
  /** Celular sin código de área ni 15 (ej. 5551234). */
  phone: string;
  dni: string;
  /** Sucursal de Correo Argentino de destino (solo con method = "branch"). */
  branch: string;
  street: string;
  number: string;
  floor: string;
  city: string;
  province: string;
  zip: string;
  notes: string;
};

export type ShippingErrors = Partial<Record<keyof Shipping, string>>;

export const EMPTY_SHIPPING: Shipping = {
  method: "delivery", name: "", lastname: "", email: "", areaCode: "", phone: "", dni: "",
  branch: "", street: "", number: "", floor: "", city: "", province: "", zip: "", notes: "",
};

export const PROVINCES = [
  "Buenos Aires", "Ciudad Autónoma de Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes",
  "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro",
  "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán",
];

const MAX: Record<Exclude<keyof Shipping, "method">, number> = {
  name: 60, lastname: 60, email: 120, areaCode: 5, phone: 25, dni: 12, branch: 120, street: 100, number: 10, floor: 30, city: 80, province: 40, zip: 10, notes: 300,
};

const ALWAYS: (keyof Shipping)[] = ["name", "lastname", "email", "areaCode", "phone"];
const ADDRESS: (keyof Shipping)[] = ["street", "number", "city", "province", "zip"];

export function validateShipping(input: unknown): { ok: true; value: Shipping } | { ok: false; errors: ShippingErrors } {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const value = { ...EMPTY_SHIPPING };
  const errors: ShippingErrors = {};

  // Sin método se asume envío a domicilio; cualquier otro valor se rechaza.
  const method = raw.method === undefined || raw.method === "" ? "delivery" : raw.method;
  if (method !== "delivery" && method !== "branch" && method !== "pickup") errors.method = "Elegí cómo querés recibir el pedido.";
  else value.method = method;
  const home = value.method === "delivery";
  const branch = value.method === "branch";

  for (const k of Object.keys(MAX) as (keyof typeof MAX)[]) {
    const v = typeof raw[k] === "string" ? (raw[k] as string).trim() : "";
    value[k] = v;
    // A domicilio se pide la dirección; a sucursal, la provincia y la sucursal; con retiro propio nada de eso
    // (y si viene de más, solo se controla el largo).
    const required = ALWAYS.includes(k) || (home && ADDRESS.includes(k)) || (branch && (k === "province" || k === "branch"));
    if (v.length > MAX[k]) errors[k] = "Es demasiado largo.";
    else if (required && !v) errors[k] = "Completá este dato.";
  }

  if (!errors.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) errors.email = "Revisá el email.";
  if (!errors.areaCode && !/^[1-9]\d{1,3}$/.test(value.areaCode)) errors.areaCode = "Código de área sin 0 (ej. 351).";
  if (!errors.phone && !/^\d{6,8}$/.test(value.phone.replace(/[\s-]/g, ""))) errors.phone = "Celular sin código de área ni 15 (ej. 5551234).";
  if (!errors.dni && value.dni && !/^\d{7,9}$/.test(value.dni.replace(/\./g, ""))) errors.dni = "Revisá el DNI (solo números).";
  if (!errors.zip && (home || value.zip) &&!/^[A-Za-z]?\d{4}([A-Za-z]{3})?$/.test(value.zip)) errors.zip = "Código postal inválido (ej. 5000).";
  if (!errors.province && (home || branch || value.province) &&!PROVINCES.includes(value.province)) errors.province = "Elegí una provincia.";

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}
