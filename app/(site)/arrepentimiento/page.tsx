import type { Metadata } from "next";
import Link from "next/link";
import { RevocationForm } from "@/components/RevocationForm";

export const metadata: Metadata = { title: "Botón de arrepentimiento" };

export default function Arrepentimiento() {
  return (
    <section className="container-x max-w-xl py-14 md:py-20">
      <h1 className="display text-[clamp(1.9rem,8.6vw,3.75rem)]">Botón de arrepentimiento</h1>
      <p className="mt-6 text-star">
        Si te arrepentiste de tu compra, podés revocarla dentro de los 10 días corridos desde que la recibiste o la contrataste, sin dar motivos y sin costo.
        No hace falta que te registres. Más datos en <Link href="/legal/cambios-y-devoluciones" className="text-paper underline underline-offset-4">Cambios y devoluciones</Link>.
      </p>
      <div className="mt-10"><RevocationForm /></div>
    </section>
  );
}
