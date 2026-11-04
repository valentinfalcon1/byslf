import "server-only";
import type { Shipping } from "@/lib/shipping";
import { getProduct } from "@/data/products";
import { PICKUP_POINT } from "@/lib/shippingCost";
import { db } from "./db";
import { notifyOwner } from "./mail";
import type { MpPayment } from "./mercadopago";
import { hashKey } from "./security";

export type OrderLine = { slug: string; color: string; size: string; qty: number };

/** Minutos que se retiene el stock mientras el cliente paga. Mercado Pago vence la preferencia al mismo tiempo. */
export const RESERVE_MINUTES = 30;

export class OutOfStockError extends Error {
  constructor(public line: Pick<OrderLine, "slug" | "color" | "size">) {
    super("out_of_stock");
  }
}

export class TooManyPendingError extends Error {
  constructor() {
    super("too_many_pending");
  }
}

/** Descuenta el stock y crea el pedido 'pending', todo en una operación atómica. Lanza OutOfStockError si no alcanza. */
export async function reserveOrder(
  orderId: string,
  lines: OrderLine[],
  amount: number,
  buyerEmail: string,
  opts: { method?: "mp" | "transfer"; minutes?: number } = {},
): Promise<void> {
  const { error } = await db().rpc("reserve_order", {
    p_id: orderId,
    p_items: lines,
    p_amount: amount,
    p_minutes: opts.minutes ?? RESERVE_MINUTES,
    p_method: opts.method ?? "mp",
    p_buyer: hashKey(buyerEmail), // solo un hash: el email no se guarda
    p_terms: new Date().toISOString(),
  });
  if (!error) return;
  const m = /out_of_stock:([^|]*)\|([^|]*)\|(.*)$/.exec(error.message);
  if (m) throw new OutOfStockError({ slug: m[1], color: m[2], size: m[3] });
  if (error.message.includes("too_many_pending")) throw new TooManyPendingError();
  throw new Error(`reserve_order: ${error.message}`);
}

export type TransferNotice = "notified" | "already_notified" | "already_paid" | "expired" | "unknown_order";

/** El comprador avisó que transfirió. Devuelve 'notified' solo la PRIMERA vez (la única en la que hay que mandar el mail). */
export async function markTransferNotified(orderId: string): Promise<TransferNotice> {
  const { data, error } = await db().rpc("mark_transfer_notified", { p_id: orderId });
  if (error) throw new Error(`mark_transfer_notified: ${error.message}`);
  return data as TransferNotice;
}

/** Si el mail no salió, se des-marca el aviso para que el comprador pueda volver a intentarlo. */
export async function resetTransferNotice(orderId: string): Promise<void> {
  const { error } = await db().rpc("reset_transfer_notice", { p_id: orderId });
  if (error) console.error("[reset_transfer_notice]", error.message);
}

/** Confirmás que llegó la transferencia. Si la reserva había vencido, vuelve a descontar el stock (o lanza OutOfStockError). */
export async function confirmTransfer(orderId: string): Promise<"paid" | "already_paid" | "unknown_order"> {
  const { data, error } = await db().rpc("confirm_transfer", { p_id: orderId });
  if (!error) return data as "paid" | "already_paid" | "unknown_order";
  const m = /out_of_stock:([^|]*)|([^|]*)|(.*)$/.exec(error.message);
  if (m) throw new OutOfStockError({ slug: m[1], color: m[2], size: m[3] });
  throw new Error(`confirm_transfer: ${error.message}`);
}

/** Devuelve el stock de un pedido que no llegó a pagarse. No hace nada si ya no está pendiente. */
export async function releaseOrder(orderId: string): Promise<void> {
  const { error } = await db().rpc("release_order", { p_id: orderId });
  if (error) console.error("[release_order]", error.message);
}

/** Confirma un pago aprobado. Seguro ante avisos repetidos de Mercado Pago. Si falla, lanza (para que MP reintente). */
export async function recordApprovedPayment(payment: MpPayment): Promise<void> {
  if (!payment.external_reference) return; // no es un pago de esta web
  const { data, error } = await db().rpc("confirm_order", {
    p_id: payment.external_reference,
    p_payment: payment.id,
    p_amount: payment.transaction_amount,
  });
  if (error) throw new Error(`confirm_order: ${error.message}`);

  // Solo la PRIMERA confirmación ('paid') avisa: los reintentos de Mercado Pago ('already_paid') no duplican el mail.
  if (data === "paid") await notifySale(payment, "ok");
  // 'needs_review' = pagó después de vencer la reserva, o el monto no coincide: hay que revisarlo a mano.
  else if (data === "needs_review" || data === "unknown_order") {
    console.error("[pedido] REVISAR", { result: data, orderId: payment.external_reference, paymentId: payment.id });
    await notifySale(payment, "review");
  }
  // 'duplicate_payment' = el cliente pagó dos veces el mismo pedido: hay que devolver uno desde Mercado Pago.
  else if (data === "duplicate_payment") {
    console.error("[pedido] PAGO DUPLICADO", { orderId: payment.external_reference, paymentId: payment.id });
    await notifySale(payment, "duplicate");
  }
}

/** Mail al dueño con el detalle del pedido. Nunca lanza: un mail caído no puede hacer que MP reintente el pago. */
async function notifySale(payment: MpPayment, kind: "ok" | "review" | "duplicate"): Promise<void> {
  const review = kind !== "ok";
  try {
    const { data: order } = await db().from("orders").select("*").eq("id", payment.external_reference).maybeSingle();
    // El envío no está en la base: viene en el metadata del pago, que se consulta a Mercado Pago.
    const s = (payment.metadata?.shipping ?? {}) as Partial<Shipping>;
    const lines = await Promise.all(
      ((order?.items ?? []) as OrderLine[]).map(async (i) => `  - ${(await getProduct(i.slug))?.name ?? i.slug} · ${i.color} · Talle ${i.size} · x${i.qty}`),
    );
    const text = [
      kind === "duplicate"
        ? "⚠ PAGO DUPLICADO: el cliente pagó DOS VECES este pedido. Hay que devolver el pago de abajo desde Mercado Pago."
        : review
          ? "⚠ HAY QUE REVISAR ESTE PEDIDO A MANO (pagó después de vencer la reserva, o el monto no coincide)."
          : "Se confirmó el pago de un pedido.",
      "",
      `Pedido: ${payment.external_reference}`,
      `Pago de Mercado Pago: ${payment.id}`,
      `Monto: $${payment.transaction_amount}`,
      "",
      "Productos:",
      ...(lines.length ? lines : ["  (no se encontró el pedido en la base)"]),
      "",
      "Comprador:",
      `  ${s.name ?? ""} ${s.lastname ?? ""}`.trimEnd(),
      `  Email: ${s.email ?? "-"}`,
      `  Teléfono: ${s.phone ?? "-"}`,
      `  DNI: ${s.dni || "-"}`,
      "",
      ...(s.method === "pickup"
        ? ["RETIRA EN CÓRDOBA (no hay que enviar):", `  ${PICKUP_POINT}`, `  Indicaciones: ${s.notes || "-"}`]
        : [
            "Enviar a:",
            `  ${s.street ?? ""} ${s.number ?? ""}${s.floor ? `, ${s.floor}` : ""}`.trimEnd(),
            `  ${s.city ?? ""}, ${s.province ?? ""} (CP ${s.zip ?? "-"})`,
            `  Indicaciones: ${s.notes || "-"}`,
          ]),
      "",
      `Envío cobrado: $${payment.metadata?.shipping_cost ?? 0}`,
    ].join("\n");
    const prefix = kind === "duplicate" ? "⚠ PAGO DUPLICADO — " : review ? "⚠ REVISAR — " : "";
    await notifyOwner(`${prefix}Nueva venta BYSLF · $${payment.transaction_amount}`, text);
  } catch (e) {
    console.error("[mail] no se pudo armar el aviso de venta", e);
  }
}
