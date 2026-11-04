import { describe, expect, it } from "vitest";
import { PROVINCES } from "@/lib/shipping";
import { CORDOBA_CAPITAL_ZIPS, FREE_SHIPPING_OVER, RATES, quoteShipping, zoneOf, type Zone } from "@/lib/shippingCost";

const PAID: Record<Zone, number | null> = { capital: 0, cordoba: 3000, centro: 4500, interior: 6000, patagonia: 9000 };

describe("zonas", () => {
  it("todas las provincias del formulario tienen una zona", () => {
    for (const p of PROVINCES) expect(zoneOf(p, "5000"), p).not.toBeNull();
  });
  it("una provincia inventada no tiene zona", () => expect(zoneOf("Atlantis", "5000")).toBeNull());

  it("Córdoba capital se reconoce por código postal, con o sin formato CPA", () => {
    for (const zip of ["5000", "5008", "5016", "X5000ABC", "x5010abc", " 5003 "]) expect(zoneOf("Córdoba", zip), zip).toBe("capital");
  });

  it("el resto de la provincia de Córdoba NO es capital", () => {
    for (const zip of ["5017", "5800", "5900", "X5800ABC", "4999", ""]) expect(zoneOf("Córdoba", zip), zip).toBe("cordoba");
  });

  it("un código postal de capital en OTRA provincia no cuenta como Córdoba capital", () => {
    expect(zoneOf("Buenos Aires", "5000")).toBe("centro");
    expect(zoneOf("San Luis", "5000")).toBe("interior");
  });

  it("los límites de la capital son los configurados", () => {
    expect(CORDOBA_CAPITAL_ZIPS).toEqual({ from: 5000, to: 5016 });
  });
});

describe("quoteShipping", () => {
  it("el retiro en Córdoba siempre es gratis, aunque la provincia sea otra o no esté elegida", () => {
    expect(quoteShipping("pickup", "Salta", "4400", 500, PAID)).toEqual({ ok: true, cost: 0, free: "pickup" });
    expect(quoteShipping("pickup", "", "", 500, PAID)).toEqual({ ok: true, cost: 0, free: "pickup" });
  });

  it("el envío a Córdoba CAPITAL es gratis", () => {
    expect(quoteShipping("delivery", "Córdoba", "5000", 5000)).toEqual({ ok: true, cost: 0, free: "zone" });
  });

  it("el envío al resto de la provincia de Córdoba no es gratis: usa su propia tarifa", () => {
    expect(quoteShipping("delivery", "Córdoba", "5800", 5000, PAID)).toEqual({ ok: true, cost: 3000, free: null });
    expect(quoteShipping("delivery", "Córdoba", "5800", 5000)).toEqual({ ok: false, reason: "no_rate" }); // tabla real: sin definir
  });

  it("en Córdoba, sin código postal válido no se puede saber si es capital", () => {
    expect(quoteShipping("delivery", "Córdoba", "", 5000, PAID)).toEqual({ ok: false, reason: "no_zip" });
    expect(quoteShipping("delivery", "Córdoba", "abc", 5000, PAID)).toEqual({ ok: false, reason: "no_zip" });
  });

  it("cobra la tarifa de la zona", () => {
    expect(quoteShipping("delivery", "Buenos Aires", "1000", 5000, PAID)).toEqual({ ok: true, cost: 4500, free: null });
    expect(quoteShipping("delivery", "Salta", "4400", 5000, PAID)).toEqual({ ok: true, cost: 6000, free: null });
    expect(quoteShipping("delivery", "Tierra del Fuego", "9410", 5000, PAID)).toEqual({ ok: true, cost: 9000, free: null });
  });

  it("es gratis SOLO si se supera el monto (justo en el monto todavía se cobra)", () => {
    expect(quoteShipping("delivery", "Salta", "4400", FREE_SHIPPING_OVER, PAID)).toMatchObject({ cost: 6000 });
    expect(quoteShipping("delivery", "Salta", "4400", FREE_SHIPPING_OVER + 1, PAID)).toEqual({ ok: true, cost: 0, free: "threshold" });
    expect(FREE_SHIPPING_OVER).toBe(100_000);
  });

  it("el envío gratis por monto vale aunque la zona no tenga tarifa definida", () => {
    expect(quoteShipping("delivery", "Salta", "4400", 150_000)).toMatchObject({ ok: true, cost: 0 });
    expect(quoteShipping("delivery", "Córdoba", "5800", 150_000)).toMatchObject({ ok: true, cost: 0 });
  });

  it("sin tarifa definida no se vende con envío a esa zona", () => {
    expect(quoteShipping("delivery", "Salta", "4400", 5000, { ...PAID, interior: null })).toEqual({ ok: false, reason: "no_rate" });
  });

  it("una tarifa inválida (negativa o NaN) se trata como no definida, nunca como gratis", () => {
    expect(quoteShipping("delivery", "Salta", "4400", 5000, { ...PAID, interior: -10 })).toEqual({ ok: false, reason: "no_rate" });
    expect(quoteShipping("delivery", "Salta", "4400", 5000, { ...PAID, interior: NaN })).toEqual({ ok: false, reason: "no_rate" });
  });

  it("sin provincia o con una provincia inexistente no hay costo", () => {
    expect(quoteShipping("delivery", "", "5000", 5000, PAID)).toEqual({ ok: false, reason: "no_province" });
    expect(quoteShipping("delivery", "Atlantis", "5000", 5000, PAID)).toEqual({ ok: false, reason: "no_province" });
  });

  it("la tabla real: solo Córdoba capital es gratis; el resto está pendiente de definir", () => {
    expect(RATES.capital).toBe(0);
    expect(RATES.cordoba).toBeNull();
    expect(RATES.centro).toBeNull();
  });
});
