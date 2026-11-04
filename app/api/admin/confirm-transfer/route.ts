import { OutOfStockError, confirmTransfer } from "@/lib/server/orders";
import { allow } from "@/lib/server/ratelimit";
import { UUID_RE, checkOrigin, clientIp, json, readJson } from "@/lib/server/security";
import { verifyConfirm } from "@/lib/server/transfer";

/**
 * Confirma que llegó una transferencia. SOLO con el link firmado que te llega por mail (HMAC con ADMIN_LINK_SECRET).
 * La página del link no confirma nada al abrirse (los antivirus y previsualizadores abren links): hace falta tocar el botón.
 */
export async function POST(req: Request) {
  const originError = checkOrigin(req);
  if (originError) return originError;

  try {
    if (!(await allow("admin-confirm", clientIp(req), 10, 10 * 60))) {
      return json({ error: "Demasiados intentos. Esperá unos minutos." }, 429);
    }
  } catch {
    return json({ error: "El servicio no está disponible en este momento." }, 503);
  }

  const parsed = await readJson(req, 2_000);
  if ("error" in parsed) return parsed.error;
  const body = (parsed.data && typeof parsed.data === "object" ? parsed.data : {}) as { orderId?: unknown; token?: unknown };

  // Mismo mensaje para "link falso" y "pedido inexistente": no se le dice a un atacante cuál de las dos fue.
  if (typeof body.orderId !== "string" || !UUID_RE.test(body.orderId) || !verifyConfirm(body.orderId, body.token)) {
    return json({ error: "Link inválido." }, 403);
  }

  try {
    const status = await confirmTransfer(body.orderId.toLowerCase());
    if (status === "unknown_order") return json({ error: "Link inválido." }, 403);
    return json({ status });
  } catch (e) {
    if (e instanceof OutOfStockError) {
      return json({ status: "out_of_stock", error: "La reserva había vencido y ya no queda stock. Devolvele la plata al comprador." }, 409);
    }
    console.error("[admin/confirm-transfer]", e);
    return json({ error: "No pudimos confirmar el pago. Probá de nuevo." }, 502);
  }
}
