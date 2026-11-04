// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CartProvider } from "@/components/cart/CartProvider";
import { ProductDetail } from "@/components/ProductDetail";
import type { Product } from "@/data/products";

afterEach(cleanup);

const base: Product = {
  id: "t", slug: "t", name: "Remera", category: "remeras", price: 1000, colors: [{ name: "Negro", hex: "#191919" }], sizes: ["S", "M", "L"],
  images: ["/img/products/a.jpg"],
};
const show = (p: Product) => render(<CartProvider><ProductDetail product={p} /></CartProvider>);

describe("fotos del producto", () => {
  it("con una sola foto no hay miniaturas", () => {
    show(base);
    expect(screen.queryByRole("button", { name: /Ver imagen/ })).toBeNull();
  });

  it("con varias fotos hay miniaturas y la elegida queda marcada", () => {
    show({ ...base, images: ["/img/products/a.jpg", "/img/products/b.jpg", "/img/products/c.jpg"] });
    fireEvent.click(screen.getByRole("button", { name: "Ver imagen 3" }));
    expect(screen.getByRole("button", { name: "Ver imagen 3" }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("button", { name: "Ver imagen 1" }).getAttribute("aria-current")).toBe("false");
  });
});
