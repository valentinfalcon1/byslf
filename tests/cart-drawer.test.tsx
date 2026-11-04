// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartProvider, useCart } from "@/components/cart/CartProvider";

const CART = [
  { key: "producto-01|Negro|M", slug: "producto-01", name: "Buzo", image: "/img/look/hoodie.jpg", price: 1000, color: "Negro", size: "M", qty: 2 },
  { key: "producto-02|Slate|L", slug: "producto-02", name: "Pantalón", image: "/img/look/pants.jpg", price: 2500, color: "Slate", size: "L", qty: 1 },
];

// Abre el carrito desde afuera, como lo hace el botón de la bolsa del header.
let openCart: () => void;
function Opener() {
  openCart = useCart().open;
  return null;
}
const renderDrawer = () => {
  render(<CartProvider><Opener /><CartDrawer /></CartProvider>);
  act(() => openCart());
};

beforeEach(() => {
  localStorage.clear();
  document.body.style.overflow = "";
});
afterEach(cleanup);

describe("cajón del carrito", () => {
  it("vacío: invita a ir a la tienda", () => {
    renderDrawer();
    expect(screen.getByText(/Todavía no hay nada/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /ir a la tienda/i }).getAttribute("href")).toBe("/tienda");
  });

  it("con productos: muestra líneas, cantidades y subtotal", () => {
    localStorage.setItem("byslf-cart", JSON.stringify(CART));
    renderDrawer();
    expect(screen.getByText("Buzo")).toBeTruthy();
    expect(screen.getByText("Pantalón")).toBeTruthy();
    expect(screen.getByText("Negro · Talle M")).toBeTruthy();
    expect(screen.getByText("Subtotal").nextSibling?.textContent).toMatch(/4\.500/);
  });

  it("sumar y restar cantidad actualiza el subtotal", () => {
    localStorage.setItem("byslf-cart", JSON.stringify(CART));
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: /Sumar uno a Pantalón/i }));
    expect(screen.getByText("Subtotal").nextSibling?.textContent).toMatch(/7\.000/);
    fireEvent.click(screen.getByRole("button", { name: /Restar uno a Pantalón/i }));
    fireEvent.click(screen.getByRole("button", { name: /Restar uno a Pantalón/i })); // llega a 0 → se quita
    expect(screen.queryByText("Pantalón")).toBeNull();
  });

  it("'Quitar' saca la línea; sin líneas vuelve al estado vacío", () => {
    localStorage.setItem("byslf-cart", JSON.stringify([CART[0]]));
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Quitar" }));
    expect(screen.getByText(/Todavía no hay nada/i)).toBeTruthy();
  });

  it("si falta algún precio, el subtotal muestra [PRECIO] en vez de un número falso", () => {
    localStorage.setItem("byslf-cart", JSON.stringify([{ ...CART[0], price: null }]));
    renderDrawer();
    expect(screen.getByText("Subtotal").nextSibling?.textContent).toBe("[PRECIO]");
  });

  it("'Finalizar compra' lleva a los datos de envío (no paga directo)", () => {
    localStorage.setItem("byslf-cart", JSON.stringify(CART));
    renderDrawer();
    expect(screen.getByRole("link", { name: /finalizar compra/i }).getAttribute("href")).toBe("/checkout");
  });

  it("es un diálogo accesible: se cierra con Escape y devuelve el scroll de la página", () => {
    localStorage.setItem("byslf-cart", JSON.stringify(CART));
    renderDrawer();
    const dialog = screen.getByRole("dialog", { name: "Carrito" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.hasAttribute("inert")).toBe(false);
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.body.style.overflow).toBe("");
    expect(dialog.hasAttribute("inert")).toBe(true); // cerrado = fuera del alcance del teclado y del lector de pantalla
  });

  it("el botón cerrar funciona y el foco va a él al abrir", () => {
    localStorage.setItem("byslf-cart", JSON.stringify(CART));
    renderDrawer();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /cerrar carrito/i }));
    fireEvent.click(screen.getByRole("button", { name: /cerrar carrito/i }));
    expect(document.body.style.overflow).toBe("");
  });
});
