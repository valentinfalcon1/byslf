import { afterEach, describe, expect, it, vi } from "vitest";
import { getProduct, getProducts } from "@/data/products";

afterEach(() => vi.unstubAllEnvs());

describe("precio de prueba (DEV_TEST_PRICE)", () => {
  it("sin la variable, se usan los precios reales de lista (tarjeta)", async () => {
    vi.stubEnv("DEV_TEST_PRICE", "");
    const precios = Object.fromEntries((await getProducts()).map((p) => [p.slug, p.price]));
    expect(precios).toEqual({ "producto-01": 55000, "producto-02": 55000, "producto-03": 62000 });
  });

  it("en desarrollo/pruebas pone el precio indicado", async () => {
    vi.stubEnv("DEV_TEST_PRICE", "1000");
    expect((await getProduct("producto-01"))?.price).toBe(1000);
  });

  it("EN PRODUCCIÓN SE IGNORA POR COMPLETO (nadie puede comprar a precio de prueba)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_TEST_PRICE", "1");
    expect((await getProduct("producto-01"))?.price).toBe(55000);
    expect((await getProducts()).map((p) => p.price)).toEqual([55000, 55000, 62000]);
  });

  it.each(["abc", "-5", "0", "NaN"])("ignora valores inválidos (%s)", async (valor) => {
    vi.stubEnv("DEV_TEST_PRICE", valor);
    expect((await getProduct("producto-01"))?.price).toBe(55000);
  });
});
