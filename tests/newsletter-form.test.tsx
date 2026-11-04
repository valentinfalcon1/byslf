// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Newsletter } from "@/components/Newsletter";
import { NewsletterAction } from "@/components/NewsletterAction";

const fetchMock = vi.fn();
const TOKEN = "a".repeat(64);

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const type = (v: string) => fireEvent.change(screen.getByLabelText("Tu email"), { target: { value: v } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: /sumarme/i }));

describe("formulario del newsletter", () => {
  it("manda el email (y el campo trampa vacío) a la API", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true, confirm: false }));
    render(<Newsletter />);
    type("ana@mail.com");
    submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/newsletter");
    expect(JSON.parse(init.body)).toEqual({ email: "ana@mail.com", website: "" });
  });

  it("sin dominio: dice 'ya sos parte'", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true, confirm: false }));
    render(<Newsletter />);
    type("ana@mail.com");
    submit();
    expect((await screen.findByRole("status")).textContent).toContain("ya sos parte");
  });

  it("con dominio: avisa que hay que confirmar por mail (y mirar Spam)", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true, confirm: true }));
    render(<Newsletter />);
    type("ana@mail.com");
    submit();
    const msg = (await screen.findByRole("status")).textContent ?? "";
    expect(msg).toContain("confirmar");
    expect(msg).toContain("Spam");
  });

  it("muestra el error del servidor y deja volver a intentar", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "Demasiados intentos. Probá de nuevo más tarde." }, { status: 429 }));
    render(<Newsletter />);
    type("ana@mail.com");
    submit();
    expect((await screen.findByRole("alert")).textContent).toContain("Demasiados intentos");
    expect((screen.getByRole("button", { name: /sumarme/i }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("si se cae la conexión o responde algo raro, muestra un mensaje claro", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<Newsletter />);
    type("ana@mail.com");
    submit();
    expect((await screen.findByRole("alert")).textContent).toMatch(/No pudimos anotarte|Failed/);
    fetchMock.mockResolvedValueOnce(new Response("<html>502</html>", { status: 502 }));
    submit();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("No pudimos anotarte"));
  });

  it("un doble clic no manda dos veces", async () => {
    let resolve!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    render(<Newsletter />);
    type("ana@mail.com");
    submit();
    fireEvent.submit(document.querySelector("form")!);
    fireEvent.submit(document.querySelector("form")!);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(Response.json({ ok: true, confirm: false }));
    await screen.findByRole("status");
  });

  it("el campo trampa existe pero está oculto para personas y lectores de pantalla", () => {
    render(<Newsletter />);
    const trampa = document.querySelector('input[name="website"]') as HTMLInputElement;
    expect(trampa).not.toBeNull();
    expect(trampa.tabIndex).toBe(-1);
    expect(trampa.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("si un bot completa el campo trampa, igual se manda (el servidor lo descarta)", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true, confirm: false }));
    render(<Newsletter />);
    type("bot@mail.com");
    fireEvent.change(document.querySelector('input[name="website"]')!, { target: { value: "spam.com" } });
    submit();
    await waitFor(() => expect(JSON.parse(fetchMock.mock.calls[0][1].body).website).toBe("spam.com"));
  });

  it("informa que se puede dar de baja y enlaza la política de privacidad", () => {
    render(<Newsletter />);
    expect(screen.getByText(/darte de baja cuando quieras/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Política de privacidad/i }).getAttribute("href")).toBe("/legal/privacidad");
  });

  it("el input tiene etiqueta, tipo email y es obligatorio", () => {
    render(<Newsletter />);
    const input = screen.getByLabelText("Tu email") as HTMLInputElement;
    expect(input.type).toBe("email");
    expect(input.required).toBe(true);
    expect(input.autocomplete).toBe("email");
  });
});

describe("páginas de confirmar y de baja", () => {
  it("NO actúa al abrir el link: hace falta tocar el botón (los antivirus abren links solos)", () => {
    render(<NewsletterAction action="baja" token={TOKEN} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Darme de baja" })).toBeTruthy();
  });

  it("confirmar: manda la acción y el token, y muestra el resultado", async () => {
    fetchMock.mockResolvedValue(Response.json({ result: "confirmed" }));
    render(<NewsletterAction action="confirmar" token={TOKEN} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar mi suscripción" }));
    expect((await screen.findByRole("status")).textContent).toContain("confirmada");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/newsletter/manage");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: "confirm", token: TOKEN });
  });

  it("baja: manda 'unsubscribe' y confirma la baja", async () => {
    fetchMock.mockResolvedValue(Response.json({ result: "unsubscribed" }));
    render(<NewsletterAction action="baja" token={TOKEN} />);
    fireEvent.click(screen.getByRole("button", { name: "Darme de baja" }));
    expect((await screen.findByRole("status")).textContent).toContain("Te diste de baja");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).action).toBe("unsubscribe");
  });

  it("link inválido (404): lo dice claro y no ofrece reintentar", async () => {
    fetchMock.mockResolvedValue(Response.json({ result: "invalid" }, { status: 404 }));
    render(<NewsletterAction action="baja" token={TOKEN} />);
    fireEvent.click(screen.getByRole("button", { name: "Darme de baja" }));
    expect((await screen.findByRole("alert")).textContent).toContain("no es válido");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("error de red: permite reintentar", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<NewsletterAction action="baja" token={TOKEN} />);
    fireEvent.click(screen.getByRole("button", { name: "Darme de baja" }));
    expect((await screen.findByRole("alert")).textContent).toContain("No pudimos procesar");
    expect((screen.getByRole("button", { name: "Darme de baja" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
