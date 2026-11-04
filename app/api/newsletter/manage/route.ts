import { db } from "@/lib/server/db";
import { allow } from "@/lib/server/ratelimit";
import { checkOrigin, clientIp, json, readJson } from "@/lib/server/security";

const TOKEN_RE = /^[0-9a-f]{64}$/;

/** Confirmar la suscripción o darse de baja, con el token del link del mail. */
export async function POST(req: Request) {
  const originError = checkOrigin(req);
  if (originError) return originError;

  const parsed = await readJson(req, 1_000);
  if ("error" in parsed) return parsed.error;
  const body = (parsed.data && typeof parsed.data === "object" ? parsed.data : {}) as Record<string, unknown>;

  const action = body.action;
  const token = body.token;
  if ((action !== "confirm" && action !== "unsubscribe") || typeof token !== "string" || !TOKEN_RE.test(token)) {
    return json({ result: "invalid" }, 400);
  }

  // El token tiene 256 bits (no se puede adivinar), pero igual se limita para que nadie pruebe a lo loco.
  try {
    if (!(await allow("newsletter-manage", clientIp(req), 30, 60 * 60))) return json({ error: "Demasiados intentos. Probá de nuevo más tarde." }, 429);
  } catch {
    return json({ error: "El servicio no está disponible en este momento. Probá de nuevo en un rato." }, 503);
  }

  const { data, error } = await db().rpc(action === "confirm" ? "newsletter_confirm" : "newsletter_unsubscribe", { p_token: token });
  if (error) {
    console.error("[newsletter/manage]", error.message);
    return json({ error: "No pudimos procesar tu pedido. Probá de nuevo en un rato." }, 502);
  }
  return json({ result: data }, data === "invalid" ? 404 : 200);
}
