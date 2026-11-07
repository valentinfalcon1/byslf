import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { formatPrice } from "@/lib/format";
import { BUSINESS, POLICY } from "@/lib/legal";
import { FREE_SHIPPING_OVER } from "@/lib/shippingCost";
import { SOCIAL } from "@/lib/site";

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
        <p>Para que corresponda la devolución, el producto debe estar sin uso y en las mismas condiciones en que lo recibiste.</p>
      </LegalSection>

      <LegalSection title="Cambio de talle o color">
        <ul>
          <li>Podés pedir el cambio dentro de los <strong>{POLICY.exchangeDays} días corridos</strong> de haber recibido el pedido.</li>
          <li>La prenda tiene que estar sin uso, sin lavar y con sus etiquetas.</li>
          <li>El cambio está sujeto a stock. Si no tenemos el talle o color que querés, podés elegir otro producto o pedir el reintegro.</li>
          <li>Los gastos de envío del cambio (la devolución y el nuevo envío) corren por tu cuenta, salvo que el cambio sea por una falla o por un error nuestro.</li>
          <li>
            Para pedirlo, escribinos por Instagram (<a href={SOCIAL.instagram.url} target="_blank" rel="noopener noreferrer">@{SOCIAL.instagram.user}</a>) o a {BUSINESS.email}, con tu número de pedido.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Productos con fallas y garantía legal">
        <p>
          Si recibís un producto con fallas o distinto al que compraste, escribinos a {BUSINESS.email} o por Instagram con tu número de pedido y fotos. Te lo cambiamos o te devolvemos el dinero, y el envío corre por nuestra cuenta.
          Además, los productos nuevos tienen la garantía legal que establece la Ley 24.240 de Defensa del Consumidor.
        </p>
      </LegalSection>

      <LegalSection title="Reintegros">
        <p>
          Te devolvemos el dinero por el mismo medio con el que pagaste: si pagaste con Mercado Pago, el reintegro se hace desde Mercado Pago; si pagaste por transferencia, te transferimos a la cuenta que nos indiques.
          Lo hacemos dentro de los <strong>{POLICY.refundBusinessDays} días hábiles</strong> de recibir el producto devuelto.
        </p>
      </LegalSection>

      <LegalSection title="Envíos">
        <p>Hacemos envíos a toda Argentina a través de Correo Argentino, a domicilio o a la sucursal que elijas.</p>
        <ul>
          <li>Despachamos tu pedido dentro de <strong>{POLICY.dispatchDays} días hábiles</strong> desde que se acredita el pago.</li>
          <li>Correo Argentino lo entrega en un plazo estimado de <strong>{POLICY.deliveryDays} días hábiles</strong>, según el destino. Son plazos estimados: dependen del correo.</li>
          <li>Cuando despachamos te enviamos el código de seguimiento.</li>
          <li>El costo se calcula antes de pagar, según el destino. El envío es gratis en compras de más de {formatPrice(FREE_SHIPPING_OVER)}.</li>
          <li>Tenés que cargar un domicilio (o una sucursal) correcto y completo. Si el pedido vuelve por datos incorrectos, el reenvío corre por tu cuenta.</li>
        </ul>
      </LegalSection>
    </LegalPage>
  );
}
