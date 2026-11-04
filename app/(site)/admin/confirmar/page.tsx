import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfirmTransfer } from "@/components/ConfirmTransfer";
import { getProduct } from "@/data/products";
import { db } from "@/lib/server/db";
import type { OrderLine } from "@/lib/server/orders";
import { UUID_RE } from "@/lib/server/security";
import { verifyConfirm } from "@/lib/server/transfer";
import { formatPrice } from "@/lib/format";
import { orderCode } from "@/lib/transfer";

// El link lleva una firma en la URL: que no se indexe ni se mande como referrer a otro sitio.
export const metadata: Metadata = { title: "Confirmar transferencia", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ o?: string; t?: string }> }) {
  const { o, t } = await searchParams;
  // Link falso, vencido o sin secreto configurado: 404, sin dar pistas.
  if (typeof o !== "string" || !UUID_RE.test(o) || !verifyConfirm(o, t)) notFound();

  let order: { id: string; status: string; method: string; amount: number | string; items: OrderLine[] } | null = null;
  try {
    const r = await db().from("orders").select("*").eq("id", o.toLowerCase()).maybeSingle();
    order = r.data;
  } catch {
    order = null;
  }
  if (!order || order.method !== "transfer") notFound();

  const lines = await Promise.all(
    order.items.map(async (i) => `${(await getProduct(i.slug))?.name ?? i.slug} · ${i.color} · Talle ${i.size} · x${i.qty}`),
  );

  return (
    <section className="container-x flex min-h-[55vh] max-w-xl flex-col items-center justify-center py-20 text-center">
      <h1 className="display text-[clamp(1.9rem,8.6vw,3.75rem)]">Confirmar transferencia</h1>
      <dl className="label mt-8 w-full space-y-2 rounded-card border border-line bg-surface p-5 text-left">
        <div className="flex justify-between gap-4"><dt className="text-star">Código</dt><dd className="font-bold">{orderCode(order.id)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-star">Monto</dt><dd className="font-bold">{formatPrice(Number(order.amount))}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-star">Estado</dt><dd className="font-bold">{order.status}</dd></div>
        <div className="border-t border-line pt-2"><dt className="text-star">Productos</dt>{lines.map((l) => <dd key={l}>{l}</dd>)}</div>
      </dl>
      <p className="mt-6 text-star">Confirmá solo después de ver el comprobante en Instagram y comprobar que la plata llegó a tu cuenta.</p>
      <ConfirmTransfer orderId={order.id} token={t as string} alreadyPaid={order.status === "paid"} />
    </section>
  );
}
