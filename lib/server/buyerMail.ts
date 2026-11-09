import "server-only";
import { getProduct } from "@/data/products";
import { BUSINESS, POLICY } from "@/lib/legal";
import type { Shipping } from "@/lib/shipping";
import { PICKUP_POINT } from "@/lib/shippingCost";
import { SOCIAL } from "@/lib/site";
import { TRANSFER_ACCOUNT, orderCode } from "@/lib/transfer";
import { sendMail } from "./mail";
import type { OrderLine } from "./orders";
import { siteUrl } from "./security";

/**
 * Mails al COMPRADOR (solo texto). Nunca lanzan: un mail que no sale no puede romper una venta.
 * Los datos de envío no se guardan en la base: se usan los que llegan con el pago (o con el aviso de transferencia).
 */

/** Sin dominio propio (MAIL_FROM) Resend solo deja escribirte a vos: no se intenta mandarle al comprador. */
const canMailBuyers = () => Boolean(process.env.MAIL_FROM);

const money = (n: number | string) => `$${Number(n).toLocaleString("es-AR")}`;

async function itemLines(items: OrderLine[]): Promise<string[]> {
  return Promise.all(items.map(async (i) => `  - ${(await getProduct(i.slug))?.name ?? i.slug} · ${i.color} · Talle ${i.size} · x${i.qty}`));
}

function deliveryLines(s: Partial<Shipping>): string[] {
  if (s.method === "pickup") return ["Retiro en Córdoba:", `  ${PICKUP_POINT}`, "  Te avisamos por mail o Instagram cuando esté listo."];
  if (s.method === "branch") return ["Envío a sucursal de Correo Argentino:", `  ${s.branch ?? "-"} (${s.province ?? "-"})`];
  const address = `${s.street ?? ""} ${s.number ?? ""}${s.floor ? `, ${s.floor}` : ""}`.trim();
  return ["Envío a domicilio:", `  ${address || "-"}`, `  ${s.city ?? "-"}, ${s.province ?? "-"} (CP ${s.zip ?? "-"})`];
}

function timesLines(s: Partial<Shipping>): string[] {
  if (s.method === "pickup") return [];
  return [
    "Plazos:",
    `  Despachamos en ${POLICY.dispatchDays} días hábiles desde que se acredita el pago.`,
    `  Correo Argentino entrega en un plazo estimado de ${POLICY.deliveryDays} días hábiles, según el destino.`,
    "  Cuando despachamos te mandamos el código de seguimiento.",
  ];
}

const footer = (): string[] => [
  "",
  `Cambios de talle o color: dentro de los ${POLICY.exchangeDays} días de recibir el pedido. Más info: ${siteUrl()}/legal/cambios-y-devoluciones`,
  `Cualquier duda, escribinos por Instagram (@${SOCIAL.instagram.user}) o a ${BUSINESS.email}, con tu número de pedido.`,
  "",
  "BYSLF",
];

const hello = (s: Partial<Shipping>) => `Hola${s.name ? ` ${s.name}` : ""}!`;

/** Pedido pagado con Mercado Pago y confirmado. */
export async function sendBuyerPaid(input: { orderId: string; items: OrderLine[]; total: number | string; shippingCost: number | string; shipping: Partial<Shipping> }): Promise<boolean> {
  const s = input.shipping;
  if (!s.email || !canMailBuyers()) return false;
  try {
    const text = [
      hello(s),
      "",
      "Recibimos tu pago, gracias por comprar en BYSLF. Tu pedido está confirmado.",
      "",
      `Pedido: ${orderCode(input.orderId)}`,
      "",
      "Productos:",
      ...(await itemLines(input.items)),
      "",
      `Envío: ${Number(input.shippingCost) > 0 ? money(input.shippingCost) : "gratis"}`,
      `Total pagado: ${money(input.total)}`,
      "",
      ...deliveryLines(s),
      "",
      ...timesLines(s),
      ...footer(),
    ].join("\n");
    return await sendMail({ to: s.email, subject: `Tu pedido BYSLF está confirmado · ${orderCode(input.orderId)}`, text });
  } catch (e) {
    console.error("[mail] no se pudo armar el mail al comprador", e);
    return false;
  }
}

/** El comprador avisó que transfirió: recibo del aviso, con los datos para pagar por si cerró la pantalla. */
export async function sendBuyerTransfer(input: { orderId: string; items: OrderLine[]; amount: number | string; expiresAt: string; shipping: Partial<Shipping> }): Promise<boolean> {
  const s = input.shipping;
  if (!s.email || !canMailBuyers()) return false;
  try {
    const code = orderCode(input.orderId);
    const text = [
      hello(s),
      "",
      "Recibimos tu aviso de transferencia. Vamos a verificar que la plata se acredite y te confirmamos el pedido.",
      "Tu pedido todavía NO está confirmado: se confirma cuando comprobamos que la transferencia llegó.",
      "",
      `Pedido: ${code}`,
      "",
      "Productos:",
      ...(await itemLines(input.items)),
      "",
      `Total a transferir: ${money(input.amount)}`,
      "",
      ...deliveryLines(s),
      "",
      "Si todavía no transferiste, estos son los datos (poné el código del pedido en el concepto):",
      `  Titular: ${TRANSFER_ACCOUNT.holder}`,
      `  Banco: ${TRANSFER_ACCOUNT.bank}`,
      `  CBU/CVU: ${TRANSFER_ACCOUNT.cbu}`,
      `  Alias: ${TRANSFER_ACCOUNT.alias}`,
      `  Concepto: ${code}`,
      `  Tu pedido queda reservado hasta: ${new Date(input.expiresAt).toLocaleString("es-AR", { timeZone: "America/Argentina/Cordoba" })}`,
      "",
      `Mandanos el comprobante por Instagram (@${SOCIAL.instagram.user}) para acelerar la confirmación.`,
      "",
      ...timesLines(s),
      ...footer(),
    ].join("\n");
    return await sendMail({ to: s.email, subject: `Recibimos tu aviso de transferencia · ${code}`, text });
  } catch (e) {
    console.error("[mail] no se pudo armar el mail al comprador", e);
    return false;
  }
}
