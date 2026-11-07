import "server-only";
import type { Shipping } from "@/lib/shipping";
import { PICKUP_POINT } from "@/lib/shippingCost";

/**
 * Datos de envío para los mails al dueño, en el mismo orden y con los mismos nombres que el formulario
 * "Nuevo envío" de MiCorreo, para copiarlos y pegarlos tal cual. `s` puede venir incompleto (sale del metadata del pago).
 */
export function shippingLines(s: Partial<Shipping>): string[] {
  const v = (x: string | undefined) => x || "-";
  const contact = [
    `  Nombre y apellido: ${`${s.name ?? ""} ${s.lastname ?? ""}`.trim() || "-"}`,
    `  Correo electrónico: ${v(s.email)}`,
    `  Cód. área (sin 0): ${v(s.areaCode)}`,
    `  Celular: ${v(s.phone)}`,
    `  DNI: ${v(s.dni)}`,
  ];

  if (s.method === "pickup") {
    return ["RETIRA EN CÓRDOBA (no hay que enviar):", `  ${PICKUP_POINT}`, `  Indicaciones: ${v(s.notes)}`, "", "Comprador:", ...contact];
  }
  if (s.method === "branch") {
    return [
      "ENVÍO A SUCURSAL DE CORREO ARGENTINO (Tipo de entrega: Entrega en Sucursal):",
      `  Provincia: ${v(s.province)}`,
      `  Sucursal de destino: ${v(s.branch)}`,
      `  Observaciones: ${v(s.notes)}`,
      "",
      "Destinatario:",
      ...contact,
    ];
  }
  return [
    "ENVÍO A DOMICILIO (Tipo de entrega: Entrega en Domicilio):",
    `  Provincia: ${v(s.province)}`,
    `  Localidad: ${v(s.city)}`,
    `  Dirección (calle, altura, piso y dpto.): ${`${s.street ?? ""} ${s.number ?? ""}${s.floor ? `, ${s.floor}` : ""}`.trim() || "-"}`,
    `  CP (CPA): ${v(s.zip)}`,
    `  Observaciones: ${v(s.notes)}`,
    "",
    "Destinatario:",
    ...contact,
  ];
}
