import { expect, test, type Page } from "@playwright/test";

const SHIPPING = {
  name: "Ana", lastname: "Pérez", email: "ana@mail.com", areaCode: "351", phone: "5551234", dni: "30123456",
  street: "Colón", number: "100", floor: "3B", city: "Córdoba", zip: "5000", notes: "Timbre roto",
};

const cartCount = (page: Page) => page.getByRole("button", { name: /^Carrito, \d+ productos$/ });

async function addProduct(page: Page, size = "M") {
  await page.goto("/producto/producto-01");
  await page.getByRole("button", { name: size, exact: true }).click();
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  // El carrito se guarda en el navegador un instante después: si el test navega antes, /checkout lo ve vacío.
  await page.waitForFunction(() => (localStorage.getItem("byslf-cart") ?? "").includes("producto-01"));
}

async function fillShipping(page: Page) {
  for (const [id, value] of Object.entries(SHIPPING)) await page.locator(`#${id}`).fill(value);
  await page.locator("#province").selectOption("Córdoba");
}

test.describe("carrito", () => {
  test("no deja agregar sin elegir talle", async ({ page }) => {
    await page.goto("/producto/producto-01");
    await page.getByRole("button", { name: "Agregar al carrito" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText("Elegí tu talle"); // (Next tiene otro role=alert propio)
    await expect(cartCount(page)).toHaveAccessibleName("Carrito, 0 productos");
  });

  test("agregar abre el cajón, suma al contador y muestra el producto", async ({ page }) => {
    await addProduct(page);
    const drawer = page.getByRole("dialog", { name: "Carrito" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Byslf patch negra")).toBeVisible();
    await expect(drawer.getByText("Negro · Talle M")).toBeVisible();
    await expect(drawer.getByText("$ 1.000", { exact: false }).first()).toBeVisible(); // precio de prueba
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveAttribute("inert", ""); // cerrado: se desliza fuera y queda inalcanzable
    await expect(cartCount(page)).toHaveAccessibleName("Carrito, 1 productos");
  });

  test("sumar, restar y quitar actualizan cantidades y subtotal", async ({ page }) => {
    await addProduct(page);
    const drawer = page.getByRole("dialog", { name: "Carrito" });
    await drawer.getByRole("button", { name: /Sumar uno/ }).click();
    await expect(drawer.getByText("Subtotal").locator("xpath=following-sibling::*[1]")).toContainText("2.000");
    await drawer.getByRole("button", { name: /Restar uno/ }).click();
    await drawer.getByRole("button", { name: "Quitar" }).click();
    await expect(drawer.getByText("Todavía no hay nada")).toBeVisible();
  });

  test("el carrito sobrevive a recargar la página", async ({ page }) => {
    await addProduct(page);
    await page.reload();
    await expect(cartCount(page)).toHaveAccessibleName("Carrito, 1 productos");
  });

  test("un carrito corrupto en el navegador no rompe el sitio", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("byslf-cart", "null"));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(cartCount(page)).toHaveAccessibleName("Carrito, 0 productos");
  });
});

test.describe("datos de envío y pago", () => {
  // Un bucle de renders o un error de JavaScript no siempre rompe la página, pero la deja inestable: se exige consola limpia.
  test("la página de pago aprobado y el flujo de compra no tiran errores en la consola", async ({ page }) => {
    const errores: string[] = [];
    page.on("pageerror", (e) => errores.push(`pageerror: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && errores.push(`console: ${m.text()}`));
    await addProduct(page);
    await page.goto("/checkout");
    await page.goto("/checkout/success");
    await expect(page.getByRole("heading", { name: /Gracias por ser parte/i })).toBeVisible();
    await page.waitForTimeout(800);
    expect(errores, errores.join(" | ")).toEqual([]);
  });

  test("recorrido completo: validación, envío al servidor, redirección y carrito vaciado", async ({ page }) => {
    await addProduct(page, "L");
    await page.getByRole("dialog", { name: "Carrito" }).getByRole("link", { name: "Finalizar compra" }).click();
    await expect(page).toHaveURL(/\/checkout$/);

    // Sin datos: no manda nada y marca los errores
    let sent = 0;
    await page.route("**/api/checkout", async (route) => {
      sent++;
      await route.fulfill({ json: { url: "http://localhost:3200/checkout/success" } });
    });
    await page.getByLabel(/Leí y acepto/).check();
    await page.getByRole("button", { name: "Ir a pagar" }).click();
    await expect(page.locator("#name-error")).toBeVisible();
    await expect(page.locator("#name")).toBeFocused();
    expect(sent).toBe(0);

    // Con datos pero sin aceptar términos
    await page.getByLabel(/Leí y acepto/).uncheck();
    await fillShipping(page);
    await page.getByRole("button", { name: "Ir a pagar" }).click();
    await expect(page.locator("#terms-error")).toBeVisible();
    expect(sent).toBe(0);

    // Todo bien: sale una sola petición, con lo correcto
    await page.getByLabel(/Leí y acepto/).check();
    const [request] = await Promise.all([
      page.waitForRequest("**/api/checkout"),
      page.getByRole("button", { name: "Ir a pagar" }).click(),
    ]);
    const body = request.postDataJSON();
    expect(body.items).toEqual([{ slug: "producto-01", color: "Negro", size: "L", qty: 1 }]);
    expect(body.shipping).toMatchObject({ name: "Ana", email: "ana@mail.com", province: "Córdoba", zip: "5000", street: "Colón" });
    expect(body.acceptedTerms).toBe(true);
    expect(JSON.stringify(body.items)).not.toMatch(/price|1000/);

    // Vuelve del pago aprobado → página de gracias y carrito vacío
    await expect(page).toHaveURL(/\/checkout\/success$/);
    await expect(page.getByRole("heading", { name: /Gracias por ser parte/i })).toBeVisible();
    await expect(cartCount(page)).toHaveAccessibleName("Carrito, 0 productos");
    expect(sent).toBe(1);
  });

  test("si el servidor dice 'sin stock' se muestra el aviso y se puede reintentar", async ({ page }) => {
    await addProduct(page);
    await page.goto("/checkout");
    await page.route("**/api/checkout", (route) => route.fulfill({ status: 409, json: { error: "Sin stock: Byslf patch negra (Negro / M)." } }));
    await fillShipping(page);
    await page.getByLabel(/Leí y acepto/).check();
    await page.getByRole("button", { name: "Ir a pagar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Sin stock" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ir a pagar" })).toBeEnabled();
    await expect(page).toHaveURL(/\/checkout$/); // no se fue a pagar
  });

  test("transferencia: reserva, muestra los datos de la cuenta y 'Ya transferí' manda el aviso", async ({ page }) => {
    await addProduct(page);
    await page.goto("/checkout");
    const sent: { url: string; body: any }[] = [];
    await page.route("**/api/checkout", (route) => route.fulfill({ json: { transfer: { orderId: "11111111-1111-4111-8111-111111111111", code: "BYSLF-11111111", amount: 1000, shippingCost: 0, expiresAt: "2030-01-02T15:00:00.000Z" } } }));
    await page.route("**/api/checkout/transfer/notify", async (route) => {
      sent.push({ url: route.request().url(), body: route.request().postDataJSON() });
      await route.fulfill({ json: { status: "sent" } });
    });
    await fillShipping(page);
    await page.getByLabel("Transferencia bancaria").check();
    await page.getByLabel(/Leí y acepto/).check();
    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().endsWith("/api/checkout") && r.method() === "POST"),
      page.getByRole("button", { name: "Reservar y ver datos de transferencia" }).click(),
    ]);
    expect(request.postDataJSON().payment).toBe("transfer");

    await expect(page.getByRole("heading", { name: "Pagá por transferencia" })).toBeVisible();
    await expect(page.getByText("Transferí exactamente $ 1.000")).toBeVisible();
    await expect(page.getByText("BYSLF-11111111").first()).toBeVisible();
    await expect(cartCount(page)).toHaveAccessibleName("Carrito, 1 productos"); // todavía no se vació
    expect(sent).toHaveLength(0); // los datos de envío todavía no salieron

    await page.getByRole("button", { name: "Ya transferí, enviar comprobante" }).click();
    await expect(page.getByRole("status")).toContainText("Ya tenemos tus datos");
    expect(sent).toHaveLength(1);
    expect(sent[0].body.orderId).toBe("11111111-1111-4111-8111-111111111111");
    expect(sent[0].body.shipping).toMatchObject({ name: "Ana", email: "ana@mail.com", street: "Colón", zip: "5000" });
    await expect(cartCount(page)).toHaveAccessibleName("Carrito, 0 productos");
  });

  test("transferencia: se puede elegir con el teclado (flechas) y el botón cambia", async ({ page }) => {
    await addProduct(page);
    await page.goto("/checkout");
    await expect(page.getByRole("button", { name: "Ir a pagar" })).toBeVisible();
    await page.getByLabel("Mercado Pago").focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByLabel("Transferencia bancaria")).toBeChecked();
    await expect(page.getByRole("button", { name: "Reservar y ver datos de transferencia" })).toBeVisible();
  });

  test("el link de confirmación de transferencias no sirve sin firma válida (404)", async ({ page }) => {
    const res = await page.goto("/admin/confirmar?o=11111111-1111-4111-8111-111111111111&t=" + "0".repeat(64));
    expect(res?.status()).toBe(404);
    const res2 = await page.goto("/admin/confirmar");
    expect(res2?.status()).toBe(404);
  });

  test("envío a sucursal: pide provincia y sucursal (no la dirección) y las manda al servidor", async ({ page }) => {
    await addProduct(page);
    await page.goto("/checkout");
    await page.getByLabel(/Envío a sucursal/).check();
    await expect(page.locator("#street")).toHaveCount(0);
    await expect(page.locator("#branch")).toBeVisible();
    let body: any = null;
    await page.route("**/api/checkout", async (route) => {
      body = route.request().postDataJSON();
      await route.fulfill({ status: 422, json: { error: "x" } });
    });
    for (const [id, value] of Object.entries({ name: "Ana", lastname: "Pérez", email: "ana@mail.com", areaCode: "351", phone: "5551234", branch: "Sucursal Rosario Centro" })) await page.locator("#" + id).fill(value);
    await page.locator("#province").selectOption("Santa Fe");
    await page.getByLabel(/Leí y acepto/).check();
    await page.getByRole("button", { name: "Ir a pagar" }).click();
    await expect.poll(() => body).not.toBeNull();
    expect(body.shipping).toMatchObject({ method: "branch", province: "Santa Fe", branch: "Sucursal Rosario Centro", areaCode: "351", phone: "5551234" });
  });

  test("con el carrito vacío /checkout no muestra el formulario", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.getByText("Tu carrito está vacío")).toBeVisible();
    await expect(page.locator("#name")).toHaveCount(0);
  });

  test("el formulario se puede completar solo con el teclado (Tab)", async ({ page }) => {
    await addProduct(page);
    await page.goto("/checkout");
    await page.locator("#name").focus();
    const next = async (selector: string) => {
      await page.keyboard.press("Tab");
      await expect(page.locator(selector), `Tab debería llegar a ${selector}`).toBeFocused();
    };
    for (const id of ["lastname", "email", "areaCode", "phone", "dni"]) await next(`#${id}`);
    await next('input[name="method"]:checked'); // "Cómo lo recibís": las flechas cambian de opción
    for (const id of ["street", "number", "floor", "city", "zip", "province", "notes"]) await next(`#${id}`);
  });
});

test.describe("en celular (375px)", () => {
  test.use({ viewport: { width: 375, height: 740 } });

  for (const path of ["/", "/tienda", "/producto/producto-01", "/arrepentimiento", "/legal/privacidad", "/legal/terminos", "/legal/cookies", "/legal/cambios-y-devoluciones", "/checkout/success"]) {
    test(`${path} no se desborda hacia los costados`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, "ancho de más en px").toBeLessThanOrEqual(1);
    });
  }

  test("el formulario de envío es usable: campos a ancho completo y botón alcanzable", async ({ page }) => {
    await addProduct(page);
    await page.goto("/checkout");
    const box = await page.locator("#email").boundingBox();
    expect(box!.width).toBeGreaterThan(300);
    expect(box!.height).toBeGreaterThanOrEqual(48); // alto cómodo para el dedo
    await page.getByRole("button", { name: "Ir a pagar" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "Ir a pagar" })).toBeVisible();
  });

  test("la pantalla de transferencia se ve bien en celular (sin desbordar)", async ({ page }) => {
    await addProduct(page);
    await page.goto("/checkout");
    await page.route("**/api/checkout", (route) => route.fulfill({ json: { transfer: { orderId: "11111111-1111-4111-8111-111111111111", code: "BYSLF-11111111", amount: 1000, shippingCost: 0, expiresAt: "2030-01-02T15:00:00.000Z" } } }));
    await fillShipping(page);
    await page.getByLabel("Transferencia bancaria").check();
    await page.getByLabel(/Leí y acepto/).check();
    await page.getByRole("button", { name: "Reservar y ver datos de transferencia" }).click();
    await expect(page.getByRole("heading", { name: "Pagá por transferencia" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "ancho de más en px").toBeLessThanOrEqual(1);
    await page.getByRole("button", { name: "Ya transferí, enviar comprobante" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "Ya transferí, enviar comprobante" })).toBeVisible();
  });

  test("el newsletter tiene el input con altura normal y separado del botón", async ({ page }) => {
    await page.goto("/#newsletter");
    await page.waitForTimeout(1200); // termina el scroll suave hacia #newsletter
    // se miden los dos a la vez: si la página sigue moviéndose, la medición por separado da cualquier cosa
    const { inputH, gap } = await page.evaluate(() => {
      const i = document.getElementById("newsletter-email")!.getBoundingClientRect();
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Sumarme")!.getBoundingClientRect();
      return { inputH: i.height, gap: b.top - i.bottom };
    });
    expect(inputH).toBeGreaterThanOrEqual(48);
    expect(gap).toBeGreaterThanOrEqual(16);
  });
});

test.describe("tienda y producto", () => {
  test("los filtros de la tienda filtran de verdad y solo hay categorías con productos", async ({ page }) => {
    await page.goto("/tienda");
    const cards = page.locator("article");
    await expect(cards).toHaveCount(3);
    await expect(page.getByRole("button", { name: "Cargar más" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Buzos", exact: true })).toHaveCount(0); // sin productos, sin filtro
    await page.getByRole("button", { name: "Remeras", exact: true }).click();
    await expect(cards).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Remeras", exact: true })).toHaveAttribute("aria-pressed", "true");
  });

  test("la guía de talles abre y cierra (con una sola foto no hay miniaturas)", async ({ page }) => {
    await page.goto("/producto/producto-01");
    await expect(page.getByRole("button", { name: /Ver imagen/ })).toHaveCount(0); // una sola foto: sin miniaturas
    await page.getByRole("button", { name: "Guía de talles" }).click();
    await expect(page.getByRole("dialog", { name: "Guía de talles" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Guía de talles" })).toBeHidden();
  });

  test("la tabla de talles está en la página, resalta el talle elegido", async ({ page }) => {
    await page.goto("/producto/producto-01");
    await page.getByText("Tabla de talles", { exact: true }).click();
    const table = page.getByRole("table");
    await expect(table.getByRole("row")).toHaveCount(4); // encabezado + 3 talles
    await page.getByRole("button", { name: "M", exact: true }).click();
    await expect(table.locator("tr[aria-current=true] th")).toHaveText("M");
  });

  test("con la tienda abierta no hay sección de lanzamiento (primer vistazo)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#avance")).toHaveCount(0);
  });

  test("con la tienda abierta no hay temporizador en la portada", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("hero-timer")).toHaveCount(0);
  });

  test("un producto que no existe da 404", async ({ page }) => {
    const res = await page.goto("/producto/no-existe");
    expect(res?.status()).toBe(404);
  });
});

test.describe("legal y arrepentimiento", () => {
  test("las páginas legales cargan y el footer las enlaza", async ({ page }) => {
    for (const path of ["/legal/terminos", "/legal/privacidad", "/legal/cookies", "/legal/cambios-y-devoluciones", "/arrepentimiento"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page.getByRole("heading", { level: 1 }), path).toBeVisible();
    }
    await page.goto("/");
    for (const name of ["Términos y condiciones", "Política de privacidad", "Política de cookies", "Botón de arrepentimiento"]) {
      await expect(page.getByRole("contentinfo").getByRole("link", { name }).first()).toBeVisible();
    }
  });

  test("botón de arrepentimiento: sin registro, valida y muestra el código", async ({ page }) => {
    await page.route("**/api/arrepentimiento", (route) => route.fulfill({ json: { code: "ARR-7K3MQ9XD" } }));
    await page.goto("/arrepentimiento");
    await page.getByRole("button", { name: "Arrepentirme de mi compra" }).click();
    expect(await page.locator("#name").evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true); // obligatorio
    await page.locator("#name").fill("Ana Pérez");
    await page.locator("#email").fill("ana@mail.com");
    await page.getByRole("button", { name: "Arrepentirme de mi compra" }).click();
    await expect(page.getByText("ARR-7K3MQ9XD")).toBeVisible();
  });

  test("el aviso de cookies aparece una vez y se recuerda", async ({ page }) => {
    await page.goto("/");
    const notice = page.getByRole("region", { name: "Aviso de cookies" });
    await expect(notice).toBeVisible();
    await notice.getByRole("button", { name: "Entendido" }).click();
    await expect(notice).toBeHidden();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(notice).toBeHidden();
  });
});

test.describe("seguridad en el navegador", () => {
  test("las respuestas llevan cabeceras de seguridad y no revelan la tecnología", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["strict-transport-security"]).toContain("max-age");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("las APIs no se guardan en caché", async ({ request }) => {
    const res = await request.post("/api/checkout", { data: {} });
    expect(res.headers()["cache-control"]).toContain("no-store");
  });

  test("la API rechaza peticiones de otro origen", async ({ request }) => {
    const res = await request.post("/api/checkout", { headers: { origin: "https://malo.example" }, data: {} });
    expect(res.status()).toBe(403);
  });

  test("ningún secreto llega al navegador", async ({ page }) => {
    const bodies: string[] = [];
    page.on("response", async (r) => {
      if (/\.(js|html)(\?|$)/.test(r.url()) || r.request().resourceType() === "script" || r.request().resourceType() === "document") {
        bodies.push(await r.text().catch(() => ""));
      }
    });
    await page.goto("/checkout");
    await page.goto("/");
    const all = bodies.join("\n");
    for (const secreto of ["SUPABASE_SERVICE_ROLE_KEY", "MP_ACCESS_TOKEN", "RESEND_API_KEY", "service_role"]) {
      expect(all, `se filtró ${secreto}`).not.toContain(secreto);
    }
  });
});
