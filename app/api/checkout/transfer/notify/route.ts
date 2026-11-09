import { sendBuyerTransfer } from "@/lib/server/buyerMail";
import { db } from "@/lib/server/db";
import { markTransferNotified, resetTransferNotice, type OrderLine } from "@/lib/server/orders";
import { allow } from "@/lib/server/ratelimit";
import { UUID_RE, checkOrigin, clientIp, hashKey, json, readJson } from "@/lib/server/security";
import { notifyTransfer } from "@/lib/server/transfer";
import { validateShipping } from "@/lib/shipping";
import { LAUNCHED } from "@/lib/site";

/**
 * El comprador tocó "Ya transferí, enviar comprobante": te llegan sus datos de envío por mail.
 * Los datos NO se guardan: vienen en esta petición, se validan y salen en el mail. El mail sale una sola vez por pedido.
 */
export async function POST(req: Request) {
  if (!LAUNCHED && process.env.NODE_ENV === "production") return json({ error: "La tienda todavía no está abierta." }, 403);

  const originError = checkOrigin(req);
  if (originError) return originError;

  try {
    if (!(await allow("transfer-notify", clientIp(req), 10, 10 * 60))) {
      return json({ error: "Demasiados intentos. Esperá unos minutos y probá de nuevo." }, 429);
    }
  } catch {
    return json({ error: "El servicio no está disponible en este momento. Probá de nuevo en un rato." }, 503);
  }

  const parsed = await readJson(req);
  if ("error" in parsed) return parsed.error;
  const body = (parsed.data && typeof parsed.data === "object" ? parsed.data : {}) as { orderId?: unknown; shipping?: unknown };

  if (typeof body.orderId !== "string" || !UUID_RE.test(body.orderId)) return json({ error: "Pedido inválido." }, 400);
  const orderId = body.orderId.toLowerCase();

  const ship = validateShipping(body.shipping);
  if (!ship.ok) return json({ error: "Revisá los datos de envío.", fields: ship.errors }, 422);

  try {
    const { data: order } = await db().from("orders").select("*").eq("id", orderId).maybeSingle();
    if (!order || order.method !== "transfer") return json({ error: "No encontramos ese pedido." }, 404);
    // Los datos tienen que ser de la misma persona que hizo el pedido (el email se compara por su hash).
    if (order.buyer_key !== hashKey(ship.value.email)) return json({ error: "Los datos no coinciden con el pedido." }, 409);

    const result = await markTransferNotified(orderId);
    if (result === "unknown_order") return json({ error: "No encontramos ese pedido." }, 404);
    if (result === "expired") {
      return json({ error: "La reserva venció. Si ya transferiste, escribinos por Instagram con tu comprobante y lo resolvemos." }, 409);
    }
    if (result === "already_paid") return json({ status: "paid" });
    if (result === "already_notified") return json({ status: "already" });

    // 'notified': primera vez → sale el mail. Si no sale, se des-marca para que pueda reintentar (los datos no se guardan).
    const sent = await notifyTransfer({ id: orderId, amount: order.amount, items: order.items as OrderLine[], expires_at: order.expires_at }, ship.value);
    if (!sent) {
      await resetTransferNotice(orderId);
      return json({ error: "No pudimos enviar tus datos. Probá de nuevo en un momento." }, 502);
    }
    // Constancia para el comprador (no es parte de la venta: si falla, el aviso igual quedó hecho).
    await sendBuyerTransfer({ orderId, items: order.items as OrderLine[], amount: order.amount, expiresAt: order.expires_at, shipping: ship.value });
    return json({ status: "sent" });
  } catch (e) {
    console.error("[transfer/notify]", e);
    return json({ error: "No pudimos procesar el aviso. Probá de nuevo en un rato." }, 502);
  }
}
