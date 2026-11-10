// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeroTimer } from "@/components/HeroTimer";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-12-14T23:58:59Z")); // faltan 3 h 1 min 1 s para las 00:00 del 15.12 en Córdoba
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const unit = (name: string) => document.querySelector(`[data-unit="${name}"]`)!.textContent;

describe("temporizador de la portada", () => {
  it("muestra días, horas, minutos y segundos con dos cifras", () => {
    render(<HeroTimer dropDate="15.12" />);
    expect([unit("Días"), unit("Horas"), unit("Min"), unit("Seg")]).toEqual(["00", "03", "01", "01"]);
  });

  it("avanza cada segundo", () => {
    render(<HeroTimer dropDate="15.12" />);
    act(() => { vi.advanceTimersByTime(1000); });
    expect([unit("Min"), unit("Seg")]).toEqual(["01", "00"]);
    act(() => { vi.advanceTimersByTime(1000); });
    expect([unit("Min"), unit("Seg")]).toEqual(["00", "59"]);
  });

  it("llegada la hora se queda en ceros", () => {
    render(<HeroTimer dropDate="15.12" />);
    act(() => { vi.advanceTimersByTime(4 * 3_600_000); });
    expect([unit("Días"), unit("Horas"), unit("Min"), unit("Seg")]).toEqual(["00", "00", "00", "00"]);
  });

  it("los lectores de pantalla leen una frase estable, y el conteo visual queda oculto para ellos", () => {
    const { container } = render(<HeroTimer dropDate="15.12" />);
    expect(screen.getByText("Falta 1 día")).toBeTruthy(); // el 14/12 a la noche, por calendario falta 1 día
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("con una fecha inválida muestra guiones, no números inventados", () => {
    render(<HeroTimer dropDate="???" />);
    expect([unit("Días"), unit("Seg")]).toEqual(["--", "--"]);
  });
});
