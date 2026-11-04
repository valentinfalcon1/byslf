import "server-only";

/**
 * Envío de mails con Resend (https://resend.com), por HTTP, sin dependencias.
 * Si no hay RESEND_API_KEY, no envía y lo deja en el log: la venta o el trámite NUNCA fallan por un mail.
 * Remitente por defecto: onboarding@resend.dev, que solo puede enviar al mail con el que te registraste en Resend
 * (sirve para avisarte a vos). Para escribirle a clientes hace falta verificar un dominio y definir MAIL_FROM.
 */
export async function sendMail(input: { to: string; subject: string; text: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[mail] RESEND_API_KEY no configurada: no se envió", { subject: input.subject });
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.MAIL_FROM ?? "BYSLF <onboarding@resend.dev>",
        to: [input.to],
        subject: input.subject,
        text: input.text, // solo texto plano: no hay HTML que inyectar con datos del comprador
      }),
    });
    if (!res.ok) {
      console.error("[mail] falló el envío", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[mail] error", e);
    return false;
  }
}

/** Mail al dueño de la tienda. */
export function notifyOwner(subject: string, text: string) {
  const to = process.env.ORDER_NOTIFY_EMAIL;
  if (!to) {
    console.warn("[mail] ORDER_NOTIFY_EMAIL no configurada: no se envió", { subject });
    return Promise.resolve(false);
  }
  return sendMail({ to, subject, text });
}
