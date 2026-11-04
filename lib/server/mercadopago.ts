import "server-only";

const API = "https://api.mercadopago.com";

function token() {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) throw new Error("Falta MP_ACCESS_TOKEN en .env.local");
  return t;
}

export type PreferenceItem = { id: string; title: string; quantity: number; unit_price: number; currency_id: "ARS" };

export async function createPreference(input: {
  items: PreferenceItem[];
  orderId: string;
  siteUrl: string;
  metadata: Record<string, unknown>;
  /** Cuándo vence el link de pago; debe coincidir con la reserva de stock. */
  expiresAt: Date;
  payer: { name: string; lastname: string; email: string };
}): Promise<{ id: string; init_point: string }> {
  const https = input.siteUrl.startsWith("https://");
  // En producción SITE_URL tiene que estar bien puesta (https): si no, el cliente volvería a una dirección equivocada.
  if (process.env.NODE_ENV === "production" && !https) throw new Error("SITE_URL debe ser una URL https en producción");
  const res = await fetch(`${API}/checkout/preferences`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", "X-Idempotency-Key": input.orderId },
    body: JSON.stringify({
      items: input.items,
      external_reference: input.orderId,
      statement_descriptor: "BYSLF",
      payer: { name: input.payer.name, surname: input.payer.lastname, email: input.payer.email },
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: input.expiresAt.toISOString(),
      back_urls: {
        success: `${input.siteUrl}/checkout/success`,
        pending: `${input.siteUrl}/checkout/pending`,
        failure: `${input.siteUrl}/checkout/failure`,
      },
      // MP exige https en back_urls para auto_return, y una URL pública para el webhook.
      ...(https && { auto_return: "approved", notification_url: `${input.siteUrl}/api/mercadopago/webhook` }),
      metadata: input.metadata,
    }),
  });
  if (!res.ok) throw new Error(`Mercado Pago ${res.status}: ${await res.text()}`);
  const pref = (await res.json()) as { id: string; init_point: string };
  // Defensa en profundidad: al cliente solo se lo manda a un dominio de Mercado Pago.
  const u = new URL(pref.init_point);
  if (u.protocol !== "https:" || !/(^|\.)mercadopago\.com(\.[a-z]{2})?$/.test(u.hostname)) {
    throw new Error("Mercado Pago devolvió un link de pago con un dominio inesperado");
  }
  return pref;
}

export type MpPayment = {
  id: number;
  status: string;
  external_reference: string | null;
  transaction_amount: number;
  currency_id: string;
  metadata?: Record<string, unknown>;
};

/** Fuente de verdad del estado de un pago: se consulta a MP, no se confía en el aviso recibido. */
export async function getPayment(id: string): Promise<MpPayment> {
  const res = await fetch(`${API}/v1/payments/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error(`Mercado Pago ${res.status}: ${await res.text()}`);
  return res.json();
}
