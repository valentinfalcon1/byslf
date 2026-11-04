import "server-only";
import { db } from "./db";
import { hashKey } from "./security";

/**
 * Cuenta un intento y dice si está dentro del límite. Se apoya en la base (hay que correr supabase/schema.sql).
 * Si la base falla, lanza RateLimitUnavailableError y la ruta responde 503 (falla cerrado): estas rutas protegen stock y mails, mejor negar que dejar pasar todo.
 */
export class RateLimitUnavailableError extends Error {}

export async function allow(name: string, subject: string, limit: number, windowSeconds: number): Promise<boolean> {
  let result;
  try {
    result = await db().rpc("rate_limit_hit", {
      p_key: `${name}:${hashKey(subject)}`,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
  } catch (e) {
    console.error("[ratelimit] base no configurada", e);
    throw new RateLimitUnavailableError();
  }
  if (result.error) {
    console.error("[ratelimit]", result.error.message);
    throw new RateLimitUnavailableError();
  }
  return result.data === true;
}
