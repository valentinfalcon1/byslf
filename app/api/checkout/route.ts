import { randomUUID } from "node:crypto";
import { getProduct } from "@/data/products";
import { createPreference, type PreferenceItem } from "@/lib/server/mercadopago";
import { OutOfStockError, RESERVE_MINUTES, TooManyPendingError, releaseOrder, reserveOrder, type OrderLine } from "@/lib/server/orders";
import { allow } from "@/lib/server/ratelimit";
import { checkOrigin, clientIp, json, readJson, siteUrl } from "@/lib/server/security";
import { validateShipping } from "@/lib/shipping";
import { quoteShipping } from "@/lib/shippingCost";
import { LAUNCHED } from "@/lib/site";
import { TRANSFER_RESERVE_MINUTES, orderCode } from "@/lib/transfer";

type Line = { slug?: unknown; color?: unknown; size?: unknown; qty?: unknown };

export async function POST(req: Request) {
  // Antes del lanzamiento no se vende; en desarrollo se puede probar igual.
  if (!LAUNCHED && process.env.NODE_ENV === "production") return json({ error: "La tienda todavía no está abierta." }, 403);

  const originError = checkOrigin(req);
  if (originError) return originError;

  // Cada intento reserva stock real: se limita por IP para que nadie pueda vaciar el drop reteniendo reservas.
  try {
    if (!(await allow("checkout", clientIp(req), 6, 10 * 60))) {
      return json({ error: "Demasiados intentos. Esperá unos minutos y probá de nuevo." }, 429);
    }
  } catch {
    return json({ error: "El servicio no está disponible en este momento. Probá de nuevo en un rato." }, 503);
  }

  const parsed = await readJson(req);
  if ("error" in parsed) return parsed.error;
  const body = (parsed.data && typeof parsed.data === "object" ? parsed.data : {}) as { items?: Line[]; shipping?: unknown; acceptedTerms?: unknown; payment?: unknown };

  const lines = body.items;
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 20) return json({ error: "Carrito inválido." }, 400);
  if (body.acceptedTerms !== true) return json({ error: "Tenés que aceptar los términos y la política de privacidad." }, 422);

  // Forma de pago: Mercado Pago (por defecto) o transferencia.
  const payment = body.payment === undefined || body.payment === "mp" ? "mp" : body.payment === "transfer" ? "transfer" : null;
  if (!payment) return json({ error: "Forma de pago inválida." }, 400);

  // Los datos de envío se validan acá también: la validación del navegador no es de fiar.
  const ship = validateShipping(body.shipping);
  if (!ship.ok) return json({ error: "Revisá los datos de envío.", fields: ship.errors }, 422);
  const shipping = ship.value;

  const items: PreferenceItem[] = [];
  const meta: OrderLine[] = [];

  for (const l of lines) {
    const qty = Number(l?.qty);
    if (typeof l?.slug !== "string" || typeof l.color !== "string" || typeof l.size !== "string" || !Number.isInteger(qty) || qty < 1 || qty > 10) {
      return json({ error: "Carrito inválido." }, 400);
    }
    // El precio sale SIEMPRE del catálogo del servidor, nunca del navegador.
    const product = await getProduct(l.slug);
    if (!product || !product.colors.some((c) => c.name === l.color) || !product.sizes.includes(l.size)) {
      return json({ error: "Hay un producto que ya no está disponible." }, 409);
    }
    if (product.price === null) return json({ error: "Hay un producto sin precio definido." }, 409);
    if (!Number.isFinite(product.price) || product.price <= 0) return json({ error: "Hay un producto con un precio inválido." }, 409);

    items.push({ id: `${product.slug}|${l.color}|${l.size}`, title: `${product.name} — ${l.color} / ${l.size}`, quantity: qty, unit_price: product.price, currency_id: "ARS" });
    meta.push({ slug: product.slug, color: l.color, size: l.size, qty });
  }

  const orderId = randomUUID();
  const subtotal = items.reduce((n, i) => n + i.unit_price * i.quantity, 0);

  // El costo de envío lo calcula SIEMPRE el servidor (método + provincia + subtotal); el navegador no manda ningún monto.
  const quote = quoteShipping(shipping.method, shipping.province, shipping.zip, subtotal);
  if (!quote.ok) {
    return json({ error: "Todavía no hacemos envíos a domicilio a tu zona. Podés elegir retiro en Córdoba o escribirnos.", fields: { [quote.reason === "no_zip" ? "zip" : "province"]: "Sin envío a esta zona por ahora." } }, 422);
  }
  if (quote.cost > 0) items.push({ id: "envio", title: "Envío", quantity: 1, unit_price: quote.cost, currency_id: "ARS" });
  const amount = subtotal + quote.cost;

  // 1) Reservar stock (falla entero si algún ítem no alcanza).
  try {
    // En la base solo queda el pedido (sin datos personales). El envío viaja en el metadata del pago.
    await reserveOrder(orderId, meta, amount, shipping.email, payment === "transfer" ? { method: "transfer", minutes: TRANSFER_RESERVE_MINUTES } : {});
  } catch (e) {
    if (e instanceof OutOfStockError) {
      const p = await getProduct(e.line.slug);
      return json({ error: `Sin stock: ${p?.name ?? e.line.slug} (${e.line.color} / ${e.line.size}).` }, 409);
    }
    if (e instanceof TooManyPendingError) {
      return json({ error: "Ya tenés pagos pendientes. Completalos o esperá a que venzan para iniciar otro." }, 429);
    }
    console.error("[checkout] reserva", e);
    return json({ error: "No pudimos iniciar el pago. Probá de nuevo en un rato." }, 502);
  }

  // Transferencia: no hay pasarela. Se devuelve el monto y el código; los datos de envío te llegan por mail
  // cuando el comprador toca "Ya transferí" (ver /api/checkout/transfer/notify).
  if (payment === "transfer") {
    return json({ transfer: { orderId, code: orderCode(orderId), amount, shippingCost: quote.cost, expiresAt: new Date(Date.now() + TRANSFER_RESERVE_MINUTES * 60_000).toISOString() } });
  }

  // 2) Crear el pago. Si falla, se devuelve el stock reservado.
  try {
    const expiresAt = new Date(Date.now() + RESERVE_MINUTES * 60_000);
    const pref = await createPreference({
      items,
      orderId,
      siteUrl: siteUrl(),
      metadata: { items: meta, shipping, shipping_cost: quote.cost },
      expiresAt,
      payer: { name: shipping.name, lastname: shipping.lastname, email: shipping.email },
    });
    return json({ url: pref.init_point });
  } catch (e) {
    console.error("[checkout] preferencia", e);
    await releaseOrder(orderId);
    return json({ error: "No pudimos iniciar el pago. Probá de nuevo en un rato." }, 502);
  }
}
