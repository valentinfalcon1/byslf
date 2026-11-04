import { getPayment } from "@/lib/server/mercadopago";
import { recordApprovedPayment } from "@/lib/server/orders";
import { UUID_RE, verifyMpSignature } from "@/lib/server/security";

const ok = () => new Response(null, { status: 200 });

/**
 * Aviso de Mercado Pago. No se confía en el contenido del aviso: solo se toma el id del pago
 * y se consulta el pago real a la API de MP (con nuestro token). Un aviso falso, como mucho, dispara una consulta.
 * Si MP_WEBHOOK_SECRET está definida, además se exige la firma `x-signature`.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = (await req.json().catch(() => null)) as { type?: string; data?: { id?: string | number } } | null;
  const type = url.searchParams.get("type") ?? body?.type;
  const id = url.searchParams.get("data.id") ?? (body?.data?.id !== undefined ? String(body.data.id) : null);

  if (type !== "payment" || !id) return ok(); // otros temas: se ignoran
  if (!/^\d{1,20}$/.test(id)) return ok(); // el id de un pago es numérico: cualquier otra cosa no es de MP

  const secret = process.env.MP_WEBHOOK_SECRET;
  if (secret && !verifyMpSignature(req, id, secret)) {
    console.warn("[webhook] firma inválida: se descarta el aviso");
    return new Response(null, { status: 401 });
  }

  try {
    const payment = await getPayment(id);
    // Solo pagos de ESTA web (nuestra referencia es un UUID); un pago ajeno de la misma cuenta se ignora con 200
    // para que MP no reintente para siempre.
    if (payment.status === "approved" && payment.currency_id === "ARS" && payment.external_reference && UUID_RE.test(payment.external_reference)) {
      await recordApprovedPayment(payment);
    }
    return ok();
  } catch (e) {
    console.error("[webhook]", e);
    return new Response(null, { status: 500 }); // MP reintenta
  }
}
