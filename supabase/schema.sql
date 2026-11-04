-- BYSLF — pedidos y stock. Pegar completo en Supabase → SQL Editor → Run. Es seguro volver a correrlo.
--
-- Modelo: el catálogo (nombres, precios) vive en data/products.ts; acá solo el stock por variante y los pedidos.
-- Flujo: reserve_order (descuenta stock + pedido 'pending') → pago aprobado → confirm_order ('paid').
--        Si no se paga a tiempo, expire_pending devuelve el stock. Todo es atómico y a prueba de reintentos.

create table if not exists stock (
  slug  text not null,
  color text not null,
  size  text not null,
  qty   integer not null check (qty >= 0),
  primary key (slug, color, size)
);

create table if not exists orders (
  id            uuid primary key,                       -- = external_reference en Mercado Pago
  status        text not null default 'pending'
                check (status in ('pending', 'paid', 'expired', 'needs_review')),
  amount        numeric(12, 2) not null,
  items         jsonb not null,                         -- [{slug, color, size, qty}]
  mp_payment_id bigint unique,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  paid_at       timestamptz
);

-- Los datos de envío (nombre, dirección, teléfono, DNI, email) NO se guardan acá: viajan en el metadata del pago de
-- Mercado Pago y llegan solo por mail. Si una versión anterior los guardaba, se borran:
alter table orders drop column if exists shipping;
-- buyer_key = hash irreversible del email: solo sirve para limitar las reservas pendientes por persona.
alter table orders add column if not exists buyer_key text;
-- Constancia de cuándo aceptó los términos (no identifica a nadie).
alter table orders add column if not exists terms_accepted_at timestamptz;
-- Cómo paga: 'mp' = Mercado Pago (se confirma solo con el webhook) · 'transfer' = transferencia (la confirmás vos).
alter table orders add column if not exists method text not null default 'mp' check (method in ('mp', 'transfer'));
-- Cuándo el comprador tocó "Ya transferí, enviar comprobante" (el mail con sus datos sale una sola vez).
alter table orders add column if not exists notified_at timestamptz;
create index if not exists orders_buyer_pending on orders (buyer_key) where status = 'pending';

-- Solo el servidor (service role) toca estas tablas: RLS activado y sin políticas = el navegador no accede a nada.
alter table stock  enable row level security;
alter table orders enable row level security;

-- Devuelve al stock los ítems de un pedido y lo marca vencido. Usa el pedido ya bloqueado.
create or replace function _release(o orders) returns void language plpgsql as $$
declare it jsonb;
begin
  for it in select * from jsonb_array_elements(o.items) loop
    update stock set qty = qty + (it->>'qty')::int
     where slug = it->>'slug' and color = it->>'color' and size = it->>'size';
  end loop;
  update orders set status = 'expired' where id = o.id;
end $$;

-- Libera las reservas vencidas.
create or replace function expire_pending() returns void language plpgsql as $$
declare o orders;
begin
  for o in select * from orders where status = 'pending' and expires_at < now() for update skip locked loop
    perform _release(o);
  end loop;
end $$;

-- Reserva: descuenta stock de todos los ítems o falla entero con 'out_of_stock:slug|color|size'.
-- (Se reemplazan las versiones anteriores, que recibían los datos de envío.)
drop function if exists reserve_order(uuid, jsonb, numeric, int);
drop function if exists reserve_order(uuid, jsonb, numeric, int, jsonb);
drop function if exists reserve_order(uuid, jsonb, numeric, int, text, timestamptz);
create or replace function reserve_order(p_id uuid, p_items jsonb, p_amount numeric, p_minutes int, p_buyer text, p_terms timestamptz, p_method text default 'mp')
returns void language plpgsql as $$
declare it jsonb;
begin
  perform expire_pending();
  -- Antiabuso: una misma persona (por hash de email) no puede retener stock con más de 3 reservas pendientes a la vez.
  if (select count(*) from orders where status = 'pending' and buyer_key = p_buyer) >= 3 then
    raise exception 'too_many_pending';
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    update stock set qty = qty - (it->>'qty')::int
     where slug = it->>'slug' and color = it->>'color' and size = it->>'size'
       and qty >= (it->>'qty')::int;
    if not found then
      raise exception 'out_of_stock:%|%|%', it->>'slug', it->>'color', it->>'size';
    end if;
  end loop;
  insert into orders (id, amount, items, buyer_key, terms_accepted_at, method, expires_at)
  values (p_id, p_amount, p_items, p_buyer, p_terms, p_method, now() + make_interval(mins => p_minutes));
end $$;

-- Libera la reserva si todavía está pendiente (ej. falló la creación del pago).
create or replace function release_order(p_id uuid) returns void language plpgsql as $$
declare o orders;
begin
  select * into o from orders where id = p_id and status = 'pending' for update;
  if found then perform _release(o); end if;
end $$;

-- Confirma un pago aprobado. Idempotente: Mercado Pago puede avisar el mismo pago varias veces.
-- Devuelve: 'paid' | 'already_paid' | 'duplicate_payment' | 'needs_review' | 'unknown_order'
create or replace function confirm_order(p_id uuid, p_payment bigint, p_amount numeric)
returns text language plpgsql as $$
declare o orders;
begin
  select * into o from orders where id = p_id for update;
  if not found then return 'unknown_order'; end if;
  if o.status = 'paid' then
    -- Mismo pago avisado de nuevo = normal. OTRO pago para un pedido ya pagado = el cliente pagó dos veces: hay que devolver uno.
    if o.mp_payment_id is distinct from p_payment then return 'duplicate_payment'; end if;
    return 'already_paid';
  end if;
  if o.status = 'needs_review' then return 'needs_review'; end if;
  -- Pagó después de que venció la reserva, o el monto no coincide: no se da por bueno solo; lo revisa una persona.
  if o.status = 'expired' or o.amount <> p_amount then
    update orders set status = 'needs_review', mp_payment_id = p_payment where id = p_id;
    return 'needs_review';
  end if;
  update orders set status = 'paid', mp_payment_id = p_payment, paid_at = now() where id = p_id;
  return 'paid';
end $$;

-- Transferencia: el comprador avisó que transfirió. Devuelve 'notified' (la primera vez: hay que mandar el mail) |
-- 'already_notified' | 'already_paid' | 'expired' (venció la reserva) | 'unknown_order'
create or replace function mark_transfer_notified(p_id uuid) returns text language plpgsql as $$
declare o orders;
begin
  select * into o from orders where id = p_id for update;
  if not found or o.method <> 'transfer' then return 'unknown_order'; end if;
  if o.status = 'paid' then return 'already_paid'; end if;
  if o.status <> 'pending' or o.expires_at < now() then return 'expired'; end if;
  if o.notified_at is not null then return 'already_notified'; end if;
  update orders set notified_at = now() where id = p_id;
  return 'notified';
end $$;

-- Si el mail con los datos de envío NO se pudo mandar, se des-marca el aviso para que el comprador pueda reintentar
-- (los datos de envío no se guardan en ningún otro lado).
create or replace function reset_transfer_notice(p_id uuid) returns void language plpgsql as $$
begin
  update orders set notified_at = null where id = p_id and method = 'transfer' and status = 'pending';
end $$;

-- Transferencia: confirmás vos que llegó la plata. Idempotente. Devuelve 'paid' | 'already_paid' | 'unknown_order'.
-- Si la reserva ya había vencido (devolvió el stock), lo vuelve a descontar; si ya no alcanza falla con 'out_of_stock:...'
-- y no cambia nada: en ese caso hay que devolverle la plata al comprador.
create or replace function confirm_transfer(p_id uuid) returns text language plpgsql as $$
declare o orders; it jsonb;
begin
  select * into o from orders where id = p_id for update;
  if not found or o.method <> 'transfer' then return 'unknown_order'; end if;
  if o.status = 'paid' then return 'already_paid'; end if;
  if o.status = 'expired' then
    for it in select * from jsonb_array_elements(o.items) loop
      update stock set qty = qty - (it->>'qty')::int
       where slug = it->>'slug' and color = it->>'color' and size = it->>'size'
         and qty >= (it->>'qty')::int;
      if not found then
        raise exception 'out_of_stock:%|%|%', it->>'slug', it->>'color', it->>'size';
      end if;
    end loop;
  end if;
  update orders set status = 'paid', paid_at = now() where id = p_id;
  return 'paid';
end $$;

-- Las funciones solo las puede llamar el servidor.
revoke all on function reserve_order(uuid, jsonb, numeric, int, text, timestamptz, text) from public, anon, authenticated;
revoke all on function mark_transfer_notified(uuid)             from public, anon, authenticated;
revoke all on function confirm_transfer(uuid)                   from public, anon, authenticated;
revoke all on function reset_transfer_notice(uuid)              from public, anon, authenticated;
revoke all on function release_order(uuid)                      from public, anon, authenticated;
revoke all on function confirm_order(uuid, bigint, numeric)     from public, anon, authenticated;
revoke all on function expire_pending()                         from public, anon, authenticated;
revoke all on function _release(orders)                         from public, anon, authenticated;

-- Cargar stock (ejemplo; completar con las cantidades reales, una fila por producto/color/talle):
-- insert into stock (slug, color, size, qty) values ('producto-01', 'Negro', 'M', 10)
-- on conflict (slug, color, size) do update set qty = excluded.qty;

-- Botón de arrepentimiento: cada solicitud queda registrada con su código de identificación.
create table if not exists revocations (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,        -- ej. ARR-7K3MQ9XD, se le informa al consumidor
  name       text not null,
  email      text not null,
  order_ref  text,
  details    text,
  created_at timestamptz not null default now()
);
alter table revocations enable row level security;

-- Límite de uso (antiabuso). La clave llega ya hasheada desde el servidor: acá no se guardan IPs ni emails en claro.
create table if not exists rate_limits (
  key          text primary key,
  window_start timestamptz not null,
  count        integer not null
);
alter table rate_limits enable row level security;

-- Cuenta un intento. Devuelve true si está dentro del límite, false si se pasó.
create or replace function rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
returns boolean language plpgsql as $$
declare r rate_limits;
begin
  insert into rate_limits (key, window_start, count) values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case when rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then now() else rate_limits.window_start end,
    count        = case when rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then 1 else rate_limits.count + 1 end
  returning * into r;
  if random() < 0.02 then delete from rate_limits where window_start < now() - interval '1 day'; end if; -- limpieza
  return r.count <= p_limit;
end $$;

revoke all on function rate_limit_hit(text, int, int) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Newsletter ("Enterate primero de cada drop").
-- status: pending = anotado, falta confirmar por mail · confirmed = activo · unsubscribed = se dio de baja.
-- email_verified: true solo si confirmó con el link del mail. Los anotados cuando todavía no había dominio para
-- mandar mails quedan en confirmed + email_verified=false: pedirles confirmación ANTES de mandarles campañas.
create table if not exists subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,           -- siempre en minúsculas
  status          text not null default 'pending' check (status in ('pending', 'confirmed', 'unsubscribed')),
  email_verified  boolean not null default false,
  token           text not null unique,           -- 64 hex: sirve para confirmar y para el link de baja de cada mail
  created_at      timestamptz not null default now(),
  confirmed_at    timestamptz,
  unsubscribed_at timestamptz
);
alter table subscribers enable row level security;

-- Anota un email. Devuelve {status, token}; si el email ya existía devuelve SU token y estado (no se reinicia nada).
-- Con p_double_optin entra como 'pending'; sin él, como 'confirmed' pero sin verificar.
create or replace function newsletter_subscribe(p_email text, p_token text, p_double_optin boolean)
returns jsonb language plpgsql as $$
declare
  s subscribers;
  e text := lower(trim(p_email));
  new_status text := case when p_double_optin then 'pending' else 'confirmed' end;
begin
  select * into s from subscribers where email = e for update;
  if not found then
    insert into subscribers (email, status, token, confirmed_at)
    values (e, new_status, p_token, case when p_double_optin then null else now() end)
    returning * into s;
  elsif s.status = 'unsubscribed' then
    -- Se volvió a anotar por su cuenta: vuelve a empezar (con confirmación si corresponde).
    update subscribers
       set status = new_status, email_verified = false, unsubscribed_at = null,
           confirmed_at = case when p_double_optin then null else now() end
     where id = s.id
    returning * into s;
  end if;
  return jsonb_build_object('status', s.status, 'token', s.token);
end $$;

-- Confirma con el link del mail. Solo pasa de 'pending' a 'confirmed': un token de alguien dado de baja NO lo reactiva.
-- Devuelve: 'confirmed' | 'already' | 'invalid'
create or replace function newsletter_confirm(p_token text) returns text language plpgsql as $$
declare s subscribers;
begin
  select * into s from subscribers where token = p_token for update;
  if not found then return 'invalid'; end if;
  if s.status = 'pending' then
    update subscribers set status = 'confirmed', email_verified = true, confirmed_at = now() where id = s.id;
    return 'confirmed';
  end if;
  if s.status = 'confirmed' then
    update subscribers set email_verified = true where id = s.id;
  end if;
  return 'already';
end $$;

-- Baja con el link de cualquier mail. Devuelve: 'unsubscribed' | 'already' | 'invalid'
create or replace function newsletter_unsubscribe(p_token text) returns text language plpgsql as $$
declare s subscribers;
begin
  select * into s from subscribers where token = p_token for update;
  if not found then return 'invalid'; end if;
  if s.status = 'unsubscribed' then return 'already'; end if;
  update subscribers set status = 'unsubscribed', unsubscribed_at = now() where id = s.id;
  return 'unsubscribed';
end $$;

revoke all on function newsletter_subscribe(text, text, boolean) from public, anon, authenticated;
revoke all on function newsletter_confirm(text)                  from public, anon, authenticated;
revoke all on function newsletter_unsubscribe(text)              from public, anon, authenticated;
