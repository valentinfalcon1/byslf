/** Newsletter: rutas reales de la API + base Postgres real en memoria. Solo se simula Resend. */
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "./helpers/fake-supabase";

type Handler = (req: Request) => Promise<Response>;
const holder = globalThis as unknown as { __testClient: unknown };
vi.mock("@/lib/server/db", () => ({ db: () => holder.__testClient }));

let pg: PGlite;
let subscribe: Handler;
let manage: Handler;
let mails: { to: string[]; subject: string; text: string }[] = [];
let failMail = false;

beforeAll(async () => {
  const db = await createTestDb();
  pg = db.pg;
  holder.__testClient = db.client;
  process.env.SITE_URL = "https://tienda.test";
  process.env.RESEND_API_KEY = "re_test";
  subscribe = (await import("@/app/api/newsletter/route")).POST;
  manage = (await import("@/app/api/newsletter/manage/route")).POST;
});

beforeEach(async () => {
  await pg.exec("truncate subscribers, rate_limits");
  mails = [];
  failMail = false;
  process.env.MAIL_FROM = "BYSLF <hola@byslf.com>"; // con dominio = doble opt-in
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url !== "https://api.resend.com/emails") throw new Error(`fetch inesperado: ${url}`);
      if (failMail) return new Response("caído", { status: 500 });
      mails.push(JSON.parse(String(init?.body)));
      return Response.json({ id: "m1" });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

let ipN = 0;
const ip = () => `10.1.${Math.floor(++ipN / 250)}.${ipN % 250}`;
const post = (handler: Handler, url: string, body: unknown, headers: Record<string, string> = {}) =>
  handler(
    new Request(`https://tienda.test${url}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://tienda.test", "x-forwarded-for": ip(), ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
const sub = (email: unknown, extra: object = {}, headers: Record<string, string> = {}) => post(subscribe, "/api/newsletter", { email, ...extra }, headers);
const act = (action: string, token: unknown, headers: Record<string, string> = {}) => post(manage, "/api/newsletter/manage", { action, token }, headers);

const rows = async () => (await pg.query<{ email: string; status: string; email_verified: boolean; token: string }>("select * from subscribers order by email")).rows;
const tokenFromMail = (m: { text: string }) => /t=([0-9a-f]{64})/.exec(m.text)![1];

describe("anotarse (con dominio = doble opt-in)", () => {
  it("guarda el email como pendiente y manda un mail de confirmación con link", async () => {
    const res = await sub("  Ana@Mail.com ");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, confirm: true });

    const [r] = await rows();
    expect(r).toMatchObject({ email: "ana@mail.com", status: "pending", email_verified: false });
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toEqual(["ana@mail.com"]);
    expect(mails[0].text).toContain(`https://tienda.test/newsletter/confirmar?t=${r.token}`);
    expect(r.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("el recorrido completo: anotarse → confirmar con el link → activo y verificado", async () => {
    await sub("ana@mail.com");
    const res = await act("confirm", tokenFromMail(mails[0]));
    expect(res.status).toBe(200);
    expect((await res.json()).result).toBe("confirmed");
    expect((await rows())[0]).toMatchObject({ status: "confirmed", email_verified: true });
  });

  it("anotar un email ya confirmado NO manda otro mail ni cambia nada", async () => {
    await sub("ana@mail.com");
    await act("confirm", tokenFromMail(mails[0]));
    mails = [];
    await sub("ana@mail.com");
    expect(mails).toHaveLength(0);
    expect((await rows())[0].status).toBe("confirmed");
  });

  it("no se puede averiguar quién está anotado: la respuesta es idéntica para un email nuevo y uno ya confirmado", async () => {
    await sub("ya@mail.com");
    await act("confirm", tokenFromMail(mails[0]));
    const existente = await (await sub("ya@mail.com")).json();
    const nuevo = await (await sub("nuevo@mail.com")).json();
    expect(existente).toEqual(nuevo);
  });

  it("un mail caído no impide anotarse (se guarda igual)", async () => {
    failMail = true;
    expect((await sub("ana@mail.com")).status).toBe(200);
    expect(await rows()).toHaveLength(1);
  });
});

describe("anotarse (sin dominio todavía)", () => {
  beforeEach(() => {
    delete process.env.MAIL_FROM;
  });

  it("no manda ningún mail a la persona y queda confirmado pero SIN verificar", async () => {
    const res = await sub("ana@mail.com");
    expect(await res.json()).toEqual({ ok: true, confirm: false });
    expect(mails).toHaveLength(0);
    expect((await rows())[0]).toMatchObject({ status: "confirmed", email_verified: false });
  });
});

describe("validación y abuso", () => {
  it.each([["vacío", ""], ["sin arroba", "mal"], ["sin dominio", "a@b"], ["con espacios", "a b@c.com"], ["con salto de línea (inyección de cabeceras)", "a@b.com\nBcc: x@y.com"], ["número", 5], ["null", null], ["objeto", { a: 1 }], ["demasiado largo", `${"a".repeat(120)}@mail.com`]])(
    "rechaza email inválido: %s",
    async (_n, valor) => {
      const res = await sub(valor);
      expect(res.status).toBe(422);
      expect(await rows()).toHaveLength(0);
      expect(mails).toHaveLength(0);
    },
  );

  it("el campo trampa de los bots no guarda nada ni manda mails", async () => {
    const res = await sub("bot@mail.com", { website: "spam.com" });
    expect(res.status).toBe(200);
    expect(await rows()).toHaveLength(0);
    expect(mails).toHaveLength(0);
  });

  it("limita a 8 anotaciones por hora por IP (429)", async () => {
    const out: number[] = [];
    for (let i = 0; i < 10; i++) out.push((await sub(`u${i}@mail.com`, {}, { "x-forwarded-for": "5.5.5.5" })).status);
    expect(out).toEqual([200, 200, 200, 200, 200, 200, 200, 200, 429, 429]);
  });

  it("limita a 3 por día por email (para no usarlo como cañón de spam contra una persona)", async () => {
    const out: number[] = [];
    for (let i = 0; i < 4; i++) out.push((await sub("victima@mail.com")).status);
    expect(out).toEqual([200, 200, 200, 429]);
    expect(mails.length).toBeLessThanOrEqual(3);
  });

  it("rechaza otros orígenes (403), tipos de contenido raros (415) y JSON roto (400)", async () => {
    expect((await sub("a@b.com", {}, { origin: "https://malo.example" })).status).toBe(403);
    expect((await sub("a@b.com", {}, { "content-type": "text/plain" })).status).toBe(415);
    expect((await post(subscribe, "/api/newsletter", "{roto")).status).toBe(400);
    expect(await rows()).toHaveLength(0);
  });

  it("responde 503 claro si la base no está disponible, sin filtrar detalles", async () => {
    const real = holder.__testClient;
    holder.__testClient = { rpc: async () => ({ data: null, error: { message: "connection refused" } }) };
    try {
      const res = await sub("ana@mail.com");
      expect(res.status).toBe(503);
      expect(JSON.stringify(await res.json())).not.toMatch(/connection|refused/i);
    } finally {
      holder.__testClient = real;
    }
  });
});

describe("confirmar y darse de baja", () => {
  it("darse de baja con el link, y el link de confirmación no lo reactiva", async () => {
    await sub("ana@mail.com");
    const token = tokenFromMail(mails[0]);
    expect((await (await act("unsubscribe", token)).json()).result).toBe("unsubscribed");
    expect((await (await act("unsubscribe", token)).json()).result).toBe("already");
    expect((await (await act("confirm", token)).json()).result).toBe("already");
    expect((await rows())[0].status).toBe("unsubscribed");
  });

  it("después de darse de baja puede volver a anotarse (arranca otra vez pendiente)", async () => {
    await sub("ana@mail.com");
    await act("unsubscribe", tokenFromMail(mails[0]));
    mails = [];
    await sub("ana@mail.com");
    expect((await rows())[0].status).toBe("pending");
    expect(mails).toHaveLength(1);
  });

  it("un token inventado da 404 y no toca a nadie", async () => {
    await sub("ana@mail.com");
    const res = await act("unsubscribe", "0".repeat(64));
    expect(res.status).toBe(404);
    expect((await rows())[0].status).toBe("pending");
  });

  it.each([
    ["token corto", "confirm", "abc"],
    ["token con caracteres raros", "confirm", `${"0".repeat(63)}'`],
    ["inyección SQL", "confirm", "' or 1=1 --"],
    ["acción inventada", "borrar-todo", "0".repeat(64)],
    ["token que no es texto", "confirm", 12345],
  ])("rechaza pedidos mal formados (400): %s", async (_n, action, token) => {
    expect((await act(action, token)).status).toBe(400);
  });

  it("limita los intentos (429) y rechaza otros orígenes (403)", async () => {
    const out: number[] = [];
    for (let i = 0; i < 32; i++) out.push((await act("confirm", "0".repeat(64), { "x-forwarded-for": "6.6.6.6" })).status);
    expect(out.slice(0, 30).every((s) => s === 404)).toBe(true);
    expect(out.slice(30)).toEqual([429, 429]);
    expect((await act("confirm", "0".repeat(64), { origin: "https://malo.example" })).status).toBe(403);
  });
});
