// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/data/products";

/** Modo presentación: se ve la tienda pero NO se puede comprar. Las constantes de lib/site se leen al cargar el módulo, por eso se reimportan. */

const product: Product = {
  id: "t", slug: "t", name: "Remera", category: "remeras", price: 55000, colors: [{ name: "Negro", hex: "#191919" }], sizes: ["S", "M", "L"],
  images: ["/img/products/a.jpg"],
};

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadDetail(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  const { CartProvider } = await import("@/components/cart/CartProvider");
  const { ProductDetail } = await import("@/components/ProductDetail");
  render(<CartProvider><ProductDetail product={product} /></CartProvider>);
}

describe("modo presentación", () => {
  it("la configuración: la presentación muestra la tienda pero no la abre", async () => {
    vi.stubEnv("NEXT_PUBLIC_PREVIEW", "true");
    vi.stubEnv("NEXT_PUBLIC_LAUNCHED", "false");
    vi.resetModules();
    const site = await import("@/lib/site");
    expect(site.PREVIEW).toBe(true);
    expect(site.LAUNCHED).toBe(false);
    expect(site.SHOP_VISIBLE).toBe(true);
  });

  it("por defecto (sin variables) todo sigue cerrado", async () => {
    vi.stubEnv("NEXT_PUBLIC_PREVIEW", "");
    vi.stubEnv("NEXT_PUBLIC_LAUNCHED", "");
    vi.resetModules();
    const site = await import("@/lib/site");
    expect(site.PREVIEW).toBe(false);
    expect(site.SHOP_VISIBLE).toBe(false);
  });

  it("la ficha muestra la prenda y el precio, pero en lugar de comprar avisa que todavía no se puede", async () => {
    await loadDetail({ NEXT_PUBLIC_PREVIEW: "true", NEXT_PUBLIC_LAUNCHED: "false" });
    expect(screen.getByRole("heading", { name: "Remera" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Agregar al carrito/i })).toBeNull();
    expect(screen.getByText("Todavía no se puede comprar")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Quiero el aviso" }).getAttribute("href")).toBe("/#newsletter");
  });

  it("con la tienda abierta sí se puede comprar", async () => {
    await loadDetail({ NEXT_PUBLIC_LAUNCHED: "true", NEXT_PUBLIC_PREVIEW: "" });
    expect(screen.getByRole("button", { name: /Agregar al carrito/i })).toBeTruthy();
    expect(screen.queryByText("Todavía no se puede comprar")).toBeNull();
  });

  it("el encabezado no muestra carrito ni buscador, y sí el acceso a la tienda", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_PREVIEW", "true");
    vi.stubEnv("NEXT_PUBLIC_LAUNCHED", "false");
    const { CartProvider } = await import("@/components/cart/CartProvider");
    const { Header } = await import("@/components/Header");
    render(<CartProvider><Header /></CartProvider>);
    expect(screen.queryByRole("button", { name: /^Carrito/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Buscar" })).toBeNull();
    expect(screen.getAllByRole("link", { name: "Tienda" }).length).toBeGreaterThan(0);
  });
});
