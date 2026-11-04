import { afterEach, describe, expect, it, vi } from "vitest";
import { getProduct, getProducts } from "@/data/products";

afterEach(() => vi.unstubAllEnvs());

describe("precio de prueba (DEV_TEST_PRICE)", () => {
  it("sin la variable, los productos siguen sin precio ([PRECIO])", async () => {
    vi.stubEnv("DEV_TEST_PRICE", "");
    expect((await getProducts()).every((p) => p.price === null)).toBe(true);
  });

  it("en desarrollo/pruebas pone el precio indicado", async () => {
    vi.stubEnv("DEV_TEST_PRICE", "1000");
    expect((await getProduct("producto-01"))?.price).toBe(1000);
  });

  it("EN PRODUCCIÓN SE IGNORA POR COMPLETO (nadie puede comprar a precio de prueba)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_TEST_PRICE", "1");
    expect((await getProduct("producto-01"))?.price).toBeNull();
    expect((await getProducts()).every((p) => p.price === null)).toBe(true);
  });

  it.each(["abc", "-5", "0", "NaN"])("ignora valores inválidos (%s)", async (valor) => {
    vi.stubEnv("DEV_TEST_PRICE", valor);
    expect((await getProduct("producto-01"))?.price).toBeNull();
  });
});
