/**
 * Flujo de compra de punta a punta, con el código real del servidor y una base Postgres real en memoria.
 * Solo se simulan las APIs externas (Mercado Pago y Resend).
 */
import { createHmac } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "./helpers/fake-supabase";

type Handler = (req: Request) => Promise<Response>;
const holder = globalThis as unknown as { __testClient: unknown };
vi.mock("@/lib/server/db", () => ({ db: () => holder.__testClient }));

let pg: PGlite;
let checkout: Handler;
let webhook: Handler;
let revocation: Handler;
let transferNotify: Handler;
let adminConfirm: Handler;

// ---- Mercado Pago y Resend simulados ----
type Call = { url: string; body?: any };
let calls: Call[] = [];
let payments: Record<string, unknown> = {};
let failPreference = false;
let failMail = false;

const mails = () => calls.filter((c) => c.url === "https://api.resend.com/emails").map((c) => c.body);
const preferences = () => calls.filter((c) => c.url.endsWith("/checkout/preferences")).map((c) => c.body);

beforeAll(async () => {
  const db = await createTestDb();
  pg = db.pg;
  holder.__testClient = db.client;
  process.env.MP_ACCESS_TOKEN = "TEST-token";
  process.env.SITE_URL = "https://tienda.test";
  process.env.ORDER_NOTIFY_EMAIL = "duena@mail.com";
  process.env.RESEND_API_KEY = "re_test";
  process.env.DEV_TEST_PRICE = "1000";
  checkout = (await import("@/app/api/checkout/route")).POST;
  webhook = (await import("@/app/api/mercadopago/webhook/route")).POST;
  revocation = (await import("@/app/api/arrepentimiento/route")).POST;
  transferNotify = (await import("@/app/api/checkout/transfer/notify/route")).POST;
  adminConfirm = (await import("@/app/api/admin/confirm-transfer/route")).POST;
  process.env.ADMIN_LINK_SECRET = "secreto-de-prueba-0123456789-abcdefghijklmnop";
});

beforeEach(async () => {
  await pg.exec("truncate stock, orders, rate_limits, revocations");
  await pg.exec("insert into stock values ('producto-01','Negro','M',3), ('producto-01','Negro','L',5)");
  calls = [];
  payments = {};
  failPreference = false;
  failMail = false;
  delete process.env.MP_WEBHOOK_SECRET;
  delete process.env.MAIL_FROM;
  process.env.RESEND_API_KEY = "re_test";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, body });
      if (url === "https://api.mercadopago.com/checkout/preferences") {
        return failPreference
          ? new Response("error de mp", { status: 500 })
          : Response.json({ id: "pref-1", init_point: "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-1" });
      }
      if (url.startsWith("https://api.mercadopago.com/v1/payments/")) {
        const p = payments[url.split("/").pop()!];
        return p ? Response.json(p) : new Response("{}", { status: 404 });
      }
      if (url === "https://api.resend.com/emails") return failMail ? new Response("caído", { status: 500 }) : Response.json({ id: "mail-1" });
      throw new Error(`fetch inesperado: ${url}`);
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

// ---- ayudantes ----
let ipCounter = 0;
const nextIp = () => `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;
const SHIPPING = {
  name: "Ana", lastname: "Pérez", email: "ana@mail.com", areaCode: "351", phone: "5551234", dni: "30123456",
  street: "Colón", number: "100", floor: "3B", city: "Córdoba", province: "Córdoba", zip: "5000", notes: "Timbre roto, golpear",
};

function buy(over: { items?: unknown; shipping?: object; terms?: unknown; payment?: unknown; ip?: string; headers?: Record<string, string>; raw?: string } = {}) {
  const body =
    over.raw ??
    JSON.stringify({
      items: over.items ?? [{ slug: "producto-01", color: "Negro", size: "M", qty: 1 }],
      shipping: { ...SHIPPING, ...over.shipping },
      acceptedTerms: over.terms ?? true,
      ...(over.payment !== undefined && { payment: over.payment }),
    });
  return checkout(
    new Request("https://tienda.test/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://tienda.test", "x-forwarded-for": over.ip ?? nextIp(), ...over.headers },
      body,
    }),
  );
}

const notify = (id: string | number, extra = "") =>
  webhook(new Request(`https://tienda.test/api/mercadopago/webhook?type=payment&data.id=${id}${extra}`, { method: "POST" }));

const stockOf = async (size = "M") => (await pg.query<{ qty: number }>("select qty from stock where slug='producto-01' and size=$1", [size])).rows[0].qty;
const orders = async () => (await pg.query<{ id: string; status: string; amount: string; buyer_key: string; terms_accepted_at: string; items: unknown[] }>("select * from orders")).rows;
// Mercado Pago copia el metadata de la preferencia al pago: se imita eso (de ahí sale el envío para el mail).
const approve = (id: number, orderId: string, amount = 1000) => {
  const pref = preferences().find((p) => p.external_reference === orderId);
  return (payments[id] = { id, status: "approved", currency_id: "ARS", external_reference: orderId, transaction_amount: amount, metadata: pref?.metadata });
};

// =====================================================================================

describe("compra completa", () => {
  it("reserva stock, crea el pago en Mercado Pago y, al aprobarse, confirma el pedido y te manda el mail", async () => {
    // 1) El cliente toca "Ir a pagar"
    const res = await buy({ items: [{ slug: "producto-01", color: "Negro", size: "M", qty: 2, price: 1 }] }); // price:1 = intento de trampa
    expect(res.status).toBe(200);
    const { url } = await res.json();
    expect(url).toMatch(/^https:\/\/www\.mercadopago\.com\.ar\//);

    // 2) Se descontó el stock y quedó un pedido pendiente con los datos de envío
    expect(await stockOf()).toBe(1);
    const [order] = await orders();
    expect(order.status).toBe("pending");
    expect(order.terms_accepted_at).toBeTruthy(); // quedó registrada la aceptación de términos
    // NINGÚN dato personal quedó en la base: ni en columnas ni en ningún valor de la fila
    expect(JSON.stringify(order)).not.toMatch(/Ana|Pérez|ana@mail|Colón|30123456|5551234|5000|Timbre/);
    expect(order.buyer_key).toMatch(/^[0-9a-f]{32}$/); // solo un hash del email
    expect(Number(order.amount)).toBe(2000);

    // 3) El pago se creó con el PRECIO DEL SERVIDOR (no el del navegador) y vinculado al pedido
    const [pref] = preferences();
    expect(pref.items[0]).toMatchObject({ quantity: 2, unit_price: 1000, currency_id: "ARS" });
    expect(pref.external_reference).toBe(order.id);
    expect(pref.payer).toMatchObject({ email: "ana@mail.com", name: "Ana", surname: "Pérez" });
    expect(pref.notification_url).toBe("https://tienda.test/api/mercadopago/webhook");
    expect(pref.expires).toBe(true);

    // 4) Todavía no hay mail de venta (no pagó)
    expect(mails()).toHaveLength(0);

    // 5) Mercado Pago avisa que se aprobó el pago
    approve(555, order.id, 2000);
    expect((await notify(555)).status).toBe(200);

    // 6) El pedido queda pagado y el stock sigue descontado
    expect((await orders())[0].status).toBe("paid");
    expect(await stockOf()).toBe(1);

    // 7) Te llegó UN mail a tu cuenta con todo lo necesario para despachar
    expect(mails()).toHaveLength(1);
    const [mail] = mails();
    expect(mail.to).toEqual(["duena@mail.com"]);
    expect(mail.subject).toContain("Nueva venta");
    for (const dato of ["Ana Pérez", "ana@mail.com", "Cód. área (sin 0): 351", "Celular: 5551234", "30123456", "Colón 100, 3B", "Provincia: Córdoba", "Localidad: Córdoba", "CP (CPA): 5000", "Timbre roto", "Byslf patch negra", "Negro", "Talle M", "x2", "555", order.id]) {
      expect(mail.text, `el mail debería incluir "${dato}"`).toContain(dato);
    }
    expect(mail).not.toHaveProperty("html"); // solo texto plano
  });

  it("si Mercado Pago avisa dos veces lo mismo, no se duplica el mail ni se toca el stock", async () => {
    await buy();
    const [order] = await orders();
    approve(1, order.id);
    await notify(1);
    await notify(1);
    await notify(1);
    expect(mails()).toHaveLength(1);
    expect(await stockOf()).toBe(2);
    expect((await orders())[0].status).toBe("paid");
  });

  it("si el cliente paga DOS veces el mismo pedido, te llega un mail de alerta para devolver uno", async () => {
    await buy();
    const [order] = await orders();
    approve(1, order.id);
    approve(2, order.id);
    await notify(1);
    await notify(2);
    expect(mails()).toHaveLength(2);
    expect(mails()[1].subject).toContain("PAGO DUPLICADO");
    expect(mails()[1].text).toContain("DOS VECES");
  });

  it("si el monto pagado no coincide, el pedido va a revisión y te avisa con ⚠", async () => {
    await buy();
    const [order] = await orders();
    approve(1, order.id, 1); // pagó $1 en vez de $1000
    await notify(1);
    expect((await orders())[0].status).toBe("needs_review");
    expect(mails()[0].subject).toContain("REVISAR");
  });

  it("un mail caído NO rompe la venta: el webhook responde 200 y el pedido queda pagado", async () => {
    await buy();
    const [order] = await orders();
    failMail = true;
    approve(1, order.id);
    expect((await notify(1)).status).toBe(200);
    expect((await orders())[0].status).toBe("paid");
  });

  it("sin clave de mails configurada, la venta igual se confirma", async () => {
    await buy();
    const [order] = await orders();
    delete process.env.RESEND_API_KEY;
    approve(1, order.id);
    expect((await notify(1)).status).toBe(200);
    expect((await orders())[0].status).toBe("paid");
    expect(mails()).toHaveLength(0);
  });
});

describe("stock", () => {
  describe("costo de envío", () => {
    const FAR = { province: "Salta", city: "Salta", zip: "4400" };
    const NO_RATE = { province: "Córdoba", city: "Villa María", zip: "5900" }; // resto de Córdoba: todavía sin tarifa
    const lines = (n: number) => Array.from({ length: n }, () => ({ slug: "producto-01", color: "Negro", size: "L", qty: 10 }));

    it("en Córdoba capital el envío es gratis: no se agrega ningún ítem de envío", async () => {
      const res = await buy();
      expect(res.status).toBe(200);
      const [pref] = preferences();
      expect(pref.items.map((i: { id: string }) => i.id)).not.toContain("envio");
      expect(pref.metadata.shipping_cost).toBe(0);
    });

    it("al resto de la provincia de Córdoba (no capital) NO se envía gratis: sin tarifa, no se reserva nada", async () => {
      const res = await buy({ shipping: { city: "Río Cuarto", zip: "5800" } });
      expect(res.status).toBe(422);
      expect(await stockOf()).toBe(3);
      expect(await orders()).toHaveLength(0);
    });

    it("no se puede hacer pasar un envío por capital poniendo otra localidad con código postal del interior", async () => {
      const res = await buy({ shipping: { city: "Córdoba", zip: "5900" } });
      expect(res.status).toBe(422);
    });

    it("a una zona sin tarifa definida no se cobra ni se reserva stock (y se ofrece el retiro)", async () => {
      const res = await buy({ shipping: NO_RATE });
      expect(res.status).toBe(422);
      expect((await res.json()).error).toContain("retiro");
      expect(await stockOf()).toBe(3);
      expect(await orders()).toHaveLength(0);
      expect(preferences()).toHaveLength(0);
    });

    it("con retiro se puede comprar desde cualquier provincia, sin dirección, y el mail lo avisa", async () => {
      const res = await buy({ shipping: { method: "pickup", street: "", number: "", floor: "", city: "", zip: "", province: "" } });
      expect(res.status).toBe(200);
      const [order] = await orders();
      approve(1, order.id);
      await notify(1);
      expect(mails()[0].text).toContain("RETIRA EN CÓRDOBA");
      expect(mails()[0].text).not.toContain("ENVÍO A DOMICILIO");
    });

    const BRANCH = { method: "branch", province: "Santa Fe", branch: "Sucursal Rosario Centro", street: "", number: "", floor: "", city: "", zip: "" };

    it("a sucursal sin tarifa cargada no se vende (y no se reserva stock)", async () => {
      const res = await buy({ shipping: { ...BRANCH, province: "Córdoba" } });
      expect(res.status).toBe(422);
      expect(await stockOf()).toBe(3);
      expect(await orders()).toHaveLength(0);
    });

    it("a sucursal sin sucursal elegida se rechaza antes de reservar", async () => {
      const res = await buy({ shipping: { ...BRANCH, branch: "" } });
      expect(res.status).toBe(422);
      expect(await orders()).toHaveLength(0);
    });

    it("a sucursal, sobre $100.000: se vende gratis y el mail trae la sucursal, la provincia y el celular", async () => {
      await pg.exec("update stock set qty = 500 where size = 'L'");
      const res = await buy({ items: lines(11), shipping: BRANCH });
      expect(res.status).toBe(200);
      const [order] = await orders();
      approve(1, order.id);
      await notify(1);
      const text = mails()[0].text;
      for (const dato of ["ENVÍO A SUCURSAL DE CORREO ARGENTINO", "Provincia: Santa Fe", "Sucursal de destino: Sucursal Rosario Centro", "Cód. área (sin 0): 351", "Celular: 5551234", "Ana Pérez"]) {
        expect(text, dato).toContain(dato);
      }
      expect(text).not.toContain("ENVÍO A DOMICILIO");
    });

    it("supera los $100.000: envío gratis aunque la zona no tenga tarifa", async () => {
      await pg.exec("update stock set qty = 500 where size = 'L'");
      const res = await buy({ items: lines(11), shipping: FAR }); // 11 x 10 x $1000 = $110.000
      expect(res.status).toBe(200);
      expect(Number((await orders())[0].amount)).toBe(110_000);
    });

    it("una tarifa definida se suma al total, a Mercado Pago y al control del monto, y sale en el mail", async () => {
      const { RATES } = await import("@/lib/shippingCost");
      RATES.interior = 6000;
      try {
        const res = await buy({ shipping: FAR });
        expect(res.status).toBe(200);
        const [order] = await orders();
        expect(Number(order.amount)).toBe(7000); // $1000 del producto + $6000 de envío
        const [pref] = preferences();
        expect(pref.items.at(-1)).toMatchObject({ id: "envio", quantity: 1, unit_price: 6000 });

        approve(1, order.id, 7000);
        await notify(1);
        expect((await orders())[0].status).toBe("paid");
        expect(mails()[0].text).toContain("Envío cobrado: $6000");
      } finally {
        RATES.interior = null;
      }
    });

    it("el navegador no puede elegir el costo: un envío gratis manipulado se ignora", async () => {
      const res = await buy({ shipping: { ...FAR, cost: 0, shipping_cost: 0 } });
      expect(res.status).toBe(422); // sigue sin tarifa para Salta
    });

    it("un método inventado se rechaza", async () => {
      const res = await buy({ shipping: { method: "drone" } });
      expect(res.status).toBe(422);
      expect(await orders()).toHaveLength(0);
    });
  });

  it("si falla Mercado Pago al crear el pago, se devuelve el stock reservado", async () => {
    failPreference = true;
    const res = await buy();
    expect(res.status).toBe(502);
    expect(await stockOf()).toBe(3);
    expect((await orders())[0].status).toBe("expired");
  });

  it("no deja vender más de lo que hay y no toca nada", async () => {
    await pg.exec("update stock set qty = 1 where size = 'M'");
    const res = await buy({ items: [{ slug: "producto-01", color: "Negro", size: "M", qty: 2 }] });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("Sin stock");
    expect(await stockOf()).toBe(1);
    expect(await orders()).toHaveLength(0);
    expect(preferences()).toHaveLength(0); // ni siquiera se llamó a Mercado Pago
  });

  it("los últimos productos: dos compradores a la vez, solo uno se lleva el último", async () => {
    await pg.exec("update stock set qty = 1 where size = 'M'");
    const [a, b] = await Promise.all([buy({ shipping: { email: "a@mail.com" } }), buy({ shipping: { email: "b@mail.com" } })]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await stockOf()).toBe(0);
  });
});

describe("el webhook ignora lo que no corresponde", () => {
  it.each([
    ["otro tipo de aviso", "https://tienda.test/api/mercadopago/webhook?type=merchant_order&data.id=1"],
    ["un id que no es numérico", "https://tienda.test/api/mercadopago/webhook?type=payment&data.id=abc"],
    ["un id con intento de inyección", "https://tienda.test/api/mercadopago/webhook?type=payment&data.id=1%2F..%2Fadmin"],
    ["sin id", "https://tienda.test/api/mercadopago/webhook?type=payment"],
  ])("%s → 200 y no consulta a Mercado Pago", async (_n, url) => {
    expect((await webhook(new Request(url, { method: "POST" }))).status).toBe(200);
    expect(calls).toHaveLength(0);
  });

  it("un pago de otra cosa (referencia que no es de esta web) se ignora con 200, sin errores", async () => {
    payments[7] = { id: 7, status: "approved", currency_id: "ARS", external_reference: "factura-123", transaction_amount: 500 };
    expect((await notify(7)).status).toBe(200);
    expect(mails()).toHaveLength(0);
  });

  it("un pago no aprobado no confirma nada", async () => {
    await buy();
    const [order] = await orders();
    payments[8] = { id: 8, status: "pending", currency_id: "ARS", external_reference: order.id, transaction_amount: 1000 };
    await notify(8);
    expect((await orders())[0].status).toBe("pending");
    expect(mails()).toHaveLength(0);
  });

  it("un pago que Mercado Pago no conoce → 500 para que reintente", async () => {
    expect((await notify(999)).status).toBe(500);
  });

  it("un aviso falso (id real de otra cuenta, referencia de un pedido) no puede confirmar un pedido sin pago aprobado en MP", async () => {
    await buy();
    const [order] = await orders();
    // El atacante manda un aviso con un id inventado: MP no lo conoce.
    expect((await notify(31337)).status).toBe(500);
    expect((await orders())[0].status).toBe("pending");
    expect(order.status).toBe("pending");
  });

  it("con MP_WEBHOOK_SECRET definida, exige la firma", async () => {
    process.env.MP_WEBHOOK_SECRET = "secreto";
    await buy();
    const [order] = await orders();
    approve(1, order.id);
    expect((await notify(1)).status).toBe(401); // sin firma
    expect((await orders())[0].status).toBe("pending");

    const ts = "1700000000";
    const v1 = createHmac("sha256", "secreto").update(`id:1;request-id:abc;ts:${ts};`).digest("hex");
    const ok = await webhook(new Request("https://tienda.test/api/mercadopago/webhook?type=payment&data.id=1", { method: "POST", headers: { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": "abc" } }));
    expect(ok.status).toBe(200);
    expect((await orders())[0].status).toBe("paid");
  });
});

describe("el servidor no se deja engañar", () => {
  it("rechaza pedidos que vienen de otro sitio web (403)", async () => {
    expect((await buy({ headers: { origin: "https://malo.example" } })).status).toBe(403);
    expect(await orders()).toHaveLength(0);
  });

  it("rechaza el truco text/plain entre sitios (415)", async () => {
    expect((await buy({ headers: { "content-type": "text/plain" } })).status).toBe(415);
  });

  it("rechaza si no se aceptaron los términos (422)", async () => {
    expect((await buy({ terms: false })).status).toBe(422);
    expect((await buy({ terms: "true" })).status).toBe(422); // tiene que ser exactamente true
    expect(await orders()).toHaveLength(0);
  });

  it("rechaza datos de envío inválidos y dice cuáles (422)", async () => {
    const res = await buy({ shipping: { email: "mal", zip: "ABC" } });
    expect(res.status).toBe(422);
    expect((await res.json()).fields).toMatchObject({ email: expect.any(String), zip: expect.any(String) });
    expect(await orders()).toHaveLength(0);
  });

  it.each([
    ["producto inexistente", [{ slug: "no-existe", color: "Negro", size: "M", qty: 1 }], 409],
    ["talle inventado", [{ slug: "producto-01", color: "Negro", size: "ZZ", qty: 1 }], 409],
    ["color inventado", [{ slug: "producto-01", color: "Rojo", size: "M", qty: 1 }], 409],
    ["cantidad 0", [{ slug: "producto-01", color: "Negro", size: "M", qty: 0 }], 400],
    ["cantidad negativa", [{ slug: "producto-01", color: "Negro", size: "M", qty: -5 }], 400],
    ["cantidad con decimales", [{ slug: "producto-01", color: "Negro", size: "M", qty: 1.5 }], 400],
    ["cantidad absurda", [{ slug: "producto-01", color: "Negro", size: "M", qty: 999 }], 400],
    ["carrito vacío", [], 400],
    ["demasiados ítems", Array(21).fill({ slug: "producto-01", color: "Negro", size: "M", qty: 1 }), 400],
    ["ítems que no son objetos", [null, 5, "x"], 400],
    ["items que no es un array", "hola", 400],
  ])("carrito inválido: %s", async (_n, items, status) => {
    expect((await buy({ items })).status).toBe(status);
    expect(await orders()).toHaveLength(0);
    expect(await stockOf()).toBe(3);
  });

  it("rechaza JSON roto y cuerpos gigantes", async () => {
    expect((await buy({ raw: "{roto" })).status).toBe(400);
    expect((await buy({ raw: JSON.stringify({ x: "a".repeat(30_000) }) })).status).toBe(413);
  });

  it("no filtra errores internos al cliente", async () => {
    failPreference = true;
    const res = await buy();
    const text = JSON.stringify(await res.json());
    expect(text).not.toMatch(/error de mp|Mercado Pago 500|stack|supabase|TEST-token/i);
  });
});

describe("antiabuso", () => {
  it("limita los intentos por IP (429) para que nadie vacíe el stock reteniendo reservas", async () => {
    await pg.exec("update stock set qty = 100");
    const ip = "9.9.9.9";
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) statuses.push((await buy({ ip, shipping: { email: `u${i}@mail.com` } })).status);
    expect(statuses.slice(0, 6)).toEqual([200, 200, 200, 200, 200, 200]);
    expect(statuses.slice(6)).toEqual([429, 429]);
    expect(await orders()).toHaveLength(6);
  });

  it("un mismo email no puede tener más de 3 reservas pendientes (429)", async () => {
    await pg.exec("update stock set qty = 100");
    const out: number[] = [];
    for (let i = 0; i < 4; i++) out.push((await buy({ shipping: { email: "Abuso@mail.com" } })).status);
    expect(out).toEqual([200, 200, 200, 429]);
  });
});

describe("botón de arrepentimiento", () => {
  const revoke = (body: object, ip = nextIp(), headers: Record<string, string> = {}) =>
    revocation(
      new Request("https://tienda.test/api/arrepentimiento", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://tienda.test", "x-forwarded-for": ip, ...headers },
        body: JSON.stringify(body),
      }),
    );
  const rows = async () => (await pg.query<{ code: string; name: string; email: string }>("select * from revocations")).rows;

  it("registra el pedido, devuelve un código y te avisa por mail", async () => {
    const res = await revoke({ name: "Ana Pérez", email: "ana@mail.com", orderRef: "ABC", details: "me queda chico" });
    expect(res.status).toBe(200);
    const { code } = await res.json();
    expect(code).toMatch(/^ARR-[A-Z2-9]{8}$/);
    expect((await rows())[0]).toMatchObject({ code, email: "ana@mail.com" });
    expect(mails()).toHaveLength(1);
    expect(mails()[0].to).toEqual(["duena@mail.com"]);
    expect(mails()[0].text).toContain(code);
  });

  it("sin dominio propio (MAIL_FROM) NO le escribe al email ingresado, solo a vos", async () => {
    await revoke({ name: "Ana", email: "victima@ejemplo.com" });
    expect(mails().every((m) => m.to[0] === "duena@mail.com")).toBe(true);
  });

  it("con MAIL_FROM configurado también le manda el código al cliente", async () => {
    process.env.MAIL_FROM = "BYSLF <hola@byslf.com>";
    const { code } = await (await revoke({ name: "Ana", email: "ana@mail.com" })).json();
    expect(mails().map((m) => m.to[0]).sort()).toEqual(["ana@mail.com", "duena@mail.com"]);
    expect(mails().find((m) => m.to[0] === "ana@mail.com").text).toContain(code);
  });

  it("el campo trampa de los bots no guarda nada ni manda mails", async () => {
    const res = await revoke({ name: "bot", email: "b@b.com", website: "spam.com" });
    expect(res.status).toBe(200);
    expect(await rows()).toHaveLength(0);
    expect(mails()).toHaveLength(0);
  });

  it("limita a 2 pedidos por hora por email (para no usarlo como cañón de spam)", async () => {
    const out: number[] = [];
    for (let i = 0; i < 3; i++) out.push((await revoke({ name: "Ana", email: "mismo@mail.com" })).status);
    expect(out).toEqual([200, 200, 429]);
  });

  it("limita a 5 pedidos por hora por IP", async () => {
    const out: number[] = [];
    for (let i = 0; i < 6; i++) out.push((await revoke({ name: "Ana", email: `u${i}@mail.com` }, "7.7.7.7")).status);
    expect(out).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it("valida nombre y email, y rechaza otros orígenes", async () => {
    expect((await revoke({ name: "", email: "a@b.com" })).status).toBe(422);
    expect((await revoke({ name: "Ana", email: "mal" })).status).toBe(422);
    expect((await revoke({ name: "Ana", email: "a@b.com" }, nextIp(), { origin: "https://malo.example" })).status).toBe(403);
    expect(await rows()).toHaveLength(0);
  });
});

describe("si la base de datos no está disponible", () => {
  const caida = { rpc: async () => ({ data: null, error: { message: "connection refused" } }), from: () => ({}) };

  it("el checkout responde 503 claro, no reserva nada y no filtra detalles", async () => {
    const real = holder.__testClient;
    holder.__testClient = caida;
    try {
      const res = await buy();
      expect(res.status).toBe(503);
      expect(JSON.stringify(await res.json())).not.toMatch(/connection|refused|supabase/i);
      expect(preferences()).toHaveLength(0); // no se llamó a Mercado Pago
    } finally {
      holder.__testClient = real;
    }
  });

  it("el arrepentimiento responde 503 y no guarda nada", async () => {
    const real = holder.__testClient;
    holder.__testClient = caida;
    try {
      const res = await revocation(
        new Request("https://tienda.test/api/arrepentimiento", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "3.3.3.3" },
          body: JSON.stringify({ name: "Ana", email: "ana@mail.com" }),
        }),
      );
      expect(res.status).toBe(503);
    } finally {
      holder.__testClient = real;
    }
  });
});


// =====================================================================================

describe("pago por transferencia", () => {
  const post = (handler: Handler, path: string, body: unknown, headers: Record<string, string> = {}) =>
    handler(
      new Request(`https://tienda.test${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://tienda.test", "x-forwarded-for": nextIp(), ...headers },
        body: JSON.stringify(body),
      }),
    );
  const notifyBody = (orderId: string, over: object = {}) => ({ orderId, shipping: { ...SHIPPING, ...over } });
  const reserveT = async (over: Parameters<typeof buy>[0] = {}) => {
    const res = await buy({ payment: "transfer", ...over });
    expect(res.status).toBe(200);
    return (await res.json()).transfer as { orderId: string; code: string; amount: number; expiresAt: string };
  };
  const confirmData = () => {
    const m = /admin\/confirmar\?o=([0-9a-f-]{36})&t=([0-9a-f]{64})/.exec(mails().at(-1).text);
    return { orderId: m![1], token: m![2] };
  };

  it("elegir transferencia reserva el stock y devuelve monto y código, SIN llamar a Mercado Pago ni mandar mails", async () => {
    const t = await reserveT({ items: [{ slug: "producto-01", color: "Negro", size: "M", qty: 2 }] });
    expect(t.amount).toBe(2000);
    expect(t.code).toBe(`BYSLF-${t.orderId.slice(0, 8).toUpperCase()}`);
    expect(preferences()).toHaveLength(0);
    expect(mails()).toHaveLength(0);
    expect(await stockOf()).toBe(1);
    const rows = (await pg.query<{ method: string; status: string }>("select method, status from orders")).rows;
    expect(rows[0]).toMatchObject({ method: "transfer", status: "pending" });
    // la reserva dura ~24 horas
    expect(new Date(t.expiresAt).getTime() - Date.now()).toBeGreaterThan(23.9 * 3600_000);
  });

  it("tampoco guarda datos personales en la base", async () => {
    await reserveT();
    expect(JSON.stringify(await orders())).not.toMatch(/Ana|Pérez|ana@mail|Colón|30123456|5551234|Timbre/);
  });

  it("una forma de pago inventada se rechaza sin reservar nada", async () => {
    const res = await buy({ payment: "bitcoin" });
    expect(res.status).toBe(400);
    expect(await orders()).toHaveLength(0);
  });

  it("a una zona sin tarifa tampoco se le reserva por transferencia", async () => {
    const res = await buy({ payment: "transfer", shipping: { province: "Salta", city: "Salta", zip: "4400" } });
    expect(res.status).toBe(422);
    expect(await orders()).toHaveLength(0);
  });

  it("'Ya transferí' manda UN solo mail con los datos de envío, el código y el link para confirmar", async () => {
    const t = await reserveT();
    const res = await post(transferNotify, "/api/checkout/transfer/notify", notifyBody(t.orderId));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("sent");
    expect(mails()).toHaveLength(1);
    const [mail] = mails();
    expect(mail.to).toEqual(["duena@mail.com"]);
    expect(mail.subject).toContain("Transferencia por confirmar");
    for (const dato of ["SIN CONFIRMAR", t.code, t.orderId, "Ana Pérez", "ana@mail.com", "Cód. área (sin 0): 351", "Celular: 5551234", "Colón 100, 3B", "Provincia: Córdoba", "Localidad: Córdoba", "CP (CPA): 5000", "Timbre roto", "Negro", "Talle M", "/admin/confirmar?o="]) {
      expect(mail.text, `el mail debería incluir "${dato}"`).toContain(dato);
    }
    expect(mail).not.toHaveProperty("html");
    // todavía no está pagado y el stock sigue reservado
    expect((await orders())[0].status).toBe("pending");
    expect(await stockOf()).toBe(2);
  });

  it("tocar el botón varias veces (o en paralelo) NO manda más mails", async () => {
    const t = await reserveT();
    const rs = await Promise.all([1, 2, 3, 4].map(() => post(transferNotify, "/api/checkout/transfer/notify", notifyBody(t.orderId))));
    expect(rs.every((r) => r.status === 200)).toBe(true);
    expect(mails()).toHaveLength(1);
    expect((await (await post(transferNotify, "/api/checkout/transfer/notify", notifyBody(t.orderId))).json()).status).toBe("already");
  });

  it("si el mail falla se avisa del error y se puede reintentar (los datos no están guardados en otro lado)", async () => {
    const t = await reserveT();
    failMail = true;
    const bad = await post(transferNotify, "/api/checkout/transfer/notify", notifyBody(t.orderId));
    expect(bad.status).toBe(502);
    failMail = false;
    calls = [];
    const ok = await post(transferNotify, "/api/checkout/transfer/notify", notifyBody(t.orderId));
    expect(ok.status).toBe(200);
    expect(mails()).toHaveLength(1);
  });

  it("sin clave de mails, tampoco se da por avisado", async () => {
    const t = await reserveT();
    delete process.env.RESEND_API_KEY;
    expect((await post(transferNotify, "/api/checkout/transfer/notify", notifyBody(t.orderId))).status).toBe(502);
    process.env.RESEND_API_KEY = "re_test";
    expect((await post(transferNotify, "/api/checkout/transfer/notify", notifyBody(t.orderId))).status).toBe(200);
  });

  it("con retiro en Córdoba el mail lo dice y no pide enviar", async () => {
    const blank = { method: "pickup", street: "", number: "", floor: "", city: "", zip: "", province: "" };
    const t = await reserveT({ shipping: blank });
    await post(transferNotify, "/api/checkout/transfer/notify", notifyBody(t.orderId, blank));
    expect(mails()[0].text).toContain("RETIRA EN CÓRDOBA");
    expect(mails()[0].text).not.toContain("Enviar a:");
  });

  it("rechaza datos de otra persona, pedidos que no existen o que no son de transferencia, y datos inválidos", async () => {
    const t = await reserveT();
    expect((await post(transferNotify, "/api/checkout/transfer/notify", notifyBody(t.orderId, { email: "otra@mail.com" }))).status).toBe(409);
    expect((await post(transferNotify, "/api/checkout/transfer/notify", notifyBody("00000000-0000-4000-8000-000000000099"))).status).toBe(404);
    expect((await post(transferNotify, "/api/checkout/transfer/notify", notifyBody("no-es-un-uuid"))).status).toBe(400);
    expect((await post(transferNotify, "/api/checkout/transfer/notify", { shipping: SHIPPING })).status).toBe(400);
    expect((await post(transferNotify, "/api/checkout/transfer/notify", notifyBody(t.orderId, { zip: "mal" }))).status).toBe(422);
    // un pedido de Mercado Pago no se puede "avisar" por esta vía
    await buy();
    const mpOrder = (await orders()).find((o) => o.id !== t.orderId)!;
    expect((await post(transferNotify, "/api/checkout/transfer/notify", notifyBody(mpOrder.id))).status).toBe(404);
    expect(mails()).toHaveLength(0);
  });

  it("si la reserva venció, no manda el mail y explica qué hacer", async () => {
    const t = await reserveT();
    await pg.query("update orders set expires_at = now() - interval '1 minute' where id = $1", [t.orderId]);
    const res = await post(transferNotify, "/api/checkout/transfer/notify", notifyBody(t.orderId));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("Instagram");
    expect(mails()).toHaveLength(0);
  });

  it("protege contra CSRF y limita los intentos", async () => {
    const t = await reserveT();
    expect((await post(transferNotify, "/api/checkout/transfer/notify", notifyBody(t.orderId), { origin: "https://malo.test" })).status).toBe(403);
    const ip = nextIp();
    const out: number[] = [];
    for (let i = 0; i < 12; i++) out.push((await post(transferNotify, "/api/checkout/transfer/notify", notifyBody(t.orderId), { "x-forwarded-for": ip })).status);
    expect(out.slice(10)).toEqual([429, 429]);
  });

  it("el link firmado del mail confirma la transferencia: pedido pagado, stock descontado, idempotente", async () => {
    const t = await reserveT();
    await post(transferNotify, "/api/checkout/transfer/notify", notifyBody(t.orderId));
    const { orderId, token } = confirmData();
    expect(orderId).toBe(t.orderId);

    const res = await post(adminConfirm, "/api/admin/confirm-transfer", { orderId, token });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("paid");
    expect((await orders())[0].status).toBe("paid");
    expect(await stockOf()).toBe(2);
    expect((await (await post(adminConfirm, "/api/admin/confirm-transfer", { orderId, token })).json()).status).toBe("already_paid");
  });

  it("no se puede confirmar con un link falso, de otro pedido, sin firma o sin secreto configurado", async () => {
    const a = await reserveT();
    await post(transferNotify, "/api/checkout/transfer/notify", notifyBody(a.orderId));
    const { orderId, token } = confirmData();
    const b = await reserveT({ shipping: { email: "otro@mail.com" } });

    const attempt = async (body: unknown) => (await post(adminConfirm, "/api/admin/confirm-transfer", body)).status;
    expect(await attempt({ orderId, token: "0".repeat(64) })).toBe(403);
    expect(await attempt({ orderId, token: "corto" })).toBe(403);
    expect(await attempt({ orderId, token: 123 })).toBe(403);
    expect(await attempt({ orderId })).toBe(403);
    expect(await attempt({ orderId: b.orderId, token })).toBe(403); // firma de OTRO pedido
    expect(await attempt({ orderId: "no-es-uuid", token })).toBe(403);
    const secret = process.env.ADMIN_LINK_SECRET;
    process.env.ADMIN_LINK_SECRET = "corto";
    expect(await attempt({ orderId, token })).toBe(403);
    delete process.env.ADMIN_LINK_SECRET;
    expect(await attempt({ orderId, token })).toBe(403);
    process.env.ADMIN_LINK_SECRET = secret;

    expect((await orders()).every((o) => o.status === "pending")).toBe(true);
    expect((await post(adminConfirm, "/api/admin/confirm-transfer", { orderId, token }, { origin: "https://malo.test" })).status).toBe(403);
  });

  it("un pedido de Mercado Pago no se puede 'confirmar' con un link", async () => {
    await buy();
    const [o] = await orders();
    const { signConfirm } = await import("@/lib/server/transfer");
    const res = await post(adminConfirm, "/api/admin/confirm-transfer", { orderId: o.id, token: signConfirm(o.id) });
    expect(res.status).toBe(403);
    expect((await orders())[0].status).toBe("pending");
  });

  it("si la reserva venció y ya no hay stock, no confirma y avisa que hay que devolver la plata", async () => {
    await pg.exec("update stock set qty = 1 where size = 'M'");
    const t = await reserveT();
    await post(transferNotify, "/api/checkout/transfer/notify", notifyBody(t.orderId));
    const { orderId, token } = confirmData();
    await pg.query("update orders set expires_at = now() - interval '1 minute' where id = $1", [t.orderId]);
    await pg.exec("select expire_pending()");
    await pg.exec("update stock set qty = 0 where size = 'M'"); // otro se llevó la última
    const res = await post(adminConfirm, "/api/admin/confirm-transfer", { orderId, token });
    expect(res.status).toBe(409);
    expect((await res.json()).status).toBe("out_of_stock");
    expect((await orders())[0].status).toBe("expired");
  });
});

describe("mails al comprador", () => {
  const post = (handler: Handler, path: string, body: unknown) =>
    handler(
      new Request(`https://tienda.test${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://tienda.test", "x-forwarded-for": nextIp() },
        body: JSON.stringify(body),
      }),
    );
  const toBuyer = () => mails().filter((m) => m.to[0] === "ana@mail.com");
  const toOwner = () => mails().filter((m) => m.to[0] === "duena@mail.com");
  const paid = async (over: Parameters<typeof buy>[0] = {}, amount = 2000) => {
    const res = await buy({ items: [{ slug: "producto-01", color: "Negro", size: "M", qty: 2 }], ...over });
    expect(res.status).toBe(200);
    const [order] = await orders();
    approve(1, order.id, amount);
    await notify(1);
    return order;
  };

  beforeEach(() => {
    process.env.MAIL_FROM = "BYSLF <pedidos@byslf.com.ar>";
  });

  it("al confirmarse el pago con Mercado Pago el comprador recibe su confirmación, con el pedido, el envío y los plazos", async () => {
    const order = await paid();
    expect(toOwner()).toHaveLength(1);
    expect(toBuyer()).toHaveLength(1);
    const [mail] = toBuyer();
    expect(mail.subject).toContain("Tu pedido BYSLF está confirmado");
    expect(mail.subject).toContain(`BYSLF-${order.id.slice(0, 8).toUpperCase()}`);
    for (const dato of ["Hola Ana!", "Byslf patch negra", "Negro", "Talle M", "x2", "Total pagado: $2.000", "Envío: gratis", "Envío a domicilio", "Colón 100, 3B", "Córdoba, Córdoba", "2 a 5 días hábiles", "3 a 10 días hábiles", "30 días", "@byslfco", "byslfco@gmail.com"]) {
      expect(mail.text, `el mail debería incluir "${dato}"`).toContain(dato);
    }
    expect(mail).not.toHaveProperty("html");
  });

  it("el comprador no recibe el DNI ni datos de otros: solo lo que corresponde a su pedido", async () => {
    await paid();
    expect(toBuyer()[0].text).not.toContain("30123456");
  });

  it("sin MAIL_FROM (sin dominio) no se le intenta escribir al comprador, y la venta sigue igual", async () => {
    delete process.env.MAIL_FROM;
    await paid();
    expect(toBuyer()).toHaveLength(0);
    expect(toOwner()).toHaveLength(1);
    expect((await orders())[0].status).toBe("paid");
  });

  it("si Mercado Pago avisa varias veces, el comprador recibe UN solo mail", async () => {
    const order = await paid();
    await notify(1);
    await notify(1);
    expect(toBuyer()).toHaveLength(1);
    expect((await orders())[0].id).toBe(order.id);
  });

  it("un pedido que hay que revisar a mano (monto distinto) NO le manda nada al comprador todavía", async () => {
    await paid({}, 1);
    expect((await orders())[0].status).toBe("needs_review");
    expect(toBuyer()).toHaveLength(0);
    expect(toOwner()).toHaveLength(1);
  });

  it("un pago duplicado no le manda un segundo mail de confirmación", async () => {
    const order = await paid();
    approve(2, order.id, 2000);
    await notify(2);
    expect(toBuyer()).toHaveLength(1);
    expect(toOwner()).toHaveLength(2); // la venta y la alerta de duplicado
  });

  it("con retiro en Córdoba el mail dice dónde retirar y no habla de plazos de correo", async () => {
    await paid({ shipping: { method: "pickup", street: "", number: "", floor: "", city: "", zip: "", province: "" } });
    const text = toBuyer()[0].text;
    expect(text).toContain("Retiro en Córdoba");
    expect(text).not.toContain("Plazos:");
  });

  it("a sucursal el mail dice la sucursal elegida", async () => {
    await pg.exec("update stock set qty = 500 where size = 'L'");
    const res = await buy({
      items: Array.from({ length: 11 }, () => ({ slug: "producto-01", color: "Negro", size: "L", qty: 10 })),
      shipping: { method: "branch", province: "Santa Fe", branch: "Sucursal Rosario Centro", street: "", number: "", floor: "", city: "", zip: "" },
    });
    expect(res.status).toBe(200);
    const [order] = await orders();
    approve(1, order.id, 110000);
    await notify(1);
    expect(toBuyer()[0].text).toContain("Envío a sucursal de Correo Argentino");
    expect(toBuyer()[0].text).toContain("Sucursal Rosario Centro (Santa Fe)");
  });

  it("un mail caído NO rompe la venta aunque falle el del comprador", async () => {
    failMail = true;
    await paid();
    expect((await orders())[0].status).toBe("paid");
  });

  it("transferencia: al tocar 'Ya transferí' el comprador recibe la constancia con el código y los datos para pagar", async () => {
    const res = await buy({ payment: "transfer", items: [{ slug: "producto-01", color: "Negro", size: "M", qty: 2 }] });
    const t = (await res.json()).transfer as { orderId: string; code: string };
    const ok = await post(transferNotify, "/api/checkout/transfer/notify", { orderId: t.orderId, shipping: SHIPPING });
    expect(ok.status).toBe(200);
    expect(toOwner()).toHaveLength(1);
    expect(toBuyer()).toHaveLength(1);
    const [mail] = toBuyer();
    expect(mail.subject).toContain("Recibimos tu aviso de transferencia");
    expect(mail.text).toContain("todavía NO está confirmado");
    expect(mail.text).not.toContain("Tu pedido está confirmado");
    expect((await orders())[0].status).toBe("pending"); // el pago lo confirmás vos, no el aviso
    for (const dato of [t.code, "Total a transferir: $2.000", "Alias:", "CBU/CVU:", "reservado hasta", "@byslfco", "Envío a domicilio"]) {
      expect(mail.text, `el mail debería incluir "${dato}"`).toContain(dato);
    }
    // varios toques seguidos no repiten el mail
    await post(transferNotify, "/api/checkout/transfer/notify", { orderId: t.orderId, shipping: SHIPPING });
    expect(toBuyer()).toHaveLength(1);
  });

  it("a vos te llega un mail listo para avisarle al comprador que confirmaste el pago", async () => {
    const res = await buy({ payment: "transfer" });
    const t = (await res.json()).transfer as { orderId: string; code: string };
    await post(transferNotify, "/api/checkout/transfer/notify", { orderId: t.orderId, shipping: SHIPPING });
    const m = /mailto:(\S+)/.exec(toOwner()[0].text)!;
    const url = new URL(m[0]);
    expect(url.pathname).toBe("ana@mail.com");
    expect(url.searchParams.get("subject")).toBe(`Confirmamos tu pago · ${t.code}`);
    const body = url.searchParams.get("body")!;
    for (const dato of ["Hola Ana!", "Hemos confirmado tu pago, te avisaremos por WhatsApp cuando tu pedido sea enviado!", t.code]) expect(body, dato).toContain(dato);
    expect(toBuyer()).toHaveLength(1); // el único mail al comprador sigue siendo el "todavía NO está confirmado"
    expect((await orders())[0].status).toBe("pending");
  });

  it("con retiro en Córdoba el aviso dice que te avisan cuando esté listo para retirar", async () => {
    const res = await buy({ payment: "transfer", shipping: { method: "pickup", street: "", number: "", floor: "", city: "", zip: "", province: "" } });
    const t = (await res.json()).transfer as { orderId: string };
    await post(transferNotify, "/api/checkout/transfer/notify", { orderId: t.orderId, shipping: { ...SHIPPING, method: "pickup", street: "", number: "", floor: "", city: "", zip: "", province: "" } });
    const body = new URL(/mailto:(\S+)/.exec(toOwner()[0].text)![0]).searchParams.get("body")!;
    expect(body).toContain("cuando tu pedido esté listo para retirar");
  });

  it("transferencia sin MAIL_FROM: solo te llega a vos", async () => {
    delete process.env.MAIL_FROM;
    const res = await buy({ payment: "transfer" });
    const t = (await res.json()).transfer as { orderId: string };
    await post(transferNotify, "/api/checkout/transfer/notify", { orderId: t.orderId, shipping: SHIPPING });
    expect(toBuyer()).toHaveLength(0);
    expect(toOwner()).toHaveLength(1);
  });
});
