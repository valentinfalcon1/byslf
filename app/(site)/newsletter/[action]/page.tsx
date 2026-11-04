import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NewsletterAction } from "@/components/NewsletterAction";

export const metadata: Metadata = { title: "Newsletter", robots: { index: false, follow: false } };

const COPY = {
  confirmar: { title: "Confirmá tu email", body: "Un último paso para anotarte a los avisos de los drops de BYSLF." },
  baja: { title: "Darte de baja", body: "Si te das de baja, dejamos de escribirte. Podés volver a anotarte cuando quieras." },
} as const;

export default async function NewsletterPage({
  params,
  searchParams,
}: {
  params: Promise<{ action: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { action } = await params;
  if (action !== "confirmar" && action !== "baja") notFound();
  const { t } = await searchParams;
  const valid = typeof t === "string" && /^[0-9a-f]{64}$/.test(t);
  const c = COPY[action];

  return (
    <section className="container-x flex min-h-[55vh] max-w-xl flex-col items-center justify-center py-20 text-center">
      <h1 className="display text-[clamp(1.9rem,8.6vw,3.75rem)]">{c.title}</h1>
      {valid ? (
        <>
          <p className="mt-6 text-star">{c.body}</p>
          <NewsletterAction action={action} token={t} />
        </>
      ) : (
        <p role="alert" className="mt-6 text-star">Este link no es válido. Si lo copiaste del mail, asegurate de copiarlo completo.</p>
      )}
      <Link href="/" className="label mt-10 font-bold underline underline-offset-4 hover:text-star">Volver al inicio</Link>
    </section>
  );
}
