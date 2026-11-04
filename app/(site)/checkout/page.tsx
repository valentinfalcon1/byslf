import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/CheckoutForm";
import { LAUNCHED } from "@/lib/site";

export const metadata: Metadata = { title: "Datos de envío", robots: { index: false } };

export default function CheckoutPage() {
  if (!LAUNCHED) redirect("/");
  return (
    <section className="container-x py-12 md:py-16">
      <h1 className="display mb-10 text-5xl md:text-7xl">Finalizar compra</h1>
      <CheckoutForm />
    </section>
  );
}
