import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, uuid } from "./helpers/fake-supabase";

let pg: PGlite;

beforeAll(async () => {
  ({ pg } = await createTestDb());
});

beforeEach(async () => {
  await pg.exec("truncate stock, orders, rate_limits, revocations, subscribers");
  await pg.exec("insert into stock values ('p1','Negro','M',3), ('p1','Negro','L',5)");
});

const SHIP = "ana@mail.com"; // lo que llega es el hash del email, nunca el email
const line = (qty: number, size = "M") => [{ slug: "p1", color: "Negro", size, qty }];

const reserve = (id: number, items = line(1), amount = 100, mins = 30, buyer: string = SHIP) =>
  pg.query("select reserve_order($1,$2::jsonb,$3,$4,$5,now())", [uuid(id), JSON.stringify(items), amount, mins, buyer]);
const confirm = async (id: number, pay: number, amount: number) =>
  ((await pg.query<{ r: string }>("select confirm_order($1,$2,$3) as r", [uuid(id), pay, amount])).rows[0].r);
const stock = async (size = "M") => (await pg.query<{ qty: number }>("select qty from stock where slug='p1' and size=$1", [size])).rows[0]?.qty;
const status = async (id: number) => (await pg.query<{ status: string }>("select status from orders where id=$1", [uuid(id)])).rows[0]?.status;

describe("reserva de stock", () => {
  it("descuenta stock y guarda pedido pendiente sin datos personales", async () => {
    await reserve(1, line(2));
    expect(await stock()).toBe(1);
    expect(await status(1)).toBe("pending");
    const cols = await pg.query<{ column_name: string }>("select column_name from information_schema.columns where table_name='orders'");
    expect(cols.rows.map((c) => c.column_name)).not.toContain("shipping");
  });

  it("rechaza la sobreventa sin tocar nada", async () => {
    await reserve(1, line(2));
    await expect(reserve(2, line(2), 100, 30, "otra")).rejects.toThrow(/out_of_stock:p1\|Negro\|M/);
    expect(await stock()).toBe(1);
    expect(await status(2)).toBeUndefined();
  });

  it("es atómica: si un ítem no alcanza, no descuenta ninguno", async () => {
    const mixed = [{ slug: "p1", color: "Negro", size: "L", qty: 1 }, { slug: "p1", color: "Negro", size: "M", qty: 5 }];
    await expect(reserve(1, mixed)).rejects.toThrow(/out_of_stock/);
    expect(await stock("L")).toBe(5);
    expect(await stock("M")).toBe(3);
  });

  it("una variante sin fila de stock no se puede comprar", async () => {
    await expect(reserve(1, [{ slug: "p1", color: "Slate", size: "M", qty: 1 }])).rejects.toThrow(/out_of_stock/);
  });

  it("el stock nunca queda negativo", async () => {
    await expect(pg.exec("update stock set qty = -1 where size = 'L'")).rejects.toThrow();
  });

  it("vender lo último deja el stock en 0 y el siguiente no puede comprar", async () => {
    await reserve(1, line(3));
    expect(await stock()).toBe(0);
    await expect(reserve(2, line(1), 100, 30, "otra")).rejects.toThrow(/out_of_stock/);
  });
});

describe("vencimiento y liberación", () => {
  it("una reserva vencida devuelve el stock en la próxima reserva", async () => {
    await reserve(1, line(2, "L"), 100, 0);
    expect(await stock("L")).toBe(3);
    await new Promise((r) => setTimeout(r, 30));
    await reserve(2, line(1, "L"), 100, 30, "otra");
    expect(await status(1)).toBe("expired");
    expect(await stock("L")).toBe(4); // 3 + 2 devueltos... − 1 reservado
  });

  it("release_order devuelve el stock una sola vez", async () => {
    await reserve(1, line(2));
    await pg.query("select release_order($1)", [uuid(1)]);
    expect(await stock()).toBe(3);
    await pg.query("select release_order($1)", [uuid(1)]);
    expect(await stock()).toBe(3);
  });
});

describe("confirmación de pago", () => {
  it("confirma un pago correcto, y es idempotente", async () => {
    await reserve(1);
    expect(await confirm(1, 111, 100)).toBe("paid");
    expect(await confirm(1, 111, 100)).toBe("already_paid");
    expect(await status(1)).toBe("paid");
  });

  it("detecta un SEGUNDO pago distinto para el mismo pedido (el cliente pagó dos veces)", async () => {
    await reserve(1);
    expect(await confirm(1, 111, 100)).toBe("paid");
    expect(await confirm(1, 222, 100)).toBe("duplicate_payment");
    expect(await confirm(1, 111, 100)).toBe("already_paid");
  });

  it("monto distinto → needs_review", async () => {
    await reserve(1);
    expect(await confirm(1, 111, 999)).toBe("needs_review");
  });

  it("pago tardío sobre una reserva vencida → needs_review", async () => {
    await reserve(1, line(1), 100, 0);
    await new Promise((r) => setTimeout(r, 30));
    await pg.query("select expire_pending()");
    expect(await confirm(1, 111, 100)).toBe("needs_review");
  });

  it("pedido inexistente", async () => {
    expect(await confirm(99, 1, 1)).toBe("unknown_order");
  });
});

describe("transferencia", () => {
  const reserveT = (id: number, items = line(1), amount = 100, mins = 1440, buyer = "ana") =>
    pg.query("select reserve_order($1,$2::jsonb,$3,$4,$5,now(),'transfer')", [uuid(id), JSON.stringify(items), amount, mins, buyer]);
  const notice = async (id: number) => (await pg.query<{ r: string }>("select mark_transfer_notified($1) as r", [uuid(id)])).rows[0].r;
  const confirmT = async (id: number) => (await pg.query<{ r: string }>("select confirm_transfer($1) as r", [uuid(id)])).rows[0].r;
  const expire = async (id: number) => {
    await pg.query("update orders set expires_at = now() - interval '1 minute' where id = $1", [uuid(id)]);
    await pg.query("select expire_pending()");
  };

  it("la reserva descuenta stock, queda como transferencia y dura lo que se pidió", async () => {
    await reserveT(1, line(2));
    expect(await stock()).toBe(1);
    const r = await pg.query<{ method: string; hours: number }>("select method, extract(epoch from (expires_at - now()))/3600 as hours from orders where id=$1", [uuid(1)]);
    expect(r.rows[0].method).toBe("transfer");
    expect(Number(r.rows[0].hours)).toBeGreaterThan(23.9);
  });

  it("los pedidos de Mercado Pago siguen siendo 'mp' por defecto", async () => {
    await reserve(1);
    expect((await pg.query<{ method: string }>("select method from orders where id=$1", [uuid(1)])).rows[0].method).toBe("mp");
  });

  it("el aviso del comprador se registra UNA sola vez (solo la primera hay que mandar el mail)", async () => {
    await reserveT(1);
    expect(await notice(1)).toBe("notified");
    expect(await notice(1)).toBe("already_notified");
    expect(await notice(1)).toBe("already_notified");
  });

  it("no se puede avisar de un pedido inexistente, de Mercado Pago o vencido", async () => {
    expect(await notice(99)).toBe("unknown_order");
    await reserve(2);
    expect(await notice(2)).toBe("unknown_order");
    await reserveT(3);
    await expire(3);
    expect(await notice(3)).toBe("expired");
  });

  it("reset_transfer_notice permite reintentar si el mail no salió", async () => {
    await reserveT(1);
    expect(await notice(1)).toBe("notified");
    await pg.query("select reset_transfer_notice($1)", [uuid(1)]);
    expect(await notice(1)).toBe("notified");
  });

  it("confirm_transfer deja el pedido pagado, es idempotente y no toca el stock", async () => {
    await reserveT(1, line(2));
    expect(await confirmT(1)).toBe("paid");
    expect(await confirmT(1)).toBe("already_paid");
    expect(await status(1)).toBe("paid");
    expect(await stock()).toBe(1);
  });

  it("confirm_transfer no sirve para pedidos de Mercado Pago ni inexistentes", async () => {
    await reserve(1);
    expect(await confirmT(1)).toBe("unknown_order");
    expect(await status(1)).toBe("pending");
    expect(await confirmT(99)).toBe("unknown_order");
  });

  it("si venció la reserva pero hay stock, al confirmar se vuelve a descontar", async () => {
    await reserveT(1, line(2));
    await expire(1);
    expect(await status(1)).toBe("expired");
    expect(await stock()).toBe(3);
    expect(await confirmT(1)).toBe("paid");
    expect(await stock()).toBe(1);
  });

  it("si venció y ya no queda stock, falla entero sin cambiar nada (hay que devolver la plata)", async () => {
    await reserveT(1, line(2));
    await expire(1);
    await reserve(2, line(2), 100, 30, "otra"); // otro se llevó el stock
    expect(await stock()).toBe(1);
    await expect(confirmT(1)).rejects.toThrow(/out_of_stock/);
    expect(await status(1)).toBe("expired");
    expect(await stock()).toBe(1);
  });
});

describe("antiabuso", () => {
  it("un mismo email no puede retener stock con más de 3 reservas pendientes", async () => {
    for (const n of [1, 2, 3]) await reserve(n, line(1), 100, 30, "abuso");
    expect(await stock()).toBe(0);
    await expect(reserve(4, line(1), 100, 30, "abuso")).rejects.toThrow(/too_many_pending/);
    await pg.exec("update stock set qty = 5 where size = 'M'");
    await reserve(5, line(1), 100, 30, "otro"); // otro email sí puede
  });

  it("rate_limit_hit deja pasar hasta el límite y corta después", async () => {
    const hit = async (key: string) => (await pg.query<{ r: boolean }>("select rate_limit_hit($1, 3, 60) as r", [key])).rows[0].r;
    expect([await hit("a"), await hit("a"), await hit("a"), await hit("a")]).toEqual([true, true, true, false]);
    expect(await hit("b")).toBe(true); // otra clave: independiente
  });

  it("rate_limit_hit se reinicia al terminar la ventana", async () => {
    const hit = async () => (await pg.query<{ r: boolean }>("select rate_limit_hit('c', 1, 1) as r")).rows[0].r;
    expect(await hit()).toBe(true);
    expect(await hit()).toBe(false);
    await new Promise((r) => setTimeout(r, 1100));
    expect(await hit()).toBe(true);
  });
});

describe("seguridad del esquema", () => {
  it("todas las tablas tienen RLS activado (el navegador no accede a nada)", async () => {
    const r = await pg.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname, relrowsecurity from pg_class where relname in ('stock','orders','revocations','rate_limits','subscribers')",
    );
    expect(r.rows).toHaveLength(5);
    for (const t of r.rows) expect(t.relrowsecurity, t.relname).toBe(true);
  });

  it("anon y authenticated no pueden ejecutar las funciones", async () => {
    const r = await pg.query<{ proname: string; anon: boolean; auth: boolean }>(
      `select proname,
              has_function_privilege('anon', oid, 'execute') as anon,
              has_function_privilege('authenticated', oid, 'execute') as auth
         from pg_proc where proname in ('reserve_order','release_order','confirm_order','expire_pending','_release','rate_limit_hit','newsletter_subscribe','newsletter_confirm','newsletter_unsubscribe','mark_transfer_notified','confirm_transfer','reset_transfer_notice')`,
    );
    expect(r.rows.length).toBeGreaterThanOrEqual(12);
    for (const f of r.rows) {
      expect(f.anon, `${f.proname} anon`).toBe(false);
      expect(f.auth, `${f.proname} authenticated`).toBe(false);
    }
  });

  it("el esquema se puede aplicar dos veces (migración segura)", async () => {
    const { readFileSync } = await import("node:fs");
    await expect(pg.exec(readFileSync("supabase/schema.sql", "utf8"))).resolves.not.toThrow();
  });
});

describe("newsletter", () => {
  const tok = (n: number) => String(n).padStart(64, "0");
  const subscribe = async (email: string, token = tok(1), doubleOptIn = true) =>
    (await pg.query<{ r: { status: string; token: string } }>("select newsletter_subscribe($1,$2,$3) as r", [email, token, doubleOptIn])).rows[0].r;
  const confirmN = async (t: string) => (await pg.query<{ r: string }>("select newsletter_confirm($1) as r", [t])).rows[0].r;
  const unsub = async (t: string) => (await pg.query<{ r: string }>("select newsletter_unsubscribe($1) as r", [t])).rows[0].r;
  const row = async (email: string) => (await pg.query<{ status: string; email_verified: boolean }>("select status, email_verified from subscribers where email=$1", [email])).rows[0];

  beforeEach(async () => {
    await pg.exec("truncate subscribers");
  });

  it("con doble opt-in entra como pendiente y sin verificar", async () => {
    expect(await subscribe("Ana@Mail.com ")).toEqual({ status: "pending", token: tok(1) });
    expect(await row("ana@mail.com")).toEqual({ status: "pending", email_verified: false }); // guardado en minúsculas y sin espacios
  });

  it("confirmar con el link la activa y la verifica; confirmar de nuevo es inofensivo", async () => {
    await subscribe("ana@mail.com");
    expect(await confirmN(tok(1))).toBe("confirmed");
    expect(await row("ana@mail.com")).toEqual({ status: "confirmed", email_verified: true });
    expect(await confirmN(tok(1))).toBe("already");
  });

  it("un token inventado no hace nada", async () => {
    await subscribe("ana@mail.com");
    expect(await confirmN(tok(99))).toBe("invalid");
    expect(await unsub(tok(99))).toBe("invalid");
    expect((await row("ana@mail.com")).status).toBe("pending");
  });

  it("anotarse dos veces NO duplica ni cambia el token (y no revela nada)", async () => {
    await subscribe("ana@mail.com", tok(1));
    const again = await subscribe("ANA@mail.com", tok(2));
    expect(again.token).toBe(tok(1)); // sigue el token original
    expect((await pg.query("select 1 from subscribers")).rows).toHaveLength(1);
  });

  it("anotarse de nuevo estando confirmado no lo baja a pendiente", async () => {
    await subscribe("ana@mail.com");
    await confirmN(tok(1));
    expect((await subscribe("ana@mail.com", tok(2))).status).toBe("confirmed");
  });

  it("sin dominio (sin doble opt-in) queda confirmado pero SIN verificar", async () => {
    expect((await subscribe("ana@mail.com", tok(1), false)).status).toBe("confirmed");
    expect(await row("ana@mail.com")).toEqual({ status: "confirmed", email_verified: false });
  });

  it("darse de baja funciona desde cualquier estado y es idempotente", async () => {
    await subscribe("ana@mail.com");
    expect(await unsub(tok(1))).toBe("unsubscribed");
    expect(await unsub(tok(1))).toBe("already");
    expect((await row("ana@mail.com")).status).toBe("unsubscribed");
  });

  it("el link de confirmación NO reactiva a alguien que se dio de baja", async () => {
    await subscribe("ana@mail.com");
    await unsub(tok(1));
    expect(await confirmN(tok(1))).toBe("already");
    expect((await row("ana@mail.com")).status).toBe("unsubscribed");
  });

  it("quien se dio de baja puede volver a anotarse, y arranca de cero (pendiente)", async () => {
    await subscribe("ana@mail.com");
    await confirmN(tok(1));
    await unsub(tok(1));
    expect((await subscribe("ana@mail.com", tok(2))).status).toBe("pending");
    expect((await row("ana@mail.com")).email_verified).toBe(false);
  });

  it("dos emails no pueden compartir token", async () => {
    await subscribe("a@mail.com", tok(1));
    await expect(subscribe("b@mail.com", tok(1))).rejects.toThrow();
  });
});
