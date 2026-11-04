import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { checkOrigin, clientIp, hashKey, readJson, UUID_RE, verifyMpSignature } from "@/lib/server/security";

const post = (headers: Record<string, string>, body = "{}") =>
  new Request("https://tienda.test/api/checkout", { method: "POST", headers, body });

beforeEach(() => {
  process.env.SITE_URL = "https://tienda.test";
});

describe("checkOrigin (anti-CSRF)", () => {
  it("deja pasar el mismo origen", () => expect(checkOrigin(post({ origin: "https://tienda.test" }))).toBeNull());
  it("deja pasar si no hay Origin (no es un navegador)", () => expect(checkOrigin(post({}))).toBeNull());
  it("bloquea otro sitio", async () => {
    const r = checkOrigin(post({ origin: "https://malo.example" }));
    expect(r?.status).toBe(403);
  });
  it("bloquea un origen que solo se parece", () => {
    expect(checkOrigin(post({ origin: "https://tienda.test.malo.example" }))?.status).toBe(403);
    expect(checkOrigin(post({ origin: "http://tienda.test" }))?.status).toBe(403);
  });
});

describe("readJson", () => {
  const json = { "content-type": "application/json" };
  it("lee un JSON válido", async () => expect(await readJson(post(json, '{"a":1}'))).toEqual({ data: { a: 1 } }));
  it("rechaza otro tipo de contenido (415): evita el truco text/plain entre sitios", async () => {
    const r = await readJson(post({ "content-type": "text/plain" }, '{"a":1}'));
    expect("error" in r && r.error.status).toBe(415);
  });
  it("rechaza cuerpos enormes (413)", async () => {
    const r = await readJson(post(json, JSON.stringify({ x: "a".repeat(30_000) })));
    expect("error" in r && r.error.status).toBe(413);
  });
  it("rechaza JSON roto (400)", async () => {
    const r = await readJson(post(json, "{no es json"));
    expect("error" in r && r.error.status).toBe(400);
  });
});

describe("verifyMpSignature", () => {
  const secret = "clave-secreta";
  const sign = (id: string, reqId: string, ts: string, key = secret) =>
    createHmac("sha256", key).update(`id:${id};request-id:${reqId};ts:${ts};`).digest("hex");
  const req = (sig: string, reqId = "req-1") =>
    new Request("https://tienda.test/api/mercadopago/webhook", { method: "POST", headers: { "x-signature": sig, "x-request-id": reqId } });

  it("acepta una firma correcta", () => expect(verifyMpSignature(req(`ts=1700,v1=${sign("123", "req-1", "1700")}`), "123", secret)).toBe(true));
  it("rechaza una firma hecha con otra clave", () => expect(verifyMpSignature(req(`ts=1700,v1=${sign("123", "req-1", "1700", "otra")}`), "123", secret)).toBe(false));
  it("rechaza si cambia el id del pago", () => expect(verifyMpSignature(req(`ts=1700,v1=${sign("123", "req-1", "1700")}`), "124", secret)).toBe(false));
  it("rechaza headers ausentes o malformados", () => {
    expect(verifyMpSignature(req(""), "123", secret)).toBe(false);
    expect(verifyMpSignature(req("basura"), "123", secret)).toBe(false);
    expect(verifyMpSignature(req("ts=1700"), "123", secret)).toBe(false);
  });
});

describe("utilidades", () => {
  it("clientIp toma el primer valor de x-forwarded-for", () => expect(clientIp(post({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4"));
  it("clientIp cae en x-real-ip y luego en 'unknown'", () => {
    expect(clientIp(post({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIp(post({}))).toBe("unknown");
  });
  it("hashKey no deja ver el dato original y no distingue mayúsculas", () => {
    expect(hashKey("Ana@Mail.com")).toBe(hashKey("ana@mail.com"));
    expect(hashKey("ana@mail.com")).not.toContain("ana");
  });
  it("UUID_RE acepta UUIDs y rechaza todo lo demás", () => {
    expect(UUID_RE.test("00000000-0000-4000-8000-000000000001")).toBe(true);
    for (const x of ["abc", "'; drop table orders;--", "", "00000000-0000-4000-8000-00000000000"]) expect(UUID_RE.test(x)).toBe(false);
  });
});
