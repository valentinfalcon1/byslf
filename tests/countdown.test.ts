import { describe, expect, it } from "vitest";
import { countdownText, daysUntil, timeLeft } from "@/lib/countdown";

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

describe("timeLeft (temporizador)", () => {
  // El drop sale a las 00:00 de Córdoba (UTC-3) = 03:00 UTC del día de la fecha.
  it("desde el 22/10 a las 15:00 (Córdoba) faltan 53 días y 9 horas para las 00:00 del 15.12", () => {
    expect(timeLeft("15.12", NOW)).toEqual({ days: 53, hours: 9, minutes: 0, seconds: 0 });
  });
  it("cuenta hasta el segundo", () => {
    expect(timeLeft("15.12", new Date("2026-12-14T23:58:59Z"))).toEqual({ days: 0, hours: 3, minutes: 1, seconds: 1 });
    expect(timeLeft("15.12", new Date("2026-12-15T02:59:59Z"))).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 1 });
  });
  it("llegada la hora queda en ceros (no desaparece ni se va al año que viene el mismo día)", () => {
    expect(timeLeft("15.12", new Date("2026-12-15T03:00:00Z"))).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    expect(timeLeft("15.12", new Date("2026-12-15T15:00:00Z"))).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
  it("sin año, al día siguiente ya apunta al año que viene", () => {
    expect(timeLeft("15.12", new Date("2026-12-16T15:00:00Z"))!.days).toBeGreaterThan(360);
  });
  it("usa la hora de Córdoba: a las 01:00 UTC del 15/12 todavía es 14/12 allá", () => {
    expect(timeLeft("15.12", new Date("2026-12-15T01:00:00Z"))).toEqual({ days: 0, hours: 2, minutes: 0, seconds: 0 });
  });
  it("con año explícito que ya pasó, no muestra nada", () => expect(timeLeft("15.12.2025", NOW)).toBeNull());
  it.each([null, "", "???", "32.01", "31.02", "15.13"])("valor inválido (%s) → null", (v) => expect(timeLeft(v, NOW)).toBeNull());
  it("los días coinciden con daysUntil (sin contar la hora)", () => {
    const t = timeLeft("15.12", NOW)!;
    expect(t.days).toBe(daysUntil("15.12", NOW)! - 1); // faltan 53 días y 9 h; por calendario son 54 días
  });
});
