import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getProduct } from "@/data/products";
import { PICKUP_POINT } from "@/lib/shippingCost";
import type { Shipping } from "@/lib/shipping";
import { orderCode } from "@/lib/transfer";
import { notifyOwner } from "./mail";
import type { OrderLine } from "./orders";
import { siteUrl } from "./security";

/**
 * Link firmado para confirmar una transferencia desde el mail. La firma es un HMAC del código del pedido con
 * ADMIN_LINK_SECRET: sin ese secreto nadie puede fabricar un link válido. Sin secreto (o muy corto) no hay links.
 */
const secret = (): string | null => {
  const s = process.env.ADMIN_LINK_SECRET;
  return s && s.length >= 32 ? s : null;
};

export function signConfirm(orderId: string): string | null {
  const s = secret();
  return s ? createHmac("sha256", s).update(`confirm-transfer:${orderId.toLowerCase()}`).digest("hex") : null;
}

export function verifyConfirm(orderId: string, token: unknown): boolean {
  const expected = signConfirm(orderId);
  if (!expected || typeof token !== "string" || token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

export function confirmLink(orderId: string): string | null {
  const t = signConfirm(orderId);
  return t ? `${siteUrl()}/admin/confirmar?o=${orderId}&t=${t}` : null;
}

/** Mail al dueño cuando el comprador toca "Ya transferí, enviar comprobante". Nunca lanza; devuelve si el mail salió. */
export async function notifyTransfer(order: { id: string; amount: number | string; items: OrderLine[]; expires_at: string }, s: Shipping): Promise<boolean> {
  try {
    const lines = await Promise.all(
      order.items.map(async (i) => `  - ${(await getProduct(i.slug))?.name ?? i.slug} · ${i.color} · Talle ${i.size} · x${i.qty}`),
    );
    const link = confirmLink(order.id);
    const text = [
      "TRANSFERENCIA — PAGO SIN CONFIRMAR. El comprador avisó que transfirió: esperá su comprobante en Instagram y comprobá que la plata llegó.",
      "",
      `Código en el concepto: ${orderCode(order.id)}`,
      `Pedido: ${order.id}`,
      `Monto a recibir: $${order.amount}`,
      `La reserva del stock vence: ${new Date(order.expires_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Cordoba" })}`,
      "",
      "Productos:",
      ...lines,
      "",
      "Comprador:",
      `  ${s.name} ${s.lastname}`.trimEnd(),
      `  Email: ${s.email}`,
      `  Teléfono: ${s.phone}`,
      `  DNI: ${s.dni || "-"}`,
      "",
      ...(s.method === "pickup"
        ? ["RETIRA EN CÓRDOBA (no hay que enviar):", `  ${PICKUP_POINT}`, `  Indicaciones: ${s.notes || "-"}`]
        : [
            "Enviar a:",
            `  ${s.street} ${s.number}${s.floor ? `, ${s.floor}` : ""}`.trimEnd(),
            `  ${s.city}, ${s.province} (CP ${s.zip})`,
            `  Indicaciones: ${s.notes || "-"}`,
          ]),
      "",
      link
        ? `Cuando veas el comprobante y la plata en tu cuenta, confirmá el pago acá (no reenvíes este mail: quien tenga el link puede confirmar):\n${link}`
        : "⚠ Falta definir ADMIN_LINK_SECRET en .env.local: no hay link para confirmar. Confirmalo a mano en Supabase: select confirm_transfer('" + order.id + "');",
    ].join("\n");
    return await notifyOwner(`Transferencia por confirmar · $${order.amount} · ${orderCode(order.id)}`, text);
  } catch (e) {
    console.error("[mail] no se pudo armar el aviso de transferencia", e);
    return false;
  }
}
