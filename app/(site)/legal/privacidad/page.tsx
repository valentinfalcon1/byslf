import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { BUSINESS } from "@/lib/legal";

export const metadata: Metadata = { title: "Política de privacidad" };

export default function Privacidad() {
  return (
    <LegalPage title="Política de privacidad">
      <LegalSection title="1. Quién es el responsable">
        <p>
          El responsable del tratamiento de tus datos personales es <strong>{BUSINESS.legalName}</strong> (CUIT {BUSINESS.cuit}), titular de la marca {BUSINESS.brand},
          con domicilio en {BUSINESS.address}. Contacto: {BUSINESS.email}.
        </p>
      </LegalSection>

      <LegalSection title="2. Qué datos recolectamos">
        <ul>
          <li>Al comprar: nombre, apellido, email, teléfono, DNI (opcional), dirección de envío, indicaciones de entrega y el detalle de tu pedido.</li>
          <li>Si te anotás al aviso de drops: tu email.</li>
          <li>Si usás el botón de arrepentimiento: nombre, email, número de pedido y el detalle que quieras agregar.</li>
        </ul>
        <p><strong>No recibimos ni guardamos los datos de tu tarjeta.</strong> El pago lo procesa Mercado Pago en su propia plataforma.</p>
      </LegalSection>

      <LegalSection title="3. Para qué los usamos">
        <ul>
          <li>Procesar, cobrar y entregar tu pedido, y contactarte por él.</li>
          <li>Cumplir obligaciones legales, contables y fiscales.</li>
          <li>
            Enviarte avisos de nuevos drops, solo si te anotaste. Para anotarte te pedimos tu email y, cuando podamos, que lo confirmes con un link que te mandamos.
            Podés darte de baja cuando quieras con el link que va en cada mail, o escribiéndonos para que retiremos o bloqueemos tu email de la lista.
          </li>
          <li>Gestionar cambios, devoluciones y pedidos de arrepentimiento.</li>
        </ul>
        <p>No usamos tus datos para otros fines ni los vendemos.</p>
      </LegalSection>

      <LegalSection title="4. Con quién los compartimos">
        <ul>
          <li><strong>Mercado Pago</strong>, para procesar el pago.</li>
          <li><strong>Correo Argentino</strong>, para entregarte el pedido (reciben tu nombre, dirección y teléfono).</li>
          <li>Proveedores de infraestructura que nos prestan servicio de alojamiento, base de datos y envío de emails ({`[PROVEEDORES — ej. Supabase, Vercel, Resend]`}). Pueden almacenar datos en servidores ubicados fuera de Argentina ({`[PAÍS / REGIÓN]`}), lo que implica una transferencia internacional de datos.</li>
          <li>Autoridades, cuando una norma o una orden judicial lo exija.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Cuánto tiempo los conservamos">
        <p>Conservamos los datos de tus pedidos durante {BUSINESS.retention}. Tu email del aviso de drops, hasta que pidas la baja. Después los eliminamos o anonimizamos.</p>
      </LegalSection>

      <LegalSection title="6. Seguridad">
        <p>Aplicamos medidas técnicas y organizativas para proteger tus datos: conexión cifrada (https), acceso restringido a la base de datos y a quienes necesitan verlos para entregar tu pedido.</p>
      </LegalSection>

      <LegalSection title="7. Tus derechos">
        <p>
          Podés pedirnos acceso, rectificación, actualización o supresión de tus datos escribiendo a {BUSINESS.email}. Respondemos en los plazos que fija la Ley 25.326.
        </p>
        <p>
          El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses,
          salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley Nº 25.326.
          La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley Nº 25.326, tiene la atribución de atender las denuncias y reclamos
          que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.
        </p>
        <p>Inscripción en el Registro Nacional de Bases de Datos Personales: {BUSINESS.dbRegistry}.</p>
      </LegalSection>

      <LegalSection title="8. Cookies y almacenamiento">
        <p>Mirá la <Link href="/legal/cookies">Política de cookies</Link>.</p>
      </LegalSection>

      <LegalSection title="9. Cambios en esta política">
        <p>Si la modificamos, publicamos la nueva versión en esta página con su fecha de actualización.</p>
      </LegalSection>
    </LegalPage>
  );
}
