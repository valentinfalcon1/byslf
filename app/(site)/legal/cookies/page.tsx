import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Política de cookies" };

export default function Cookies() {
  return (
    <LegalPage title="Política de cookies">
      <LegalSection title="Qué usamos hoy">
        <p>Este sitio usa solo almacenamiento local de tu navegador, necesario para que funcione. No usamos cookies de publicidad, ni de seguimiento, ni herramientas de analítica.</p>
        <ul>
          <li><strong>byslf-cart</strong>: recuerda los productos de tu carrito para que no lo pierdas si recargás la página.</li>
          <li><strong>byslf-cookie-notice</strong>: recuerda que ya viste el aviso sobre esta política, para no mostrártelo de nuevo.</li>
        </ul>
        <p>Las tipografías se sirven desde nuestro propio sitio, sin pedirlas a terceros.</p>
      </LegalSection>

      <LegalSection title="Terceros">
        <p>
          Cuando hacés clic en pagar, pasás a Mercado Pago, que tiene su propio sitio y sus propias cookies, regidas por su política. Nuestro proveedor de alojamiento puede registrar datos técnicos de cada visita
          (como la dirección IP) en sus registros de servidor, por seguridad y funcionamiento.
        </p>
      </LegalSection>

      <LegalSection title="Cómo borrarlos">
        <p>Podés borrar el almacenamiento del sitio desde la configuración de tu navegador (&ldquo;Borrar datos de navegación&rdquo; o &ldquo;Datos de sitios&rdquo;). Si lo hacés, se vacía tu carrito.</p>
      </LegalSection>

      <LegalSection title="Si esto cambia">
        <p>Si en el futuro incorporamos analítica o publicidad, lo vamos a informar acá y te vamos a pedir tu consentimiento antes de activarlas. Más datos en la <Link href="/legal/privacidad">Política de privacidad</Link>.</p>
      </LegalSection>
    </LegalPage>
  );
}
