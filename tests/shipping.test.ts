import { describe, expect, it } from "vitest";
import { formatPrice } from "@/lib/format";
import { validateShipping } from "@/lib/shipping";

const valid = {
  name: "Ana", lastname: "Pérez", email: "ana@mail.com", phone: "351 555 1234",
  street: "Colón", number: "100", city: "Córdoba", province: "Córdoba", zip: "5000",
};

describe("validateShipping", () => {
  it("acepta datos válidos y recorta espacios", () => {
    const r = validateShipping({ ...valid, name: "  Ana  " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.name).toBe("Ana");
  });

  it("acepta teléfono con +54, DNI con puntos, CPA de 8 caracteres y campos opcionales vacíos", () => {
    const r = validateShipping({ ...valid, phone: "+54 9 351 555 1234", dni: "30.123.456", zip: "X5000ABC", floor: "3B" });
    expect(r.ok).toBe(true);
  });

  it("marca todos los obligatorios cuando viene vacío", () => {
    const r = validateShipping({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["city", "email", "lastname", "name", "number", "phone", "province", "street", "zip"]);
  });

  it.each([
    ["email", "mal"], ["email", "a@b"], ["phone", "12"], ["phone", "abc"], ["zip", "ABC"], ["zip", "50000"],
    ["province", "Atlantis"], ["dni", "12"],
  ])("rechaza %s inválido: %s", (campo, valor) => {
    const r = validateShipping({ ...valid, [campo]: valor });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveProperty(campo);
  });

  it("rechaza campos de largo absurdo", () => {
    const r = validateShipping({ ...valid, notes: "x".repeat(301), name: "a".repeat(61) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toMatchObject({ notes: expect.any(String), name: expect.any(String) });
  });

  it("no se deja engañar por tipos raros (null, números, objetos, arrays)", () => {
    for (const bad of [null, undefined, 5, "texto", [], { ...valid, email: { x: 1 } }, { ...valid, name: 123 }]) {
      expect(validateShipping(bad).ok).toBe(false);
    }
  });

  it("ignora campos extra que no existen en el formulario", () => {
    const r = validateShipping({ ...valid, admin: true, price: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).not.toHaveProperty("admin");
  });
});

describe("método de entrega", () => {
  it("sin método se asume envío a domicilio", () => {
    const r = validateShipping(valid);
    expect(r.ok && r.value.method).toBe("delivery");
  });

  it("con retiro no se pide la dirección", () => {
    const r = validateShipping({ method: "pickup", name: "Ana", lastname: "Pérez", email: "ana@mail.com", phone: "351 555 1234" });
    expect(r.ok && r.value.method).toBe("pickup");
  });

  it("con retiro sigue pidiendo nombre, apellido, email y teléfono", () => {
    const r = validateShipping({ method: "pickup" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["email", "lastname", "name", "phone"]);
  });

  it("con envío a domicilio la dirección sigue siendo obligatoria", () => {
    expect(validateShipping({ ...valid, method: "delivery", street: "" }).ok).toBe(false);
  });

  it("un método inventado se rechaza", () => {
    const r = validateShipping({ ...valid, method: "drone" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.method).toBeTruthy();
  });
});

describe("formatPrice", () => {
  it("muestra el placeholder si no hay precio", () => expect(formatPrice(null)).toBe("[PRECIO]"));
  it("formatea en pesos argentinos", () => expect(formatPrice(12500)).toMatch(/12\.500/));
});
