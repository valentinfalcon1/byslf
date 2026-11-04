import { describe, expect, it } from "vitest";
import { countdownText, daysUntil } from "@/lib/countdown";

// 22 de octubre de 2026, 15:00 en Córdoba (UTC-3) = 18:00 UTC
const NOW = new Date("2026-10-22T18:00:00Z");

describe("daysUntil", () => {
  it("cuenta los días hasta el 15.12 desde el 22 de octubre", () => expect(daysUntil("15.12", NOW)).toBe(54));
  it("es 0 el mismo día y 1 el día anterior", () => {
    expect(daysUntil("22.10", NOW)).toBe(0);
    expect(daysUntil("23.10", NOW)).toBe(1);
  });
  it("una fecha sin año que ya pasó este año se toma del año que viene", () => {
    expect(daysUntil("21.10", NOW)).toBe(364);
    expect(daysUntil("01.01", NOW)).toBe(71);
  });
  it("usa la hora de Córdoba: a las 01:00 UTC del 23/10 todavía es 22/10 allá", () => {
    expect(daysUntil("23.10", new Date("2026-10-23T01:00:00Z"))).toBe(1);
    expect(daysUntil("22.10", new Date("2026-10-23T01:00:00Z"))).toBe(0);
  });
  it("con año explícito: cuenta hacia ese año y, si ya pasó, no muestra nada", () => {
    expect(daysUntil("15.12.2027", NOW)).toBe(419);
    expect(daysUntil("15.12.2025", NOW)).toBeNull();
  });
  it("acepta días y meses de un dígito", () => expect(daysUntil("5.11", NOW)).toBe(14));
  it.each([null, "", "???", "15/12", "32.01", "00.05", "15.13", "31.02", "29.02.2027", "abc.def", "15.12.26"])("valor inválido o imposible (%s) → null", (v) => {
    expect(daysUntil(v, NOW)).toBeNull();
  });
  it("el 29.02 sin año salta al próximo año bisiesto válido o devuelve null, nunca un número absurdo", () => {
    const d = daysUntil("29.02", NOW);
    expect(d === null || (d >= 0 && d < 1500)).toBe(true);
  });
});

describe("countdownText", () => {
  it.each([
    [null, "Fecha a confirmar"],
    [0, "Es hoy"],
    [1, "Falta 1 día"],
    [2, "Faltan 2 días"],
    [54, "Faltan 54 días"],
  ])("%s → %s", (days, text) => expect(countdownText(days)).toBe(text));
});
