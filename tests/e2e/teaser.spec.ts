import { expect, test, type Page } from "@playwright/test";

/** El sitio tal como está hoy: modo misterioso, sin tienda. Nada de producto ni de compra tiene que quedar expuesto. */

test("la Home no muestra productos ni precios, solo el teaser", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Create more");
  await expect(page.getByText("Drop 001").first()).toBeVisible();
  await expect(page.getByText("???").first()).toBeVisible();
  await expect(page.getByText("[PRECIO]")).toHaveCount(0);
  await expect(page.getByText("Byslf patch")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Carrito/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Buscar" })).toHaveCount(0);
});

test("las fotos del drop no se pueden ver (ni en el HTML ni en las alt)", async ({ page }) => {
  await page.goto("/");
  const teaserImgs = page.locator("#drop img");
  for (let i = 0; i < (await teaserImgs.count()); i++) expect(await teaserImgs.nth(i).getAttribute("alt")).toBe("");
});

test("/tienda muestra 'Próximamente' y no la tienda", async ({ page }) => {
  await page.goto("/tienda");
  await expect(page.getByRole("heading", { name: "Próximamente" })).toBeVisible();
  await expect(page.locator("article")).toHaveCount(0);
});

test("/producto/... redirige a Próximamente (no revela qué productos existen)", async ({ page }) => {
  for (const slug of ["producto-01", "no-existe"]) {
    await page.goto(`/producto/${slug}`);
    await expect(page).toHaveURL(/\/tienda$/);
    await expect(page.getByRole("heading", { name: "Próximamente" })).toBeVisible();
  }
});

test("/checkout redirige al inicio", async ({ page }) => {
  await page.goto("/checkout");
  await expect(page).toHaveURL(/\/$/);
});

test("el aviso de la barra superior lleva al newsletter", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Anotate al aviso/ }).click();
  await expect(page.locator("#newsletter-email")).toBeVisible();
});

test("el botón de arrepentimiento y las páginas legales están disponibles igual", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Botón de arrepentimiento" })).toBeVisible();
  expect((await page.goto("/legal/privacidad"))?.status()).toBe(200);
});

test.describe("en celular (375px) el sitio de hoy no se corta ni se desborda", () => {
  test.use({ viewport: { width: 375, height: 740 } });

  for (const path of ["/", "/tienda", "/arrepentimiento", "/legal/terminos", "/legal/privacidad", "/legal/cookies", "/legal/cambios-y-devoluciones"]) {
    test(path, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "ancho de más en px").toBeLessThanOrEqual(1);
      // ningún título se corta: el texto de cada h1 tiene que caber dentro de la pantalla
      const cortados = await page.evaluate(() =>
        [...document.querySelectorAll("h1, h2")].filter((h) => !h.closest("[inert]") && h.getBoundingClientRect().right > window.innerWidth + 1) // el carrito cerrado está fuera de pantalla a propósito.map((h) => h.textContent),
      );
      expect(cortados).toEqual([]);
    });
  }
});

test.describe("newsletter", () => {
  test("anotarse: manda el email y muestra la confirmación", async ({ page }) => {
    let body: { email?: string; website?: string } = {};
    await page.route("**/api/newsletter", async (route) => {
      body = route.request().postDataJSON();
      await route.fulfill({ json: { ok: true, confirm: true } });
    });
    await page.goto("/#newsletter");
    await page.locator("#newsletter-email").fill("ana@mail.com");
    await page.getByRole("button", { name: "Sumarme" }).click();
    await expect(page.getByRole("status")).toContainText("confirmar");
    expect(body).toEqual({ email: "ana@mail.com", website: "" });
  });

  test("si el servidor rechaza, muestra el aviso y se puede reintentar", async ({ page }) => {
    await page.route("**/api/newsletter", (route) => route.fulfill({ status: 429, json: { error: "Demasiados intentos. Probá de nuevo más tarde." } }));
    await page.goto("/#newsletter");
    await page.locator("#newsletter-email").fill("ana@mail.com");
    await page.getByRole("button", { name: "Sumarme" }).click();
    await expect(page.locator("#newsletter-error")).toContainText("Demasiados intentos");
    await expect(page.getByRole("button", { name: "Sumarme" })).toBeEnabled();
  });

  test("el navegador exige un email válido antes de enviar", async ({ page }) => {
    let calls = 0;
    await page.route("**/api/newsletter", (route) => { calls++; return route.fulfill({ json: { ok: true } }); });
    await page.goto("/#newsletter");
    await page.locator("#newsletter-email").fill("esto-no-es-un-email");
    await page.getByRole("button", { name: "Sumarme" }).click();
    expect(await page.locator("#newsletter-email").evaluate((el: HTMLInputElement) => el.validity.typeMismatch)).toBe(true);
    expect(calls).toBe(0);
  });

  test("link de confirmación: hace falta tocar el botón, y funciona", async ({ page }) => {
    let calls = 0;
    await page.route("**/api/newsletter/manage", async (route) => {
      calls++;
      expect(route.request().postDataJSON()).toEqual({ action: "confirm", token: "b".repeat(64) });
      await route.fulfill({ json: { result: "confirmed" } });
    });
    await page.goto(`/newsletter/confirmar?t=${"b".repeat(64)}`);
    expect(calls).toBe(0); // abrir el link NO confirma solo
    await page.getByRole("button", { name: "Confirmar mi suscripción" }).click();
    await expect(page.getByRole("status")).toContainText("confirmada");
    expect(calls).toBe(1);
  });

  test("link de baja: funciona, y un link inválido no ofrece ninguna acción", async ({ page }) => {
    await page.route("**/api/newsletter/manage", (route) => route.fulfill({ json: { result: "unsubscribed" } }));
    await page.goto(`/newsletter/baja?t=${"c".repeat(64)}`);
    await page.getByRole("button", { name: "Darme de baja" }).click();
    await expect(page.getByRole("status")).toContainText("Te diste de baja");

    await page.goto("/newsletter/baja?t=corto");
    await expect(page.locator('p[role="alert"]')).toContainText("no es válido"); // (Next tiene otro role=alert propio)
    await expect(page.getByRole("button", { name: "Darme de baja" })).toHaveCount(0);
    expect((await page.goto("/newsletter/otra-cosa?t=" + "c".repeat(64)))?.status()).toBe(404);
  });

  test("las páginas de confirmar/baja no se indexan en buscadores", async ({ page }) => {
    await page.goto(`/newsletter/baja?t=${"c".repeat(64)}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("en celular el formulario no se desborda", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    for (const path of ["/newsletter/baja?t=" + "c".repeat(64), "/newsletter/confirmar?t=corto"]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    }
  });
});

test.describe("animaciones e interacción de las cards", () => {
  const card = (page: Page, n: number) => page.locator("#drop article").nth(n - 1);
  const front = (page: Page, n: number) => page.getByRole("button", { name: new RegExp(`Producto misterioso ${n} del Drop 001`) });
  const cssVar = (page: Page, n: number, v: string) => card(page, n).locator(".tilt").evaluate((el, name) => el.style.getPropertyValue(name), v);

  test("con el mouse, la card se inclina y sigue al cursor, y vuelve a su lugar al salir", async ({ page }) => {
    await page.goto("/");
    await page.locator("#drop").scrollIntoViewIfNeeded();
    const box = (await card(page, 2).locator(".tilt").boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.15, { steps: 6 });
    await expect.poll(() => cssVar(page, 2, "--ry")).not.toBe("");
    expect(parseFloat(await cssVar(page, 2, "--ry"))).toBeGreaterThan(3); // cursor a la derecha → gira hacia la derecha
    expect(parseFloat(await cssVar(page, 2, "--rx"))).toBeGreaterThan(3); // cursor arriba → se inclina hacia arriba
    await page.mouse.move(5, 5);
    await expect.poll(() => cssVar(page, 2, "--ry")).toBe("");
  });

  test("tocar la card la da vuelta: muestra fecha, días y botón; Escape la cierra y devuelve el foco", async ({ page }) => {
    await page.goto("/");
    await page.locator("#drop").scrollIntoViewIfNeeded();
    await front(page, 1).click();
    const back = card(page, 1).locator(".face-back");
    await expect(back.getByText("15.12")).toBeVisible();
    await expect(back.getByText(/Falta(n)? \d+ días?|Es hoy/)).toBeVisible();
    await expect(back.getByRole("button", { name: "Cerrar" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(card(page, 1).locator(".card3d")).not.toHaveClass(/is-flipped/);
    await expect(front(page, 1)).toBeFocused();
  });

  test("se maneja solo con el teclado: Enter la abre, Tab llega al botón, Escape la cierra", async ({ page }) => {
    await page.goto("/");
    await front(page, 1).focus();
    await page.keyboard.press("Enter");
    await expect(card(page, 1).locator(".card3d")).toHaveClass(/is-flipped/);
    await page.keyboard.press("Tab"); // desde "Cerrar" pasa al botón "Quiero el aviso" del dorso
    await expect(card(page, 1).getByRole("link", { name: "Quiero el aviso" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(card(page, 1).locator(".card3d")).not.toHaveClass(/is-flipped/);
    await page.keyboard.press("Tab");
    await expect(front(page, 2)).toBeFocused(); // el orden de tabulación sigue siendo lógico
  });

  test("'Quiero el aviso' del dorso lleva al formulario del newsletter y cierra la card", async ({ page }) => {
    await page.goto("/");
    await page.locator("#drop").scrollIntoViewIfNeeded();
    await front(page, 3).click();
    await card(page, 3).getByRole("link", { name: "Quiero el aviso" }).click();
    await expect(page.locator("#newsletter-email")).toBeInViewport({ timeout: 5000 });
    await expect(card(page, 3).locator(".card3d")).not.toHaveClass(/is-flipped/);
  });

  test("con la card dada vuelta, los clics llegan al DORSO (el frente no los tapa)", async ({ page }) => {
    // El aviso de cookies está fijo al pie de la pantalla y, según el scroll, puede tapar la parte baja de la card:
    // se lo da por aceptado para medir solo lo que importa acá (card contra card).
    await page.addInitScript(() => localStorage.setItem("byslf-cookie-notice", "1"));
    await page.goto("/");
    await page.locator("#drop").scrollIntoViewIfNeeded();
    // IMPORTANTE: se mide con el mouse ENCIMA de la card, que es lo que pasa cuando una persona va a tocar la ✕.
    // (El bug original solo aparecía en ese estado: con el mouse afuera, Chrome mandaba bien los clics.)
    await front(page, 1).click();
    // Espera a que terminen de verdad el giro y el enderezado (no un tiempo fijo) y a que la página deje de moverse.
    // (solo transiciones: las animaciones de brillo y estrellas son infinitas y nunca "terminan")
    await page.evaluate(() =>
      Promise.all(
        [...document.querySelectorAll("#drop article:first-child .card3d, #drop article:first-child .tilt-inner")].flatMap((el) =>
          el.getAnimations().filter((a) => a instanceof CSSTransition).map((a) => a.finished),
        ),
      ),
    );
    // Medir y consultar en el MISMO instante: si la página se mueve entre un paso y otro, los puntos dejan de coincidir.
    // Puntos bien adentro: las esquinas están redondeadas (18px) y un punto pegado al borde puede caer afuera.
    const resultado = await page.evaluate(() => {
      const r = document.querySelector("#drop article .face-back")!.getBoundingClientRect();
      const puntos: [string, number, number][] = [
        ["zona de la ✕", r.right - 28, r.top + 28],
        ["centro", r.left + r.width / 2, r.top + r.height / 2],
        ["abajo a la izquierda", r.left + 28, r.bottom - 28],
      ];
      return puntos.map(([n, x, y]) => [n, document.elementFromPoint(x, y)?.closest(".face")?.className ?? "nada"]);
    });
    for (const [nombre, dueño] of resultado) expect(dueño, `en ${nombre} debería recibir el clic el dorso`).toContain("face-back");
  });

  test("el botón ✕ y el fondo del dorso cierran la card (no depende solo de Escape)", async ({ page }) => {
    await page.goto("/");
    await page.locator("#drop").scrollIntoViewIfNeeded();
    await front(page, 1).click();
    await card(page, 1).getByRole("button", { name: "Cerrar" }).click();
    await expect(card(page, 1).locator(".card3d")).not.toHaveClass(/is-flipped/);
    await front(page, 1).click();
    await card(page, 1).locator(".face-back").click({ position: { x: 8, y: 150 } }); // zona vacía del dorso
    await expect(card(page, 1).locator(".card3d")).not.toHaveClass(/is-flipped/);
  });

  test("solo una card abierta a la vez", async ({ page }) => {
    await page.goto("/");
    await page.locator("#drop").scrollIntoViewIfNeeded();
    await front(page, 1).click();
    await front(page, 2).click();
    await expect(card(page, 1).locator(".card3d")).not.toHaveClass(/is-flipped/);
    await expect(card(page, 2).locator(".card3d")).toHaveClass(/is-flipped/);
  });

  test("el temporizador está debajo del logo y cuenta en vivo hasta el drop", async ({ page }) => {
    await page.goto("/");
    const timer = page.getByTestId("hero-timer");
    await expect(timer).toBeVisible();
    await expect(timer.locator("[data-unit]")).toHaveCount(4);
    // debajo del logo principal y antes del título "Create more"
    const logo = (await page.locator("main img[alt*='BYSLF' i], main svg").first().boundingBox())!;
    const t = (await timer.boundingBox())!;
    const title = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
    expect(t.y).toBeGreaterThan(logo.y);
    expect(t.y).toBeLessThan(title.y);
    // con números reales y moviéndose
    await expect(timer.locator('[data-unit="Seg"]')).toHaveText(/^\d{2}$/);
    const first = await timer.locator('[data-unit="Seg"]').textContent();
    await expect.poll(() => timer.locator('[data-unit="Seg"]').textContent(), { timeout: 4000 }).not.toBe(first);
  });

  test("el lookbook se ve completo aunque la tienda esté cerrada (muestra el estilo de la marca)", async ({ page }) => {
    await page.goto("/");
    const imgs = page.locator("#lookbook img");
    await expect(imgs).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      const img = imgs.nth(i);
      await expect(img).toHaveAttribute("alt", /\S{3}/); // con descripción
      expect(await img.evaluate((el) => getComputedStyle(el).filter)).toBe("none"); // sin blur ni oscurecido
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 200)).toBe(true);
    }
  });

  test("el efecto NO revela las fotos: siguen borrosas y oscuras con el mouse encima y con la card abierta", async ({ page }) => {
    await page.goto("/");
    await page.locator("#drop").scrollIntoViewIfNeeded();
    const img = card(page, 1).locator("img");
    const filter = () => img.evaluate((el) => getComputedStyle(el).filter);
    expect(await filter()).toMatch(/blur\((2[0-9]|[3-9][0-9])px\)/); // blur-xl = 24px
    const box = (await card(page, 1).locator(".tilt").boundingBox())!;
    await page.mouse.move(box.x + 40, box.y + 40, { steps: 4 });
    expect(await filter()).toMatch(/blur\(/);
    await front(page, 1).click();
    expect(await filter()).toMatch(/blur\(/);
    expect(await filter()).toMatch(/brightness\(0\.[0-4]/); // sigue oscura
  });

  test("las secciones aparecen al hacer scroll y NUNCA quedan invisibles", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(500);
    expect(await page.locator('[data-reveal="hidden"]').count()).toBeGreaterThan(0); // hay cosas esperando a aparecer
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    await expect(page.locator("#newsletter h2")).toHaveCSS("opacity", "1");
    // red de seguridad: pasado un rato, nada queda oculto aunque no se haya scrolleado hasta ahí
    await page.waitForTimeout(4600);
    expect(await page.locator('[data-reveal="hidden"]').count()).toBe(0);
  });

  test("sin JavaScript el contenido se ve completo (nada depende de las animaciones)", async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false, baseURL: "http://localhost:3201" });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("opacity", "1");
    await expect(page.locator("#newsletter h2")).toHaveCSS("opacity", "1");
    await expect(page.locator("#drop h2")).toHaveCSS("opacity", "1");
    await ctx.close();
  });

  test("la home con todas las animaciones no tira errores en la consola", async ({ page }) => {
    const errores: string[] = [];
    page.on("pageerror", (e) => errores.push(e.message));
    page.on("console", (m) => m.type() === "error" && errores.push(m.text()));
    await page.goto("/");
    await page.locator("#drop").scrollIntoViewIfNeeded();
    await front(page, 1).click();
    await page.keyboard.press("Escape");
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    await page.waitForTimeout(800);
    expect(errores, errores.join(" | ")).toEqual([]);
  });

  test("en celular, con las animaciones andando, la página no se desborda", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await page.goto("/");
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });
});

test.describe("con 'reducir movimiento' activado en el sistema", () => {
  test.use({ reducedMotion: "reduce" });

  test("todo se ve completo y quieto: sin animaciones, sin aparición diferida", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(400);
    expect(await page.locator("[data-reveal]").count()).toBe(0); // nada espera para aparecer
    const animados = await page.evaluate(() =>
      [".rise", ".pop", ".floaty", ".twinkle", ".pulse", ".sheen", ".marquee-track", ".grain"].map((s) => {
        const el = document.querySelector(s);
        return [s, el ? getComputedStyle(el).animationName : "(no existe)"];
      }),
    );
    for (const [selector, animationName] of animados) expect(animationName, selector).toMatch(/none|\(no existe\)/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("opacity", "1");
    await expect(page.locator("#newsletter h2")).toHaveCSS("opacity", "1");
  });

  test("las cards no se inclinan con el mouse, pero igual se pueden abrir y se ve el dorso", async ({ page }) => {
    await page.goto("/");
    await page.locator("#drop").scrollIntoViewIfNeeded();
    const tilt = page.locator("#drop article").nth(1).locator(".tilt");
    const box = (await tilt.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.15, { steps: 6 });
    await page.waitForTimeout(200);
    expect(await tilt.evaluate((el) => el.style.getPropertyValue("--ry"))).toBe("");
    await page.getByRole("button", { name: /Producto misterioso 2/ }).click();
    await expect(page.locator("#drop article").nth(1).locator(".face-back").getByText("15.12")).toBeVisible();
  });
});
