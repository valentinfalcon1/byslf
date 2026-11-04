/** Datos de envío: tipo y validación compartidos entre el formulario (navegador) y la API (servidor). */
import type { DeliveryMethod } from "./shippingCost";

export type Shipping = {
  /** Envío a domicilio o retiro en Córdoba (con retiro no hace falta la dirección). */
  method: DeliveryMethod;
  name: string;
  lastname: string;
  email: string;
  phone: string;
  dni: string;
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
  method: "delivery", name: "", lastname: "", email: "", phone: "", dni: "",
  street: "", number: "", floor: "", city: "", province: "", zip: "", notes: "",
};

export const PROVINCES = [
  "Buenos Aires", "Ciudad Autónoma de Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes",
  "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro",
  "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán",
];

const MAX: Record<Exclude<keyof Shipping, "method">, number> = {
  name: 60, lastname: 60, email: 120, phone: 25, dni: 12, street: 100, number: 10, floor: 30, city: 80, province: 40, zip: 10, notes: 300,
};

const ALWAYS: (keyof Shipping)[] = ["name", "lastname", "email", "phone"];
const ADDRESS: (keyof Shipping)[] = ["street", "number", "city", "province", "zip"];

export function validateShipping(input: unknown): { ok: true; value: Shipping } | { ok: false; errors: ShippingErrors } {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const value = { ...EMPTY_SHIPPING };
  const errors: ShippingErrors = {};

  // Sin método se asume envío a domicilio; cualquier otro valor se rechaza.
  const method = raw.method === undefined || raw.method === "" ? "delivery" : raw.method;
  if (method !== "delivery" && method !== "pickup") errors.method = "Elegí cómo querés recibir el pedido.";
  else value.method = method;
  const pickup = value.method === "pickup";

  for (const k of Object.keys(MAX) as (keyof typeof MAX)[]) {
    const v = typeof raw[k] === "string" ? (raw[k] as string).trim() : "";
    value[k] = v;
    // Con retiro la dirección no se pide (y si viene, solo se controla el largo).
    const required = ALWAYS.includes(k) || (!pickup && ADDRESS.includes(k));
    if (v.length > MAX[k]) errors[k] = "Es demasiado largo.";
    else if (required && !v) errors[k] = "Completá este dato.";
  }

  if (!errors.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) errors.email = "Revisá el email.";
  if (!errors.phone && !/^\d{8,15}$/.test(value.phone.replace(/[\s()+-]/g, ""))) errors.phone = "Ingresá un teléfono válido, con característica.";
  if (!errors.dni && value.dni && !/^\d{7,9}$/.test(value.dni.replace(/\./g, ""))) errors.dni = "Revisá el DNI (solo números).";
  if (!errors.zip && (!pickup || value.zip) && !/^[A-Za-z]?\d{4}([A-Za-z]{3})?$/.test(value.zip)) errors.zip = "Código postal inválido (ej. 5000).";
  if (!errors.province && (!pickup || value.province) && !PROVINCES.includes(value.province)) errors.province = "Elegí una provincia.";

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}
