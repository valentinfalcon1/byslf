-- DATOS DE PRUEBA para la compra de ensayo. Pegar en Supabase → SQL Editor → Run.
-- Es solo para probar: el stock REAL se carga después, con las cantidades verdaderas (una fila por producto/color/talle).

-- 1) Stock de prueba para el producto 01 (3 unidades por variante, para probar también "sin stock")
insert into stock (slug, color, size, qty) values
  ('producto-01', 'Negro', 'S', 3),
  ('producto-01', 'Negro', 'M', 3),
  ('producto-01', 'Negro', 'L', 3)
on conflict (slug, color, size) do update set qty = excluded.qty;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) VER QUÉ PASÓ (correr después de cada prueba)

-- Stock actual
-- select slug, color, size, qty from stock order by slug, color, size;

-- Pedidos (lo más nuevo primero). status: pending = esperando pago · paid = pagado · expired = venció · needs_review = revisar a mano
-- (Los datos de envío NO están en la base: llegan por mail y están en el pago de Mercado Pago.)
-- select id, status, amount, items, mp_payment_id, created_at, paid_at, terms_accepted_at
--   from orders order by created_at desc limit 20;

-- Pedidos de arrepentimiento
-- select code, name, email, order_ref, created_at from revocations order by created_at desc;

-- Newsletter: todos los anotados (status: pending = falta confirmar · confirmed = activo · unsubscribed = se dio de baja)
-- select email, status, email_verified, created_at, confirmed_at from subscribers order by created_at desc;

-- Newsletter: a quiénes SÍ se les puede escribir (activos). Si email_verified = false se anotaron cuando todavía no había
-- dominio para mandarles un mail de confirmación: pediles que confirmen ANTES de mandarles campañas.
-- select email from subscribers where status = 'confirmed' and email_verified = true;

-- Newsletter: el link de baja personal de cada uno (tiene que ir en CADA mail de campaña; cambiá la dirección por la real)
-- select email, 'https://TU-DOMINIO/newsletter/baja?t=' || token as link_de_baja from subscribers where status = 'confirmed';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) EMPEZAR DE CERO (borra TODOS los pedidos y límites de prueba y repone el stock de arriba)
--    ⚠ Solo en el proyecto de PRUEBA. Con ventas reales esto borraría pedidos de clientes.

-- truncate orders, revocations, rate_limits, subscribers;
-- update stock set qty = 3 where slug = 'producto-01';

-- 4) PROBAR EL VENCIMIENTO sin esperar 30 minutos: hacer que la última reserva pendiente ya haya vencido.
--    La próxima compra (o cualquier reserva) devuelve ese stock solo.

-- update orders set expires_at = now() - interval '1 minute' where status = 'pending';

-- 5) DESBLOQUEAR el límite de intentos si te quedaste sin intentos durante las pruebas:
-- truncate rate_limits;
