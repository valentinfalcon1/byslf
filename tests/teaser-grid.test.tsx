// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TeaserGrid } from "@/components/TeaserGrid";

const IMAGES = ["/img/look/hoodie.jpg", "/img/look/pants.jpg", "/img/look/label.jpg"];
afterEach(cleanup);

const renderGrid = (dropDate: string | null = "15.12") => render(<TeaserGrid images={IMAGES} dropDate={dropDate} />);
const front = (n: number) => screen.getByRole("button", { name: new RegExp(`Producto misterioso ${n} del Drop 001`) });
const backOf = (n: number) => document.querySelectorAll("article")[n - 1].querySelector(".face-back") as HTMLElement;
const isOpen = (n: number) => backOf(n).parentElement!.classList.contains("is-flipped");

describe("cards del drop", () => {
  it("hay una por producto, todas cerradas, y las fotos siguen tapadas (alt vacío)", () => {
    renderGrid();
    expect(screen.getAllByRole("button", { name: /Producto misterioso/ })).toHaveLength(3);
    for (const n of [1, 2, 3]) {
      expect(front(n).getAttribute("aria-expanded")).toBe("false");
      expect(isOpen(n)).toBe(false);
    }
    for (const img of document.querySelectorAll("article img")) expect(img.getAttribute("alt")).toBe("");
  });

  it("el precio es $ ??? en cada card y no hay ningún precio real en la página", () => {
    renderGrid();
    expect(screen.getAllByText("$ ???")).toHaveLength(3);
    expect(document.body.textContent).not.toContain("[PRECIO]");
    expect(document.body.textContent).not.toMatch(/\$\s?\d/); // ningún precio con número
  });

  it("el dorso cerrado es inalcanzable: inert y oculto para lectores de pantalla", () => {
    renderGrid();
    for (const n of [1, 2, 3]) {
      expect(backOf(n).hasAttribute("inert")).toBe(true);
      expect(backOf(n).getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("al tocar una card se da vuelta y muestra la fecha, los días y el botón para anotarse", () => {
    renderGrid();
    fireEvent.click(front(2));
    expect(isOpen(2)).toBe(true);
    expect(front(2).getAttribute("aria-expanded")).toBe("true");
    const back = within(backOf(2));
    expect(backOf(2).hasAttribute("inert")).toBe(false);
    expect(backOf(2).getAttribute("aria-hidden")).toBe("false");
    expect(back.getByText("15.12")).toBeTruthy();
    expect(back.getByText(/Falta(n)? \d+ días?|Es hoy/)).toBeTruthy();
    expect(back.getByRole("link", { name: "Quiero el aviso" }).getAttribute("href")).toBe("#newsletter");
  });

  it("sin fecha cargada muestra ??? y 'Fecha a confirmar' en vez de inventar un número", () => {
    renderGrid(null);
    fireEvent.click(front(1));
    const back = within(backOf(1));
    expect(back.getByText("???")).toBeTruthy();
    expect(back.getByText("Fecha a confirmar")).toBeTruthy();
  });

  it("al abrir, el foco va al botón de cerrar (para quien usa teclado o lector de pantalla)", () => {
    renderGrid();
    fireEvent.click(front(1));
    expect(document.activeElement).toBe(within(backOf(1)).getByRole("button", { name: "Cerrar" }));
  });

  it("Escape la cierra y el foco vuelve a la card", () => {
    renderGrid();
    fireEvent.click(front(1));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(isOpen(1)).toBe(false);
    expect(document.activeElement).toBe(front(1));
  });

  it("el botón ✕ la cierra y también tocar el fondo del dorso", () => {
    renderGrid();
    fireEvent.click(front(1));
    fireEvent.click(within(backOf(1)).getByRole("button", { name: "Cerrar" }));
    expect(isOpen(1)).toBe(false);
    fireEvent.click(front(1));
    fireEvent.click(backOf(1)); // el fondo vacío del dorso
    expect(isOpen(1)).toBe(false);
  });

  it("solo una card puede estar dada vuelta: abrir otra cierra la anterior (y no le roba el foco)", () => {
    renderGrid();
    fireEvent.click(front(1));
    fireEvent.click(front(3));
    expect(isOpen(1)).toBe(false);
    expect(isOpen(3)).toBe(true);
    expect(document.activeElement).toBe(within(backOf(3)).getByRole("button", { name: "Cerrar" }));
  });

  it("tocar afuera de la grilla la cierra", () => {
    renderGrid();
    fireEvent.click(front(2));
    act(() => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(isOpen(2)).toBe(false);
  });

  it("tocar el botón 'Quiero el aviso' cierra la card (y deja que el link lleve al newsletter)", () => {
    renderGrid();
    fireEvent.click(front(1));
    fireEvent.click(within(backOf(1)).getByRole("link", { name: "Quiero el aviso" }));
    expect(isOpen(1)).toBe(false);
  });

  it("cuando está abierta, el botón del frente sale del orden de tabulación (el dorso toma el foco)", () => {
    renderGrid();
    expect(front(1).tabIndex).toBe(0);
    fireEvent.click(front(1));
    expect(front(1).tabIndex).toBe(-1);
  });

  it("se puede abrir y cerrar varias veces seguidas sin quedar en un estado raro", () => {
    renderGrid();
    for (let i = 0; i < 4; i++) {
      fireEvent.click(front(1));
      expect(isOpen(1)).toBe(true);
      fireEvent.keyDown(document, { key: "Escape" });
      expect(isOpen(1)).toBe(false);
    }
  });
});
