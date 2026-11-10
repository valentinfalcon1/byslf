import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { BUSINESS, CONSUMER_DEFENSE_URL } from "@/lib/legal";

export const metadata: Metadata = { title: "Términos y condiciones" };

export default function Terminos() {
  return (
    <LegalPage title="Términos y condiciones">
      <LegalSection title="1. Quiénes somos">
        <p>
          Este sitio es operado por <strong>{BUSINESS.legalName}</strong> (CUIT {BUSINESS.cuit}), titular de la marca {BUSINESS.brand}, con domicilio en {BUSINESS.address}.
          Contacto: {BUSINESS.email}.
        </p>
      </LegalSection>

      <LegalSection title="2. Productos y precios">
        <p>
          Los precios están expresados en pesos argentinos. {`[INDICAR SI INCLUYEN IVA / IMPUESTOS]`}. El costo de envío se informa antes de pagar.
          Las fotos son ilustrativas; pueden existir leves diferencias de color según tu pantalla.
        </p>
      </LegalSection>

      <LegalSection title="3. Cómo comprás">
        <ul>
          <li>Elegís productos, color y talle, completás tus datos de envío y pagás a través de Mercado Pago o por transferencia bancaria.</li>
          <li>Al iniciar el pago reservamos el stock por 30 minutos. Si el pago no se completa en ese tiempo, la reserva se libera.</li>
          <li>Si elegís transferencia, reservamos el stock por 24 horas: tenés que enviarnos el comprobante por Instagram dentro de ese plazo. La compra se confirma cuando verificamos que el dinero se acreditó; si no, la reserva se libera.</li>
          <li>La compra con Mercado Pago se confirma cuando Mercado Pago acredita el pago. Si por un error el producto no estuviera disponible, te devolvemos el dinero.</li>
          <li>Los drops tienen stock limitado.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Envíos">
        <p>Enviamos a toda Argentina a través de Correo Argentino. Los plazos estimados, el costo y las condiciones están en <Link href="/legal/cambios-y-devoluciones">Cambios y devoluciones</Link>. Tenés que cargar un domicilio correcto y completo: no nos hacemos responsables por demoras causadas por datos erróneos.</p>
      </LegalSection>

      <LegalSection title="5. Arrepentimiento, cambios y garantía">
        <p>Tenés derecho a arrepentirte de la compra dentro de los 10 días corridos, a través del <Link href="/arrepentimiento">botón de arrepentimiento</Link>. El detalle está en <Link href="/legal/cambios-y-devoluciones">Cambios y devoluciones</Link>.</p>
      </LegalSection>

      <LegalSection title="6. Propiedad intelectual">
        <p>La marca {BUSINESS.brand}, el logo, las imágenes y los textos de este sitio nos pertenecen. No pueden usarse sin autorización previa y por escrito.</p>
      </LegalSection>

      <LegalSection title="7. Datos personales">
        <p>El tratamiento de tus datos se rige por la <Link href="/legal/privacidad">Política de privacidad</Link>.</p>
      </LegalSection>

      <LegalSection title="8. Ley aplicable y reclamos">
        <p>
          Estos términos se rigen por las leyes de la República Argentina, en especial la Ley 24.240 de Defensa del Consumidor. Para cualquier controversia será competente la justicia del domicilio real del consumidor.
        </p>
        <p>
          Podés presentar reclamos ante la autoridad de aplicación de Defensa del Consumidor de tu jurisdicción: <a href={CONSUMER_DEFENSE_URL} target="_blank" rel="noopener noreferrer">Defensa del Consumidor</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
