import { randomBytes } from "node:crypto";
import { db } from "@/lib/server/db";
import { notifyOwner, sendMail } from "@/lib/server/mail";
import { allow } from "@/lib/server/ratelimit";
import { checkOrigin, clientIp, json, readJson } from "@/lib/server/security";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I/L para que se pueda dictar sin errores
const makeCode = () => "ARR-" + Array.from(randomBytes(8), (b) => ALPHABET[b % ALPHABET.length]).join("");

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  const originError = checkOrigin(req);
  if (originError) return originError;

  const parsed = await readJson(req);
  if ("error" in parsed) return parsed.error;
  const body = (parsed.data && typeof parsed.data === "object" ? parsed.data : {}) as Record<string, unknown>;

  // Campo trampa para bots: un humano no lo ve ni lo completa. Se responde "ok" sin guardar ni mandar nada.
  if (str(body.website, 100)) return json({ code: makeCode() });

  const name = str(body.name, 100);
  const email = str(body.email, 120);
  const orderRef = str(body.orderRef, 80);
  const details = str(body.details, 1000);
  if (!name) return json({ error: "Ingresá tu nombre." }, 422);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Revisá tu email." }, 422);

  // Antiabuso: este formulario manda mails (a vos y, si hay dominio, al email que se escriba acá).
  // Sin límite sería un cañón de spam usando tu marca. Por IP y por destinatario.
  const tooMany = json({ error: "Demasiados intentos. Probá de nuevo más tarde o escribinos por mail." }, 429);
  try {
    if (!(await allow("revocation-ip", clientIp(req), 5, 60 * 60))) return tooMany;
    if (!(await allow("revocation-email", email, 2, 60 * 60))) return tooMany;
  } catch {
    return json({ error: "El servicio no está disponible en este momento. Escribinos por mail." }, 503);
  }

  const code = makeCode();
  try {
    const { error } = await db().from("revocations").insert({ code, name, email, order_ref: orderRef || null, details: details || null });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("[arrepentimiento]", e);
    return json({ error: "No pudimos registrar tu pedido. Escribinos por mail." }, 502);
  }

  // Avisos: nunca hacen fallar el trámite. El código se muestra en pantalla de todos modos.
  await notifyOwner(
    `Pedido de arrepentimiento ${code}`,
    `Nuevo pedido de arrepentimiento (hay que responder dentro de las 24 hs).\n\nCódigo: ${code}\nNombre: ${name}\nEmail: ${email}\nPedido: ${orderRef || "-"}\nDetalle: ${details || "-"}`,
  );
  if (process.env.MAIL_FROM) {
    await sendMail({
      to: email,
      subject: `BYSLF — Recibimos tu pedido de arrepentimiento (${code})`,
      text: `Hola ${name},\n\nRecibimos tu solicitud de arrepentimiento.\nTu código de identificación es: ${code}\n\nNos vamos a comunicar con vos para coordinar la devolución.\n\nBYSLF`,
    });
  }

  return json({ code });
}
