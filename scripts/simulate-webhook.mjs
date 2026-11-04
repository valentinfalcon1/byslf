// Avisa a tu sitio local que un pago se aprobó, como lo haría Mercado Pago. Sirve cuando NO tenés un túnel https.
//
//   node --env-file=.env.local scripts/simulate-webhook.mjs <payment_id> [urlDelSitio]
//
// El <payment_id> aparece en la barra de direcciones al volver de pagar:  /checkout/success?payment_id=123456789&...
// El sitio NO se cree lo que dice este aviso: consulta el pago REAL a Mercado Pago con tu token. Es decir,
// esto solo funciona si ese pago existe de verdad (aunque sea de prueba), igual que en producción.
import { createHmac, randomUUID } from "node:crypto";

const [paymentId, base = "http://localhost:3000"] = process.argv.slice(2);
if (!paymentId || !/^\d+$/.test(paymentId)) {
  console.error("Uso: node --env-file=.env.local scripts/simulate-webhook.mjs <payment_id> [urlDelSitio]\n(el payment_id son solo números)");
  process.exit(1);
}

const headers = { "Content-Type": "application/json", "x-request-id": randomUUID() };
const secret = process.env.MP_WEBHOOK_SECRET;
if (secret) {
  // Si definiste MP_WEBHOOK_SECRET el sitio exige la firma: se firma igual que lo hace Mercado Pago.
  const ts = String(Date.now());
  const v1 = createHmac("sha256", secret).update(`id:${paymentId};request-id:${headers["x-request-id"]};ts:${ts};`).digest("hex");
  headers["x-signature"] = `ts=${ts},v1=${v1}`;
}

const res = await fetch(`${base}/api/mercadopago/webhook?type=payment&data.id=${paymentId}`, {
  method: "POST",
  headers,
  body: JSON.stringify({ type: "payment", action: "payment.updated", data: { id: paymentId } }),
});

console.log(`Respuesta del sitio: ${res.status} ${res.status === 200 ? "(aceptado)" : res.status === 500 ? "(error: Mercado Pago no conoce ese pago, o falló algo; mirá la terminal del sitio)" : ""}`);
console.log("Ahora revisá: tu mail, y en Supabase las tablas orders (status = paid) y stock.");
process.exit(res.ok ? 0 : 1);
