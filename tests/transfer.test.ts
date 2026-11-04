import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { instagramChatUrl, orderCode } from "@/lib/transfer";
import { confirmLink, signConfirm, verifyConfirm } from "@/lib/server/transfer";

const ID = "3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b";
const SECRET = "secreto-de-prueba-0123456789-abcdefghijklmnop";

beforeEach(() => {
  process.env.ADMIN_LINK_SECRET = SECRET;
  process.env.SITE_URL = "https://tienda.test";
});
afterEach(() => {
  delete process.env.ADMIN_LINK_SECRET;
});

describe("chat de Instagram", () => {
  it("con el usuario real arma el link", () => expect(instagramChatUrl("byslf.arg")).toBe("https://ig.me/m/byslf.arg"));
  it("mientras sea un placeholder no hay link", () => expect(instagramChatUrl("[CUENTA]")).toBeNull());
  it.each(["a/b", "x?y=1", "a b", "", "javascript:alert(1)", "a".repeat(31), "https://malo.test"])("rechaza un usuario raro: %s", (u) => {
    expect(instagramChatUrl(u)).toBeNull();
  });
});

describe("código de pedido", () => {
  it("es corto, en mayúsculas y estable", () => expect(orderCode(ID)).toBe("BYSLF-3F2B8C1E"));
});

describe("link firmado para confirmar", () => {
  it("la firma es estable, de 64 hex, y no distingue mayúsculas del id", () => {
    expect(signConfirm(ID)).toMatch(/^[0-9a-f]{64}$/);
    expect(signConfirm(ID)).toBe(signConfirm(ID.toUpperCase()));
  });

  it("verifica la firma correcta y rechaza cualquier otra cosa", () => {
    const t = signConfirm(ID)!;
    expect(verifyConfirm(ID, t)).toBe(true);
    expect(verifyConfirm(ID, t.replace(/.$/, t.endsWith("0") ? "1" : "0"))).toBe(false); // un solo carácter distinto
    expect(verifyConfirm(ID, t.slice(1))).toBe(false);
    expect(verifyConfirm(ID, "")).toBe(false);
    expect(verifyConfirm(ID, undefined)).toBe(false);
    expect(verifyConfirm(ID, null)).toBe(false);
    expect(verifyConfirm(ID, 123)).toBe(false);
    expect(verifyConfirm(ID.replace(/^3/, "4"), t)).toBe(false); // firma de otro pedido
  });

  it("una firma hecha con otro secreto no sirve", () => {
    const t = signConfirm(ID)!;
    process.env.ADMIN_LINK_SECRET = "otro-secreto-distinto-0123456789-abcdefghijk";
    expect(verifyConfirm(ID, t)).toBe(false);
  });

  it("sin secreto (o menor a 32 caracteres) no hay firmas ni links y nada se verifica", () => {
    const t = signConfirm(ID)!;
    for (const bad of [undefined, "", "corto", "x".repeat(31)]) {
      if (bad === undefined) delete process.env.ADMIN_LINK_SECRET;
      else process.env.ADMIN_LINK_SECRET = bad;
      expect(signConfirm(ID)).toBeNull();
      expect(confirmLink(ID)).toBeNull();
      expect(verifyConfirm(ID, t)).toBe(false);
    }
  });

  it("el link apunta al sitio y lleva el pedido y la firma", () => {
    expect(confirmLink(ID)).toBe(`https://tienda.test/admin/confirmar?o=${ID}&t=${signConfirm(ID)}`);
  });
});
