// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CartProvider } from "@/components/cart/CartProvider";
import { CheckoutForm } from "@/components/CheckoutForm";
import { goTo } from "@/lib/navigate";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));

const CART = [
  { key: "producto-01|Negro|M", slug: "producto-01", name: "Buzo", image: "/img/look/hoodie.jpg", price: 1000, color: "Negro", size: "M", qty: 2 },
  { key: "producto-02|Slate|L", slug: "producto-02", name: "Pantalón", image: "/img/look/pants.jpg", price: 2500, color: "Slate", size: "L", qty: 1 },
];

const VALID: Record<string, string> = {
  name: "Ana", lastname: "Pérez", email: "ana@mail.com", areaCode: "351", phone: "5551234", dni: "30123456",
  street: "Colón", number: "100", floor: "3B", city: "Córdoba", province: "Córdoba", zip: "5000", notes: "Timbre roto",
};

const fetchMock = vi.fn();

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("byslf-cart", JSON.stringify(CART));
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(goTo).mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderForm = () => render(<CartProvider><CheckoutForm /></CartProvider>);
const field = (id: string) => document.getElementById(id) as HTMLInputElement;
const fill = (data: Record<string, string> = VALID) => {
  for (const [id, value] of Object.entries(data)) fireEvent.change(field(id), { target: { value } });
};
const acceptTerms = () => fireEvent.click(screen.getByLabelText(/Leí y acepto/i));
const submit = () => fireEvent.click(screen.getByRole("button", { name: /ir a pagar/i }));

describe("página de datos de envío", () => {
  it("con el carrito vacío no muestra el formulario", () => {
    localStorage.clear();
    renderForm();
    expect(screen.getByText(/Tu carrito está vacío/i)).toBeTruthy();
    expect(document.getElementById("name")).toBeNull();
  });

  it("muestra el resumen del pedido con subtotal", () => {
    renderForm();
    expect(screen.getByText("Buzo")).toBeTruthy();
    expect(screen.getByText("Pantalón")).toBeTruthy();
    expect(screen.getByText("Subtotal").nextSibling?.textContent).toMatch(/4\.500/); // 2×1000 + 2500
  });

  it("todos los campos tienen etiqueta y los de contacto tienen autocompletado", () => {
    renderForm();
    for (const id of Object.keys(VALID)) {
      expect(field(id), id).not.toBeNull();
      expect(document.querySelector(`label[for="${id}"]`), `etiqueta de ${id}`).not.toBeNull();
    }
    expect(field("email").autocomplete).toBe("email");
    expect(field("zip").autocomplete).toBe("postal-code");
    expect(field("province").tagName).toBe("SELECT");
  });

  it("incluye las 24 jurisdicciones en provincia (más la opción vacía)", () => {
    renderForm();
    expect(field("province").querySelectorAll("option")).toHaveLength(25);
  });
});

describe("validación antes de enviar", () => {
  it("vacío: marca los obligatorios, enfoca el primero y NO llama al servidor", () => {
    renderForm();
    acceptTerms();
    submit();
    for (const id of ["name", "lastname", "email", "areaCode", "phone", "street", "number", "city", "province", "zip"]) {
      expect(field(id).getAttribute("aria-invalid"), id).toBe("true");
      expect(document.getElementById(`${id}-error`), id).not.toBeNull();
    }
    expect(field("dni").getAttribute("aria-invalid")).toBeNull(); // opcional
    expect(document.activeElement).toBe(field("name"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("el error de un campo desaparece apenas se corrige", () => {
    renderForm();
    submit();
    expect(document.getElementById("email-error")).not.toBeNull();
    fireEvent.change(field("email"), { target: { value: "ana@mail.com" } });
    expect(document.getElementById("email-error")).toBeNull();
  });

  it.each([
    ["email", "mal", /email/i],
    ["phone", "12", /celular/i],
    ["areaCode", "0351", /área/i],
    ["zip", "ABC", /postal/i],
  ])("rechaza %s inválido", (id, value, msg) => {
    renderForm();
    fill({ ...VALID, [id]: value });
    acceptTerms();
    submit();
    expect(document.getElementById(`${id}-error`)?.textContent).toMatch(msg);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no deja continuar sin aceptar términos y política de privacidad", () => {
    renderForm();
    fill();
    submit();
    expect(document.getElementById("terms-error")?.textContent).toMatch(/aceptarlos/i);
    expect(document.activeElement).toBe(document.getElementById("terms"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("los links de términos y privacidad existen", () => {
    renderForm();
    expect(screen.getByRole("link", { name: /Términos y condiciones/i }).getAttribute("href")).toBe("/legal/terminos");
    expect(screen.getByRole("link", { name: /Política de privacidad/i }).getAttribute("href")).toBe("/legal/privacidad");
  });
});

describe("envío del formulario", () => {
  it("manda solo qué y cuánto (sin precios) + datos de envío + aceptación, y redirige a Mercado Pago", async () => {
    fetchMock.mockResolvedValue(Response.json({ url: "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1" }));
    renderForm();
    fill();
    acceptTerms();
    submit();

    await waitFor(() => expect(goTo).toHaveBeenCalledWith("https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/checkout");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(init.body);
    expect(body.items).toEqual([
      { slug: "producto-01", color: "Negro", size: "M", qty: 2 },
      { slug: "producto-02", color: "Slate", size: "L", qty: 1 },
    ]);
    expect(JSON.stringify(body.items)).not.toMatch(/price|1000|2500|name|image/); // nada de precios ni nombres desde el navegador
    expect(body.shipping).toMatchObject({ name: "Ana", lastname: "Pérez", email: "ana@mail.com", province: "Córdoba", zip: "5000", street: "Colón", number: "100" });
    expect(body.acceptedTerms).toBe(true);
  });

  it("recorta espacios sobrantes antes de enviar", async () => {
    fetchMock.mockResolvedValue(Response.json({ url: "https://www.mercadopago.com.ar/x" }));
    renderForm();
    fill({ ...VALID, name: "   Ana   " });
    acceptTerms();
    submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).shipping.name).toBe("Ana");
  });

  it("mientras se procesa, el botón se bloquea: un doble clic no crea dos pagos", async () => {
    let resolve!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    renderForm();
    fill();
    acceptTerms();
    submit();
    await waitFor(() => expect((screen.getByRole("button", { name: /redirigiendo/i }) as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: /redirigiendo/i }));
    fireEvent.submit(document.querySelector("form")!);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(Response.json({ url: "https://www.mercadopago.com.ar/x" }));
    await waitFor(() => expect(goTo).toHaveBeenCalled());
  });

  it("si el servidor dice 'sin stock', lo muestra y deja volver a intentar (no se queda trabado)", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "Sin stock: Buzo (Negro / M)." }, { status: 409 }));
    renderForm();
    fill();
    acceptTerms();
    submit();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Sin stock"));
    expect(goTo).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: /ir a pagar/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("si el servidor rechaza datos (422), marca esos campos", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "Revisá los datos de envío.", fields: { zip: "Código postal inválido (ej. 5000)." } }, { status: 422 }));
    renderForm();
    fill();
    acceptTerms();
    submit();
    await waitFor(() => expect(document.getElementById("zip-error")?.textContent).toMatch(/postal/i));
    expect(goTo).not.toHaveBeenCalled();
  });

  it("si hay muchos intentos (429), muestra el mensaje del servidor", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "Demasiados intentos. Esperá unos minutos y probá de nuevo." }, { status: 429 }));
    renderForm();
    fill();
    acceptTerms();
    submit();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Demasiados intentos"));
  });

  it("si se cae la conexión, muestra un mensaje claro y no se queda cargando", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    renderForm();
    fill();
    acceptTerms();
    submit();
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect((screen.getByRole("button", { name: /ir a pagar/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("si el servidor responde algo que no es JSON, no explota", async () => {
    fetchMock.mockResolvedValue(new Response("<html>502</html>", { status: 502 }));
    renderForm();
    fill();
    acceptTerms();
    submit();
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(goTo).not.toHaveBeenCalled();
  });
});

describe("costo y método de entrega", () => {
  const envio = () => screen.getByText("Envío").nextSibling?.textContent;
  const total = () => screen.getByText("Total").nextSibling?.textContent;

  it("en Córdoba capital el envío es gratis y el total es igual al subtotal", () => {
    renderForm();
    fill();
    expect(envio()).toBe("Gratis");
    expect(total()).toMatch(/4\.500/);
  });

  it("sin provincia pide elegirla, y a una zona sin tarifa avisa que no se envía todavía", () => {
    renderForm();
    expect(envio()).toBe("Elegí tu provincia");
    fill({ province: "Salta" });
    expect(envio()).toBe("[A DEFINIR]");
    expect(screen.getByText(/Todavía no enviamos a tu zona/i)).toBeTruthy();
  });

  it("en el resto de Córdoba no es gratis, y sin código postal lo pide", () => {
    renderForm();
    fill({ province: "Córdoba", zip: "" });
    expect(envio()).toBe("Ingresá tu código postal");
    fill({ zip: "5800" });
    expect(envio()).toBe("[A DEFINIR]");
    expect(screen.getByText(/Todavía no enviamos a tu zona/i)).toBeTruthy();
  });

  it("con retiro el envío es gratis en cualquier provincia y se oculta la dirección", () => {
    renderForm();
    fill({ province: "Salta" });
    fireEvent.click(screen.getByLabelText(/Retiro en Córdoba/i));
    expect(envio()).toBe("Gratis");
    expect(document.getElementById("street")).toBeNull();
    expect(screen.getByText(/PUNTO DE RETIRO/)).toBeTruthy();
    expect(screen.queryByText(/Todavía no enviamos a tu zona/i)).toBeNull();
  });

  it("con retiro se puede pagar sin dirección y se manda method: pickup", async () => {
    fetchMock.mockResolvedValue(Response.json({ url: "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1" }));
    renderForm();
    fireEvent.click(screen.getByLabelText(/Retiro en Córdoba/i));
    fill({ name: "Ana", lastname: "Pérez", email: "ana@mail.com", areaCode: "351", phone: "5551234" });
    acceptTerms();
    submit();
    await waitFor(() => expect(goTo).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.shipping.method).toBe("pickup");
    expect(body).not.toHaveProperty("cost");
  });

  it("volver a envío a domicilio vuelve a pedir la dirección", () => {
    renderForm();
    fireEvent.click(screen.getByLabelText(/Retiro en Córdoba/i));
    fireEvent.click(screen.getByLabelText(/Envío a domicilio/i));
    expect(document.getElementById("street")).not.toBeNull();
  });
});


describe("pago por transferencia", () => {
  const TRANSFER = { orderId: "11111111-1111-4111-8111-111111111111", code: "BYSLF-11111111", amount: 4500, shippingCost: 0, expiresAt: "2030-01-02T15:00:00.000Z" };
  const reserve = async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ transfer: TRANSFER }));
    renderForm();
    fill();
    fireEvent.click(screen.getByLabelText(/Transferencia bancaria/i));
    acceptTerms();
    fireEvent.click(screen.getByRole("button", { name: /reservar y ver datos/i }));
    await waitFor(() => expect(screen.getByText(/Pagá por transferencia/i)).toBeTruthy());
  };

  it("por defecto se paga con Mercado Pago y el botón no cambia", () => {
    renderForm();
    expect((screen.getByLabelText(/Mercado Pago/i) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("button", { name: /ir a pagar/i })).toBeTruthy();
  });

  it("al elegir transferencia el botón dice que reserva y se manda payment: transfer", async () => {
    await reserve();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.payment).toBe("transfer");
    expect(goTo).not.toHaveBeenCalled(); // no se redirige a Mercado Pago
  });

  it("muestra monto, código y datos de la cuenta, y NO vacía el carrito todavía", async () => {
    await reserve();
    expect(screen.getByText(/Transferí exactamente/i).textContent).toMatch(/4\.500/);
    expect(screen.getAllByText("BYSLF-11111111").length).toBeGreaterThan(0);
    expect(screen.getByText("[ALIAS]")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("byslf-cart") ?? "[]")).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1); // los datos de envío todavía NO salieron hacia el mail
  });

  it("'Ya transferí' manda el pedido y los datos de envío, y vacía el carrito", async () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    await reserve();
    fetchMock.mockResolvedValueOnce(Response.json({ status: "sent" }));
    fireEvent.click(screen.getByRole("button", { name: /ya transferí/i }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/Ya tenemos tus datos/i));
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/checkout/transfer/notify");
    const body = JSON.parse(init.body);
    expect(body.orderId).toBe(TRANSFER.orderId);
    expect(body.shipping).toMatchObject({ name: "Ana", email: "ana@mail.com", street: "Colón", zip: "5000" });
    expect(JSON.parse(localStorage.getItem("byslf-cart") ?? "[]")).toEqual([]);
    expect(open.mock.calls[0][0]).toBe("https://ig.me/m/byslfco"); // abre el chat de Instagram de la marca
  });

  it("el doble clic en 'Ya transferí' manda una sola petición", async () => {
    await reserve();
    fetchMock.mockImplementationOnce(() => new Promise((r) => setTimeout(() => r(Response.json({ status: "sent" })), 30)));
    const b = screen.getByRole("button", { name: /ya transferí/i });
    fireEvent.click(b);
    fireEvent.click(b);
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(2); // reserva + un solo aviso
  });

  it("si falla el aviso muestra el error, conserva el carrito y deja reintentar", async () => {
    await reserve();
    fetchMock.mockResolvedValueOnce(Response.json({ error: "No pudimos enviar tus datos. Probá de nuevo en un momento." }, { status: 502 }));
    fireEvent.click(screen.getByRole("button", { name: /ya transferí/i }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/No pudimos enviar/i));
    expect(JSON.parse(localStorage.getItem("byslf-cart") ?? "[]")).toHaveLength(2);
    expect((screen.getByRole("button", { name: /ya transferí/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("si el servidor dice que no hay stock, se queda en el formulario", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: "Sin stock: Buzo (Negro / M)." }, { status: 409 }));
    renderForm();
    fill();
    fireEvent.click(screen.getByLabelText(/Transferencia bancaria/i));
    acceptTerms();
    fireEvent.click(screen.getByRole("button", { name: /reservar y ver datos/i }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Sin stock/));
    expect(screen.queryByText(/Pagá por transferencia/i)).toBeNull();
  });
});

describe("envío a sucursal de Correo Argentino", () => {
  const BRANCH = { name: "Ana", lastname: "Pérez", email: "ana@mail.com", areaCode: "351", phone: "5551234", province: "Santa Fe", branch: "Sucursal Rosario Centro" };
  const chooseBranch = () => fireEvent.click(screen.getByLabelText(/Envío a sucursal/i));

  it("muestra provincia y sucursal de destino, y oculta la dirección", () => {
    renderForm();
    chooseBranch();
    expect(document.getElementById("branch")).not.toBeNull();
    expect(document.getElementById("province")).not.toBeNull();
    expect(document.getElementById("street")).toBeNull();
    expect(document.getElementById("zip")).toBeNull();
  });

  it("vacío: marca provincia y sucursal como obligatorias", () => {
    renderForm();
    chooseBranch();
    acceptTerms();
    submit();
    for (const id of ["province", "branch"]) expect(field(id).getAttribute("aria-invalid"), id).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("se manda method: branch con la sucursal elegida", async () => {
    fetchMock.mockResolvedValue(Response.json({ url: "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1" }));
    renderForm();
    chooseBranch();
    fill(BRANCH);
    acceptTerms();
    submit();
    await waitFor(() => expect(goTo).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.shipping).toMatchObject({ method: "branch", province: "Santa Fe", branch: "Sucursal Rosario Centro", areaCode: "351", phone: "5551234" });
  });

  it("sin tarifa para esa provincia avisa que no se envía todavía", () => {
    renderForm();
    chooseBranch();
    fill({ province: "Santa Fe" });
    expect(screen.getByText(/Todavía no enviamos a tu zona/i)).toBeTruthy();
  });

  it("volver a domicilio vuelve a pedir la dirección", () => {
    renderForm();
    chooseBranch();
    fireEvent.click(screen.getByLabelText(/Envío a domicilio/i));
    expect(document.getElementById("street")).not.toBeNull();
    expect(document.getElementById("branch")).toBeNull();
  });
});
