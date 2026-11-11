import { describe, expect, it } from "vitest";
import { PROVINCES } from "@/lib/shipping";
import { BRANCH_RATES, CORDOBA_CAPITAL_ZIPS, FREE_SHIPPING_OVER, RATES, quoteShipping, zoneOf, type Zone } from "@/lib/shippingCost";

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

  it("la tabla real: Córdoba capital gratis, el resto de Córdoba pendiente, y el país con tarifa", () => {
    expect(RATES.capital).toBe(0);
    expect(RATES.cordoba).toBeNull();
    expect(RATES.centro).toBe(6739);
    expect(RATES.interior).toBe(7500);
    expect(RATES.patagonia).toBe(7800);
  });
});

describe("envío a sucursal", () => {
  const BRANCH: Record<Zone, number | null> = { capital: 1500, cordoba: 2500, centro: 3500, interior: 4500, patagonia: 6500 };

  it("usa su propia tabla, no la de domicilio", () => {
    expect(quoteShipping("branch", "Salta", "", 5000, BRANCH)).toEqual({ ok: true, cost: 4500, free: null });
    expect(quoteShipping("delivery", "Salta", "4400", 5000, PAID)).toEqual({ ok: true, cost: 6000, free: null });
  });

  it("no pide código postal: la zona sale de la provincia", () => {
    expect(quoteShipping("branch", "Córdoba", "", 5000, BRANCH)).toEqual({ ok: true, cost: 2500, free: null });
    expect(quoteShipping("delivery", "Córdoba", "", 5000, PAID)).toEqual({ ok: false, reason: "no_zip" });
  });

  it("sin provincia no se puede cotizar", () => {
    expect(quoteShipping("branch", "", "", 5000, BRANCH)).toEqual({ ok: false, reason: "no_province" });
  });

  it("supera los $100.000: gratis aunque no haya tarifa", () => {
    expect(quoteShipping("branch", "Córdoba", "", FREE_SHIPPING_OVER + 1, BRANCH_RATES)).toEqual({ ok: true, cost: 0, free: "threshold" });
    expect(quoteShipping("branch", "Córdoba", "", FREE_SHIPPING_OVER, BRANCH_RATES)).toEqual({ ok: false, reason: "no_rate" });
  });

  it("a sucursal: Córdoba sigue sin tarifa (no se vende) y el resto del país tiene la suya", () => {
    expect(BRANCH_RATES.capital).toBeNull();
    expect(BRANCH_RATES.cordoba).toBeNull();
    expect(quoteShipping("branch", "Córdoba", "", 5000)).toEqual({ ok: false, reason: "no_rate" });
    expect(quoteShipping("branch", "Santa Fe", "", 5000)).toEqual({ ok: true, cost: 6739, free: null });
    expect(quoteShipping("branch", "Salta", "", 5000)).toEqual({ ok: true, cost: 7500, free: null });
    expect(quoteShipping("branch", "Chubut", "", 5000)).toEqual({ ok: true, cost: 7800, free: null });
  });

  it("la tarifa de domicilio por defecto no se mezcla con la de sucursal", () => {
    expect(quoteShipping("delivery", "Córdoba", "5000", 5000)).toEqual({ ok: true, cost: RATES.capital, free: "zone" });
  });
});

describe("tabla por defecto de sucursal", () => {
  it("a sucursal se lee BRANCH_RATES y a domicilio RATES (cada una con su tarifa)", () => {
    const antesB = BRANCH_RATES.centro, antesR = RATES.centro;
    try {
      BRANCH_RATES.centro = 3500;
      RATES.centro = 5500;
      expect(quoteShipping("branch", "Santa Fe", "", 5000)).toEqual({ ok: true, cost: 3500, free: null });
      expect(quoteShipping("delivery", "Santa Fe", "2000", 5000)).toEqual({ ok: true, cost: 5500, free: null });
    } finally {
      BRANCH_RATES.centro = antesB;
      RATES.centro = antesR;
    }
  });
});
