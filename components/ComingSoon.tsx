import Link from "next/link";
import { DROP_DATE } from "@/lib/site";
import { Logo } from "./Logo";
import { Newsletter } from "./Newsletter";

/** Reemplaza a Tienda / Producto mientras LAUNCHED sea false. */
export function ComingSoon() {
  return (
    <>
      <section className="bg-night">
        <div className="container-x flex flex-col items-center py-20 text-center md:py-28">
          <p className="label font-bold text-slate-text"><span aria-hidden="true">●</span> Drop 001</p>
          <h1 className="display mt-4 text-[clamp(2rem,10.5vw,10rem)] md:text-[clamp(4rem,14vw,10rem)]">Próximamente</h1>
          <p className="label mt-6 text-slate-text">Fecha: {DROP_DATE ?? "???"}</p>
          <Logo variant="secondary" decorative className="mt-10 w-full max-w-xs opacity-80" />
          <Link href="/" className="label mt-10 font-bold underline underline-offset-4 hover:text-slate-text">Volver al inicio</Link>
        </div>
      </section>
      <Newsletter />
    </>
  );
}
