import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/**
 * Base Postgres real (en memoria) con el esquema de supabase/schema.sql, más un cliente que imita
 * la parte de supabase-js que usa la app (rpc, select/eq/maybeSingle, insert). Así las pruebas ejercitan
 * el SQL de verdad y el código real de lib/server, sin tocar un proyecto de Supabase.
 */
export async function createTestDb() {
  const pg = new PGlite();
  await pg.exec("create role anon; create role authenticated;"); // roles que Supabase ya trae
  await pg.exec(readFileSync("supabase/schema.sql", "utf8"));

  const isObj = (v: unknown) => v !== null && typeof v === "object";

  const client = {
    async rpc(name: string, args: Record<string, unknown> = {}) {
      const keys = Object.keys(args);
      const params = keys.map((k, i) => `${k} => $${i + 1}${isObj(args[k]) ? "::jsonb" : ""}`).join(", ");
      try {
        const r = await pg.query<{ r: unknown }>(`select ${name}(${params}) as r`, keys.map((k) => (isObj(args[k]) ? JSON.stringify(args[k]) : args[k])));
        const v = r.rows[0]?.r;
        return { data: v === "" ? null : (v ?? null), error: null };
      } catch (e) {
        return { data: null, error: { message: (e as Error).message } };
      }
    },
    from(table: string) {
      return {
        select(_cols = "*") {
          const cond: [string, unknown][] = [];
          const b = {
            eq(col: string, val: unknown) {
              cond.push([col, val]);
              return b;
            },
            async maybeSingle() {
              const where = cond.map(([c], i) => `${c} = $${i + 1}`).join(" and ");
              const r = await pg.query(`select * from ${table}${where ? ` where ${where}` : ""} limit 1`, cond.map(([, v]) => v));
              return { data: r.rows[0] ?? null, error: null };
            },
          };
          return b;
        },
        async insert(row: Record<string, unknown>) {
          const keys = Object.keys(row);
          try {
            await pg.query(`insert into ${table} (${keys.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")})`, keys.map((k) => row[k]));
            return { error: null };
          } catch (e) {
            return { error: { message: (e as Error).message } };
          }
        },
      };
    },
  };

  return { pg, client };
}

export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
