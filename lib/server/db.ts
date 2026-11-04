import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Sin tipos generados de la base: las funciones SQL (rpc) se tipan a mano en lib/server/orders.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: SupabaseClient<any> | null = null;

/** Cliente con la service role key: solo existe en el servidor, nunca llega al navegador. */
export function db() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client = createClient<any>(url, key, { auth: { persistSession: false } });
  return client;
}
