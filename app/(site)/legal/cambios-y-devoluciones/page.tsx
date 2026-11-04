import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { BUSINESS } from "@/lib/legal";

export const metadata: Metadata = { title: "Cambios y devoluciones" };

export default function Cambios() {
  return (
    <LegalPage title="Cambios y devoluciones">
      <LegalSection title="Arrepentimiento de la compra">
        <p>
          Tenés derecho a arrepentirte de tu compra dentro de los <strong>10 días corridos</strong> contados desde que recibís el producto o desde que se celebra el contrato, lo que ocurra último.
          No tenés que justificar el motivo y el trámite no tiene ningún costo para vos.
        </p>
        <p>
          Podés hacerlo desde el <Link href="/arrepentimiento">botón de arrepentimiento</Link>, sin registrarte. Te damos un código de identificación del trámite.
          Si ya recibiste el producto, coordinamos el retiro o la devolución sin cargo y te reintegramos lo pagado por el mismo medio de pago.
        </p>
        <p>Para que corresponda la devolución, el producto debe estar sin uso y en las mismas condiciones en que lo recibiste. {`[CONDICIONES ADICIONALES, si las hay]`}</p>
      </LegalSection>

      <LegalSection title="Cambio de talle o producto">
        <p>{`[POLÍTICA DE CAMBIOS — plazo, condiciones y quién paga el envío del cambio]`}</p>
      </LegalSection>

      <LegalSection title="Productos con fallas y garantía legal">
        <p>
          Si recibís un producto con fallas o distinto al que compraste, escribinos a {BUSINESS.email} con tu número de pedido y fotos. Te lo cambiamos o te devolvemos el dinero.
          Además, los productos nuevos tienen la garantía legal que establece la Ley 24.240 de Defensa del Consumidor.
        </p>
      </LegalSection>

      <LegalSection title="Envíos">
        <p>{`[ZONAS DE ENVÍO, PLAZOS ESTIMADOS DE ENTREGA, COSTOS Y EMPRESA DE CORREO]`}</p>
      </LegalSection>
    </LegalPage>
  );
}
