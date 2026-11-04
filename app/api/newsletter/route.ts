import { randomBytes } from "node:crypto";
import { db } from "@/lib/server/db";
import { sendMail } from "@/lib/server/mail";
import { allow } from "@/lib/server/ratelimit";
import { checkOrigin, clientIp, json, readJson, siteUrl } from "@/lib/server/security";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Anotarse al aviso de drops.
 *  - Con MAIL_FROM (dominio verificado) hay doble opt-in: queda "pendiente" y se manda un mail para confirmar.
 *  - Sin MAIL_FROM no se pueden mandar mails a otras personas: queda confirmado pero SIN verificar (ver schema.sql).
 * La respuesta es idéntica exista o no el email: no se puede usar para averiguar quién está anotado.
 */
export async function POST(req: Request) {
  const originError = checkOrigin(req);
  if (originError) return originError;

  const parsed = await readJson(req, 2_000);
  if ("error" in parsed) return parsed.error;
  const body = (parsed.data && typeof parsed.data === "object" ? parsed.data : {}) as Record<string, unknown>;

  const doubleOptIn = Boolean(process.env.MAIL_FROM);

  // Campo trampa para bots: un humano no lo ve. Se responde "ok" sin guardar ni mandar nada.
  if (typeof body.website === "string" && body.website.trim()) return json({ ok: true, confirm: doubleOptIn });

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 120 || !EMAIL_RE.test(email)) return json({ error: "Revisá tu email." }, 422);

  // Este formulario puede mandar un mail a CUALQUIER dirección: sin límites sería un cañón de spam con tu marca.
  try {
    if (!(await allow("newsletter-ip", clientIp(req), 8, 60 * 60)) || !(await allow("newsletter-email", email, 3, 24 * 60 * 60))) {
      return json({ error: "Demasiados intentos. Probá de nuevo más tarde." }, 429);
    }
  } catch {
    return json({ error: "El servicio no está disponible en este momento. Probá de nuevo en un rato." }, 503);
  }

  const { data, error } = await db().rpc("newsletter_subscribe", {
    p_email: email,
    p_token: randomBytes(32).toString("hex"),
    p_double_optin: doubleOptIn,
  });
  if (error || !data) {
    console.error("[newsletter]", error?.message);
    return json({ error: "No pudimos anotarte. Probá de nuevo en un rato." }, 502);
  }

  // Solo se manda el mail de confirmación si está pendiente (si ya estaba confirmado no se molesta a nadie).
  const { status, token } = data as { status: string; token: string };
  if (doubleOptIn && status === "pending") {
    await sendMail({
      to: email,
      subject: "BYSLF — Confirmá tu email",
      text: `Hola,\n\nAlguien (esperamos que vos) anotó este email para recibir los avisos de los drops de BYSLF.\n\nPara confirmar, entrá a este link:\n${siteUrl()}/newsletter/confirmar?t=${token}\n\nSi no fuiste vos, ignorá este mail: no te vamos a escribir más.\n\nBYSLF`,
    });
  }

  return json({ ok: true, confirm: doubleOptIn });
}
