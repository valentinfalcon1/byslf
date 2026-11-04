import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Respuesta JSON que nunca se guarda en caché (hay datos de personas). */
export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const siteUrl = () => process.env.SITE_URL ?? "http://localhost:3000";

/**
 * Rechaza peticiones que vienen de OTRO sitio web (CSRF). Un navegador siempre manda `Origin` en un POST;
 * sin ese header la petición no viene de un navegador, así que no puede aprovecharse de la sesión de nadie.
 */
export function checkOrigin(req: Request): Response | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  const allowed = new Set([new URL(req.url).origin, new URL(siteUrl()).origin]);
  return allowed.has(origin) ? null : json({ error: "Origen no permitido." }, 403);
}

/** Lee el cuerpo JSON exigiendo el tipo de contenido correcto y un tamaño máximo. */
export async function readJson(req: Request, maxBytes = 20_000): Promise<{ data: unknown } | { error: Response }> {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return { error: json({ error: "Tipo de contenido no soportado." }, 415) };
  }
  if (Number(req.headers.get("content-length") ?? 0) > maxBytes) return { error: json({ error: "Solicitud demasiado grande." }, 413) };
  const text = await req.text();
  if (text.length > maxBytes) return { error: json({ error: "Solicitud demasiado grande." }, 413) };
  try {
    return { data: JSON.parse(text) };
  } catch {
    return { error: json({ error: "Solicitud inválida." }, 400) };
  }
}

/**
 * IP del cliente. OJO: confía en `x-forwarded-for`, que SOLO es confiable detrás de una plataforma que lo
 * sobrescribe (ej. Vercel). Si se aloja en un servidor propio sin proxy, un atacante puede falsearla.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Hash para no guardar IPs ni emails en claro en la tabla de límites. */
export const hashKey = (s: string) => createHash("sha256").update(s.toLowerCase()).digest("hex").slice(0, 32);

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Firma `x-signature` de los avisos de Mercado Pago (HMAC-SHA256 con la clave secreta de la aplicación).
 * Formato del mensaje según la documentación de MP: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`.
 */
export function verifyMpSignature(req: Request, dataId: string, secret: string): boolean {
  const header = req.headers.get("x-signature") ?? "";
  const parts = new Map(header.split(",").map((p) => p.trim().split("=") as [string, string]));
  const ts = parts.get("ts");
  const v1 = parts.get("v1");
  if (!ts || !v1) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${req.headers.get("x-request-id") ?? ""};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
