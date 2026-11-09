# Seguridad — revisión y estado

Revisión del código de la tienda (Next.js + Supabase + Mercado Pago + Resend), pensando en que guarda **datos de personas reales** (nombre, email, teléfono, DNI, domicilio) y maneja **stock y cobros**.

> Esta revisión es técnica y la hice sobre el código del proyecto. No reemplaza una auditoría profesional, ni la revisión legal de las políticas de privacidad.

## Qué se encontró y qué se hizo

| # | Gravedad | Hallazgo | Estado |
|---|---|---|---|
| 1 | Alta | `/api/checkout` sin límite de uso: cualquiera podía reservar todo el stock en bucle (cada reserva dura 30 min) | ✅ Corregido: 6 intentos por IP cada 10 min + tope de 3 reservas pendientes por email |
| 2 | Alta | `/api/arrepentimiento` sin límite, y mandaba mails a **cualquier dirección** (spam con tu marca, casilla inundada) | ✅ Corregido: 5 por IP/hora, 2 por email/hora, y solo escribe al cliente si hay dominio verificado |
| 3 | Media | Un cliente que pagaba **dos veces** el mismo pedido pasaba desapercibido (plata para devolver) | ✅ Corregido: se detecta y te llega un mail "⚠ PAGO DUPLICADO" |
| 4 | Media | Webhook: un pago ajeno hacía fallar la base y Mercado Pago reintentaba para siempre | ✅ Corregido: solo se procesan pagos con referencia propia (UUID) e id numérico |
| 5 | Media | Los POST aceptaban peticiones de otros sitios, cualquier tipo de contenido y tamaño | ✅ Corregido: chequeo de `Origin`, exige `application/json`, máximo 20 KB |
| 6 | Media | Sin cabeceras de seguridad | ✅ Corregido: anti-clickjacking, `nosniff`, HSTS, Referrer-Policy, Permissions-Policy, CSP base |
| 7 | Media | **Pantalla blanca persistente** si el carrito guardado en el navegador tenía otra forma (corrupto o manipulado) | ✅ Corregido: se valida todo al cargar |
| 8 | Media | Doble clic / Enter repetido creaba **dos pagos** | ✅ Corregido: traba inmediata en el formulario |
| 9 | Media | Tras pagar, el carrito **no se vaciaba** y la página de gracias entraba en un bucle de renders | ✅ Corregido |
| 10 | Baja | Sin `SITE_URL` en producción, el cliente volvería a `localhost`; precio no validado como positivo; link de pago no verificado como de Mercado Pago; `/design-system` público | ✅ Corregido |
| 11 | Baja | Textos largos se cortaban en celular (`BOTÓN DE ARREPENTIMIENTO`) | ✅ Corregido |

**No se encontró:** inyección de HTML/JS (no se usa `dangerouslySetInnerHTML`), secretos en el código o en lo que recibe el navegador (verificado en el build de producción), `npm audit` con 0 vulnerabilidades.

## Controles que ya están

- **El precio lo pone siempre el servidor**, nunca el navegador (hay prueba automática que intenta mandar `price: 1`).
- **Stock sin sobreventa**: la reserva es atómica dentro de la base (todo o nada), dura 30 min y se libera sola.
- **El aviso de pago no se cree a ciegas**: se consulta el pago real a Mercado Pago con tu token antes de confirmar nada. Opcionalmente exige firma (`MP_WEBHOOK_SECRET`).
- **Idempotente**: el mismo aviso repetido no duplica pedidos, mails ni descuentos.
- **Base de datos cerrada**: todas las tablas con RLS activado y sin políticas (el navegador no puede leer nada); las funciones solo las ejecuta el servidor. La clave `service_role` vive solo en el servidor (`server-only`).
- **Mails solo en texto plano**, sin HTML con datos del comprador.
- **Los límites no guardan IPs ni emails en claro** (se guardan hasheados).
- **No hay endpoint que devuelva pedidos**: no se pueden consultar datos de otros clientes.
- **Los errores al cliente son genéricos**; el detalle va solo al log del servidor, y el log no incluye datos personales.

## Riesgos que quedan (decisiones tuyas)

| Riesgo | Qué conviene hacer |
|---|---|
| **Acaparamiento de stock distribuido**: un atacante con muchas IPs y emails puede seguir reteniendo reservas | Si el drop es muy codiciado, sumar un captcha (Cloudflare Turnstile es gratis) en el checkout |
| **La IP del cliente sale de `x-forwarded-for`**, que solo es confiable detrás de una plataforma que lo sobrescribe (Vercel y similares) | Publicar en un hosting así. En un servidor propio sin proxy, un atacante puede falsearla |
| **CSP sin `script-src`**: falta la restricción de scripts (requiere "nonces" en Next) | Mejora futura; hoy el riesgo es bajo porque no hay contenido de usuarios renderizado |
| **Firma del webhook es opcional** | Después de probarla con el simulador de Mercado Pago, definí `MP_WEBHOOK_SECRET` en producción |
| **Los datos de envío NO están en tu base**: viajan en el pago de Mercado Pago y te llegan por mail | Guardá esos mails (son tu único registro de a dónde enviar). La base solo tiene pedidos sin datos personales (estado, monto, productos, hash del email) |
| **Pedidos en `needs_review` retienen su stock** hasta que los resuelvas a mano | Atender los mails con ⚠ rápido |
| **El panel de Supabase es tu "administración"** de pedidos: quien entre ahí ve los pedidos y el stock (sin datos personales; los de envío se ven en el panel de Mercado Pago) | **Activá verificación en dos pasos** en Supabase, Mercado Pago, Resend y tu hosting |
| **Credenciales de Tiendanube** (client secret y token) estuvieron en una conversación | Borrá esas líneas de `.env.local` y regenerá/desinstalá esa app |
| **Newsletter sin dominio verificado**: no se puede mandar el mail de confirmación a quien se anota | Los anotados quedan marcados `email_verified = false`. Verificá un dominio en Resend, definí `MAIL_FROM` y pediles confirmación **antes** de mandarles una campaña. Cada campaña tiene que incluir el link de baja personal (consulta lista en `supabase/seed-test.sql`) |
| **Campañas de newsletter**: el sitio guarda y administra la lista pero **no envía campañas** | Para mandarlas usá Resend (Broadcasts) o exportá la lista con la consulta de `seed-test.sql` |
| **Si Supabase se cae, no se puede comprar** (el límite de uso falla cerrado, a propósito) | Aceptable: es mejor no vender que vender sin control |

## Cómo se prueba

```
npm test              # 361 pruebas: lógica, base de datos, API, carrito, formulario, newsletter, seguridad
npm run test:e2e      # 72 pruebas en Chrome real: recorre el sitio como un cliente (requiere Chrome)
npx tsc --noEmit      # tipos
```

Las pruebas con datos usan una base Postgres real **en memoria** (no tocan tu Supabase), y las del navegador corren con los servicios externos desactivados: nunca mandan mails ni cobran.

## Antes de abrir la tienda

- [ ] Completar `lib/legal.ts` (razón social, CUIT, domicilio, email) y que un abogado revise las políticas
- [ ] Cargar precios reales en `data/products.ts` y el **stock real** en la tabla `stock`
- [ ] Proyecto de Supabase **de producción** con `schema.sql` corrido
- [ ] Mercado Pago: **credenciales de producción** y `MP_WEBHOOK_SECRET`; probado con el simulador
- [ ] `SITE_URL` con la dirección real en **https**
- [ ] Dominio verificado en Resend y `MAIL_FROM` (para el código de arrepentimiento por mail y la confirmación del newsletter)
- [ ] Si hay anotados al newsletter con `email_verified = false`, pedirles confirmación antes de la primera campaña
- [ ] **Sacar** `DEV_TEST_PRICE` y `NEXT_PUBLIC_LAUNCHED` del entorno de producción
- [ ] Pasar `LAUNCHED` a `true` en `lib/site.ts`
- [ ] Verificación en dos pasos en todas las cuentas (Supabase, Mercado Pago, Resend, hosting, correo)
- [ ] Hacer UNA compra real chica y devolverla, para confirmar el recorrido completo

## Pago por transferencia

El cliente elige "Transferencia": se reserva el stock 24 horas (sin datos personales en la base), ve el monto exacto, tu CBU/alias y un código para el concepto. Al tocar "Ya transferí, enviar comprobante" se abre tu chat de Instagram y te llega un mail con sus datos de envío (una sola vez por pedido; si el mail falla se puede reintentar, porque los datos no se guardan en ningún otro lado). Vos mirás el comprobante en Instagram y confirmás el pago con el **link firmado del mail** (botón "Confirmar que llegó la plata").

- El link usa un HMAC con `ADMIN_LINK_SECRET` (mínimo 32 caracteres, secreto). Sin ese secreto no hay links y nada se puede confirmar.
- Abrir el link **no confirma nada** (los antivirus abren links): hay que tocar el botón, que hace un POST con control de origen y límite de intentos.
- **No reenvíes ese mail**: quien tenga el link puede confirmar ese pedido. Si se filtra un link de un pedido, no sirve para otros.
- Si confirmás cuando la reserva ya había vencido, el sitio vuelve a descontar el stock; si ya no queda, no confirma y te avisa que hay que devolver la plata.
- Completá tus datos de cuenta en `lib/transfer.ts` (titular, banco, CBU/CVU, alias, usuario de Instagram).

## Costo de envío

Se calcula en `lib/shippingCost.ts` (editá solo la tabla `RATES`): envío gratis SOLO en Córdoba capital (por código postal 5000–5016: verificalo), retiro gratis y envío gratis si los productos superan $100.000. Las demás zonas están en `null` ([A DEFINIR]): hasta que cargues una tarifa, solo se puede comprar con retiro o superando el monto. El costo lo recalcula **siempre el servidor** (el navegador no manda ningún monto), se suma como ítem "Envío" en Mercado Pago y entra en el control de monto del pago.
