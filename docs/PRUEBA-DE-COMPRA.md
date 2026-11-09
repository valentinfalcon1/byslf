# Compra de prueba, paso a paso

Objetivo: comprar un producto con plata **de mentira** y comprobar que:

1. el pago se crea en Mercado Pago,
2. el stock se descuenta en la base de datos,
3. el pedido queda como pagado, con los datos de envío,
4. **te llega un mail a tu casilla** avisando la venta.

Tiempo estimado: 30–40 minutos la primera vez (casi todo es crear cuentas).

---

## 1. Preparación (una sola vez)

### A. Supabase (la base de datos)
1. Creá un proyecto gratis en [supabase.com](https://supabase.com). Usá uno **solo para pruebas**; el real se crea después.
2. **SQL Editor → New query**: pegá **todo** [supabase/schema.sql](../supabase/schema.sql) → **Run**.
3. Otra query: pegá [supabase/seed-test.sql](../supabase/seed-test.sql) (las líneas que no empiezan con `--`) → **Run**. Esto carga 3 unidades por talle del producto 01.
4. **Project Settings → API**: copiá la **URL** y la clave **`service_role`** (la secreta, NO la `anon`).

### B. Mercado Pago (cobros)
1. Entrá a [Mercado Pago Developers](https://www.mercadopago.com.ar/developers) → **Tus integraciones → Crear aplicación** → tipo **Checkout Pro**.
2. Según la documentación, al crear la aplicación se genera sola una **cuenta vendedora de prueba**, y las credenciales pasan a ser las de prueba. Copiá el **Access Token** de esas credenciales.
3. En **Tu aplicación → Cuentas de prueba**: ahí está el **usuario y contraseña del comprador de prueba** (si te pide un código por mail al ingresar, aparece en esa misma pantalla).

### C. Resend (los mails)
1. Creá una cuenta gratis en [resend.com](https://resend.com) **con el mail donde querés recibir los avisos**.
2. **API Keys → Create API Key** (permiso de envío alcanza). Copiala.

### D. Tu archivo `.env.local`
Abrilo en la carpeta del proyecto, **borrá todo lo viejo** (quedaron restos de Tiendanube) y pegá esto completando los valores. **Guardá con Ctrl+S.**

```
MP_ACCESS_TOKEN=...el access token de PRUEBA...
SITE_URL=http://localhost:3000
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...la service_role...
RESEND_API_KEY=re_...
ORDER_NOTIFY_EMAIL=tu-mail@el-mismo-con-el-que-abriste-resend.com

# Solo para probar en tu computadora:
DEV_TEST_PRICE=1000
NEXT_PUBLIC_LAUNCHED=true
```

> `DEV_TEST_PRICE=1000` le pone $1000 a los productos que todavía no tienen precio. `NEXT_PUBLIC_LAUNCHED=true` muestra la tienda y el carrito sin tocar `lib/site.ts`. **Las dos son solo para pruebas** y se ignoran en producción.

### E. Verificar que todo esté bien
En la terminal, dentro de la carpeta del proyecto:

```
node --env-file=.env.local scripts/check-setup.mjs --mail
```

Tiene que terminar con **"✓ Todo listo para probar"** y llegarte un mail de prueba (mirá también **Spam**). Si algo sale con ✗, el mensaje te dice qué hacer. No sigas hasta que esto esté en verde.

---

## 2. Hacer la compra

1. Abrí una **ventana de incógnito** del navegador (lo recomienda Mercado Pago para evitar errores de sesión) y arrancá el sitio en otra terminal con `npm run dev`. Entrá a **http://localhost:3000/producto/producto-01**.
2. Elegí el talle **M** → **Agregar al carrito** → **Finalizar compra**.
3. Completá el formulario de envío con datos inventados pero con **formato válido** (código de área sin 0 y celular sin 15, CP de 4 números, elegí una provincia) y tildá los términos → **Ir a pagar**.
4. Te lleva a Mercado Pago. **Ingresá con el comprador de prueba** (paso 1.B.3) y pagá con:

   | Dato | Valor |
   |---|---|
   | Tarjeta | **Mastercard 5031 7557 3453 0604** |
   | Vencimiento | **11/30** |
   | Código de seguridad | **123** |
   | Nombre del titular | **APRO** ← esto hace que se *apruebe* |
   | Documento | **DNI 12345678** |

   (Datos de la [documentación oficial de pruebas](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/integration-test/test-purchases).)
5. Al terminar, tocá **"Volver al sitio"**. Vas a caer en `…/checkout/success?payment_id=123456789&…`. **Copiá ese `payment_id`** (los números).

### Avisar que el pago se aprobó

En producción Mercado Pago avisa solo, pero necesita un sitio con https público. En tu computadora hay dos caminos:

**Opción A — sin túnel (la más simple).** Con el sitio corriendo, en otra terminal:

```
node --env-file=.env.local scripts/simulate-webhook.mjs 123456789
```

(reemplazá por tu `payment_id`). Esto manda el mismo aviso que mandaría Mercado Pago. El sitio **no se cree** lo que dice el aviso: le pregunta a Mercado Pago por ese pago real con tu token, igual que en producción.

**Opción B — con túnel (aviso 100 % real).** Instalá [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) y corré `cloudflared tunnel --url http://localhost:3000`. Te da una dirección `https://algo.trycloudflare.com`. Ponela en `SITE_URL` (y abrí el sitio por esa dirección), reiniciá `npm run dev` y repetí la compra: el aviso llega solo.

---

## 3. Qué tiene que pasar

| Dónde mirar | Qué tenés que ver |
|---|---|
| **Tu mail** (revisá Spam) | Asunto **"Nueva venta BYSLF · $1000"**, con: productos, talle, cantidad, nombre, email, código de área y celular, DNI, dirección completa (o la sucursal de Correo Argentino) e indicaciones, y el número de pago. **Un solo mail**. |
| **El mail del comprador** (si definiste `MAIL_FROM`) | Asunto **"Tu pedido BYSLF está confirmado · BYSLF-XXXXXXXX"**, con los productos, el total, la entrega elegida y los plazos. Sin DNI. Si no hay `MAIL_FROM`, no se le manda nada (Resend solo deja escribirte a vos). En una transferencia le llega al tocar "Ya transferí": "Recibimos tu aviso de transferencia". |
| **Supabase → Table Editor → `orders`** | Una fila con `status = paid`, `mp_payment_id` con el número del pago, y `terms_accepted_at` con la fecha. **No hay datos de envío en la base**: nombre, dirección, etc. te llegan solo en el mail de venta. |
| **Supabase → `stock`** | `producto-01 / Negro / M` pasó de **3 a 2**. |
| **Terminal del sitio** | Sin errores en rojo. |
| **El sitio** | La página "Gracias por ser parte", y el carrito vacío. |

Para ver todo de una vez, en el SQL Editor corré las consultas comentadas de `supabase/seed-test.sql` (sección 2).

---

## 4. Pruebas extra (2 minutos cada una)

| Prueba | Cómo | Resultado esperado |
|---|---|---|
| **Aviso repetido** | Corré de nuevo el comando `simulate-webhook` con el mismo `payment_id` | Responde 200 pero **no llega un segundo mail** y el stock no cambia |
| **Pago rechazado** | Pagá con titular **`OTHE`** | Mercado Pago lo rechaza; no llega mail; el pedido sigue `pending` |
| **Pago pendiente** | Pagá con titular **`CONT`** | No llega mail hasta que se apruebe |
| **Sin stock** | Pedí 4 unidades del talle M (quedan 2) | Mensaje "Sin stock: …" y no se crea nada |
| **Abandonar el pago** | Tocá "Ir a pagar" y cerrá la pestaña de Mercado Pago | `stock` baja 1 (está *reservado*) y el pedido queda `pending` |
| **Que la reserva venza** | En SQL: `update orders set expires_at = now() - interval '1 minute' where status = 'pending';` y después iniciá otra compra | El stock reservado **vuelve solo** y el pedido pasa a `expired` |
| **Arrepentimiento** | Entrá a `/arrepentimiento`, completá y enviá | Te muestra un código `ARR-…`, te llega mail y queda en la tabla `revocations` |
| **Límite de intentos** | Iniciá más de 6 pagos en 10 minutos | Mensaje "Demasiados intentos" (429). Se destraba con `truncate rate_limits;` |
| **Newsletter** | En la Home, dejá un email en "Enterate primero de cada drop" → Sumarme | Aparece el mensaje de éxito y el email queda en la tabla `subscribers`. Sin `MAIL_FROM`: `status = confirmed`, `email_verified = false`. Con `MAIL_FROM` (dominio verificado): `pending` y te llega un mail con el link para confirmar |
| **Confirmar y darse de baja** | Abrí `http://localhost:3000/newsletter/baja?t=` + el `token` de esa fila de `subscribers` → botón "Darme de baja" | `status = unsubscribed`. Abrir el link solo **no** hace nada: hay que tocar el botón |

---

## 5. Limpiar y volver a empezar

- Dejar la base como al principio: sección 3 de `supabase/seed-test.sql` (**solo en el proyecto de pruebas**).
- Antes de publicar, **sacá** `DEV_TEST_PRICE` y `NEXT_PUBLIC_LAUNCHED` de tu entorno.

---

## 5b. Probar el pago por transferencia

1. En `.env.local` agregá `ADMIN_LINK_SECRET=` con un valor largo (generalo con el comando de `.env.example`) y reiniciá `npm run dev`. Completá tus datos en `lib/transfer.ts`.
2. En el checkout elegí **Transferencia bancaria** y tocá **Reservar y ver datos de transferencia**: tiene que mostrarte el monto, la cuenta y un código `BYSLF-XXXXXXXX`. En Supabase → `orders` aparece una fila `pending` con `method = transfer` y el stock baja.
3. Tocá **Ya transferí, enviar comprobante**: te llega un mail "Transferencia por confirmar" con los datos de envío y un link. (Si no hay usuario de Instagram real en `lib/transfer.ts`, no se abre el chat.)
4. Abrí el link del mail y tocá **Confirmar que llegó la plata**: el pedido pasa a `paid`.

---

## 6. Si algo falla

| Síntoma | Causa probable |
|---|---|
| "Demasiados intentos" a la primera | Falta correr `schema.sql` de nuevo (función `rate_limit_hit`) |
| "El servicio no está disponible" (503) | Supabase mal configurado: corré `check-setup.mjs` |
| "Sin stock" siempre | La tabla `stock` está vacía: corré `seed-test.sql` |
| "Hay un producto sin precio definido" | Falta `DEV_TEST_PRICE=1000` en `.env.local` (y reiniciar `npm run dev`) |
| Mercado Pago da error 400 al iniciar el pago | Mirá la terminal: suele ser el token, o `SITE_URL` mal puesta. Si rechaza `localhost` en las URLs de retorno, usá el túnel (opción B) |
| No llega el mail pero la venta quedó `paid` | `ORDER_NOTIFY_EMAIL` distinto al mail de la cuenta de Resend (con el remitente de prueba solo podés escribirte a vos), o está en Spam. Corré `check-setup.mjs --mail` |
| El pedido quedó `pending` después de pagar | No llegó el aviso: usá `simulate-webhook.mjs` con el `payment_id` |
| Un pedido quedó `needs_review` | Pagó después de vencer la reserva, o el monto no coincide. Te llega un mail con ⚠: hay que resolverlo a mano |
| Llega un mail "⚠ PAGO DUPLICADO" | El cliente pagó dos veces: hay que **devolver uno** desde Mercado Pago |

---

## 7. Antes de vender de verdad

Mirá la lista en [docs/SEGURIDAD.md](SEGURIDAD.md#antes-de-abrir-la-tienda), sección final.
