import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/Button";
import { ClearCartOnMount } from "@/components/cart/ClearCartOnMount";
import { Stars } from "@/components/Stars";

export const metadata: Metadata = { title: "Tu compra", robots: { index: false } };

const COPY = {
  success: { title: "Gracias por ser parte", body: "Recibimos tu pago. [TEXTO DE CONFIRMACIÓN — ej. te mandamos el detalle por mail]", cta: "Volver al inicio" },
  pending: { title: "Pago en proceso", body: "Estamos esperando que se acredite tu pago. [TEXTO — ej. te avisamos por mail apenas se confirme]", cta: "Volver al inicio" },
  failure: { title: "No se pudo completar", body: "El pago no se realizó y no se te cobró. Tu carrito sigue como lo dejaste.", cta: "Volver a intentar" },
} as const;

export default async function CheckoutResult({ params }: { params: Promise<{ status: string }> }) {
  const { status } = await params;
  if (!(status in COPY)) notFound();
  const c = COPY[status as keyof typeof COPY];

  return (
    <section className="container-x flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      {status === "success" && <ClearCartOnMount />}
      <Stars className="text-xl text-star" />
      <h1 className="display mt-6 text-5xl md:text-7xl">{c.title}</h1>
      <p className="mt-6 max-w-[46ch] text-star">{c.body}</p>
      <Button href="/" className="mt-10">{c.cta}</Button>
    </section>
  );
}
