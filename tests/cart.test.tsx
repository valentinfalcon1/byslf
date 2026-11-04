// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CartProvider, useCart } from "@/components/cart/CartProvider";

const wrapper = ({ children }: { children: ReactNode }) => <CartProvider>{children}</CartProvider>;
const setup = () => renderHook(() => useCart(), { wrapper });

const item = (over: Partial<Parameters<ReturnType<typeof useCart>["add"]>[0]> = {}) => ({
  slug: "producto-01", name: "Buzo", image: "/img/look/hoodie.jpg", price: 1000, color: "Negro", size: "M", ...over,
});

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("carrito", () => {
  it("arranca vacío", () => {
    const { result } = setup();
    expect(result.current.items).toEqual([]);
    expect(result.current.count).toBe(0);
    expect(result.current.subtotal).toBe(0);
  });

  it("agregar un producto lo suma y abre el carrito", () => {
    const { result } = setup();
    act(() => result.current.add(item()));
    expect(result.current.count).toBe(1);
    expect(result.current.isOpen).toBe(true);
  });

  it("agregar la misma variante suma cantidad en la misma línea", () => {
    const { result } = setup();
    act(() => result.current.add(item()));
    act(() => result.current.add(item()));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].qty).toBe(2);
    expect(result.current.count).toBe(2);
  });

  it("otro talle o color es otra línea", () => {
    const { result } = setup();
    act(() => result.current.add(item({ size: "M" })));
    act(() => result.current.add(item({ size: "L" })));
    act(() => result.current.add(item({ color: "Slate" })));
    expect(result.current.items).toHaveLength(3);
  });

  it("cambiar la cantidad, y con 0 se quita la línea", () => {
    const { result } = setup();
    act(() => result.current.add(item()));
    const key = result.current.items[0].key;
    act(() => result.current.setQty(key, 5));
    expect(result.current.count).toBe(5);
    act(() => result.current.setQty(key, 0));
    expect(result.current.items).toEqual([]);
  });

  it("quitar y vaciar", () => {
    const { result } = setup();
    act(() => result.current.add(item({ size: "M" })));
    act(() => result.current.add(item({ size: "L" })));
    act(() => result.current.remove(result.current.items[0].key));
    expect(result.current.items).toHaveLength(1);
    act(() => result.current.clear());
    expect(result.current.items).toEqual([]);
  });

  it("el subtotal suma precio × cantidad", () => {
    const { result } = setup();
    act(() => result.current.add(item({ price: 1000 })));
    act(() => result.current.add(item({ price: 1000 })));
    act(() => result.current.add(item({ size: "L", price: 500 })));
    expect(result.current.subtotal).toBe(2500);
  });

  it("si algún producto no tiene precio, el subtotal es null (se muestra [PRECIO])", () => {
    const { result } = setup();
    act(() => result.current.add(item({ price: 1000 })));
    act(() => result.current.add(item({ size: "L", price: null })));
    expect(result.current.subtotal).toBeNull();
  });
});

describe("persistencia en el navegador", () => {
  it("guarda el carrito y lo recupera al recargar", () => {
    const first = setup();
    act(() => first.result.current.add(item()));
    act(() => first.result.current.add(item()));
    first.unmount();

    const second = setup();
    expect(second.result.current.count).toBe(2);
    expect(second.result.current.items[0].name).toBe("Buzo");
  });

  it("no se rompe con datos corruptos en localStorage", () => {
    for (const basura of ["{roto", "null", '"texto"', "123", '{"a":1}', "[1,2,3]", '[{"slug":5}]', "[null]"]) {
      localStorage.setItem("byslf-cart", basura);
      const { result, unmount } = setup();
      expect(result.current.items, basura).toEqual([]);
      expect(() => result.current.count, basura).not.toThrow();
      unmount();
    }
  });

  it("descarta ítems manipulados (imagen externa, cantidades absurdas) pero conserva los sanos", () => {
    localStorage.setItem(
      "byslf-cart",
      JSON.stringify([
        { key: "a", slug: "producto-01", name: "Sano", image: "/img/look/hoodie.jpg", price: 1000, color: "Negro", size: "M", qty: 2 },
        { key: "b", slug: "producto-02", name: "Malo", image: "https://malo.example/x.jpg", price: 1000, color: "Negro", size: "M", qty: 1 },
        { key: "c", slug: "producto-03", name: "Malo", image: "/img/look/wall.jpg", price: 1000, color: "Negro", size: "M", qty: 99999 },
        { key: "d", slug: "producto-04", name: "Malo", image: "/img/look/wall.jpg", price: -5, color: "Negro", size: "M", qty: 1 },
      ]),
    );
    const { result } = setup();
    expect(result.current.items.map((i) => i.name)).toEqual(["Sano"]);
  });
});

describe("ClearCartOnMount (página de pago aprobado)", () => {
  it("vacía el carrito UNA sola vez, sin entrar en un bucle de renders", async () => {
    const { ClearCartOnMount } = await import("@/components/cart/ClearCartOnMount");
    const { render } = await import("@testing-library/react");
    localStorage.setItem(
      "byslf-cart",
      JSON.stringify([{ key: "a", slug: "producto-01", name: "Buzo", image: "/img/look/hoodie.jpg", price: 1000, color: "Negro", size: "M", qty: 1 }]),
    );
    let renders = 0;
    let latest!: ReturnType<typeof useCart>;
    function Probe() {
      latest = useCart();
      renders++;
      return null;
    }
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...a) => errors.push(a);
    try {
      render(<CartProvider><ClearCartOnMount /><Probe /></CartProvider>);
      await new Promise((r) => setTimeout(r, 50));
    } finally {
      console.error = original;
    }
    expect(latest.items).toEqual([]);
    expect(renders).toBeLessThan(10); // antes del arreglo: cientos (bucle infinito)
    expect(errors.join(" ")).not.toMatch(/Maximum update depth/);
  });

  it("las funciones del carrito mantienen su identidad entre renders (evita bucles de efectos)", () => {
    const { result, rerender } = setup();
    const antes = { open: result.current.open, close: result.current.close, clear: result.current.clear, add: result.current.add };
    act(() => result.current.add(item()));
    rerender();
    expect(result.current.open).toBe(antes.open);
    expect(result.current.close).toBe(antes.close);
    expect(result.current.clear).toBe(antes.clear);
    expect(result.current.add).toBe(antes.add);
  });
});
