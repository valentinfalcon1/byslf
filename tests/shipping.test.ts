import { describe, expect, it } from "vitest";
import { formatPrice } from "@/lib/format";
import { validateShipping } from "@/lib/shipping";

const valid = {
  name: "Ana", lastname: "Pérez", email: "ana@mail.com", areaCode: "351", phone: "5551234",
  street: "Colón", number: "100", city: "Córdoba", province: "Córdoba", zip: "5000",
};

describe("validateShipping", () => {
  it("acepta datos válidos y recorta espacios", () => {
    const r = validateShipping({ ...valid, name: "  Ana  " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.name).toBe("Ana");
  });

  it("acepta celular con guion, DNI con puntos, CPA de 8 caracteres y campos opcionales vacíos", () => {
    const r = validateShipping({ ...valid, phone: "555-1234", dni: "30.123.456", zip: "X5000ABC", floor: "3B" });
    expect(r.ok).toBe(true);
  });

  it("marca todos los obligatorios cuando viene vacío", () => {
    const r = validateShipping({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["areaCode", "city", "email", "lastname", "name", "number", "phone", "province", "street", "zip"]);
  });

  it.each([
    ["email", "mal"], ["email", "a@b"], ["phone", "12"], ["phone", "abc"], ["phone", "3515551234"], ["areaCode", "0351"], ["areaCode", "3"], ["areaCode", "35a"], ["zip", "ABC"], ["zip", "50000"],
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
    const r = validateShipping({ method: "pickup", name: "Ana", lastname: "Pérez", email: "ana@mail.com", areaCode: "351", phone: "5551234" });
    expect(r.ok && r.value.method).toBe("pickup");
  });

  it("con retiro sigue pidiendo nombre, apellido, email y teléfono", () => {
    const r = validateShipping({ method: "pickup" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["areaCode", "email", "lastname", "name", "phone"]);
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

describe("envío a sucursal de Correo Argentino", () => {
  const base = { method: "branch", name: "Ana", lastname: "Pérez", email: "ana@mail.com", areaCode: "351", phone: "5551234", province: "Santa Fe", branch: "Sucursal Rosario Centro" };

  it("pide provincia y sucursal, pero no la dirección ni el código postal", () => {
    const r = validateShipping(base);
    expect(r.ok && r.value.method).toBe("branch");
    expect(r.ok && r.value.branch).toBe("Sucursal Rosario Centro");
  });

  it("sin sucursal o sin provincia no pasa", () => {
    const r = validateShipping({ ...base, branch: "", province: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["branch", "province"]);
  });

  it("una provincia inventada se rechaza", () => {
    expect(validateShipping({ ...base, province: "Atlantis" }).ok).toBe(false);
  });

  it("la sucursal tiene un largo máximo", () => {
    expect(validateShipping({ ...base, branch: "x".repeat(121) }).ok).toBe(false);
  });

  it("a domicilio NO se pide la sucursal", () => {
    expect(validateShipping({ ...valid, branch: "" }).ok).toBe(true);
  });
});
