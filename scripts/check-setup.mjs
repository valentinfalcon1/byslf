// Verifica que todo esté bien configurado ANTES de probar una compra. No muestra ninguna clave.
//
//   node --env-file=.env.local scripts/check-setup.mjs          → solo consultas de lectura
//   node --env-file=.env.local scripts/check-setup.mjs --mail   → además manda UN mail de prueba a ORDER_NOTIFY_EMAIL
const env = process.env;
const sendMail = process.argv.includes("--mail");
let failed = 0;
let warned = 0;

const ok = (m) => console.log(`  ✓ ${m}`);
const warn = (m, hint) => { warned++; console.log(`  ⚠ ${m}${hint ? `\n      → ${hint}` : ""}`); };
const bad = (m, hint) => { failed++; console.log(`  ✗ ${m}${hint ? `\n      → ${hint}` : ""}`); };
const title = (t) => console.log(`\n${t}`);

// ── 1. Variables ────────────────────────────────────────────────────────────
title("1. Variables en .env.local");
for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "MP_ACCESS_TOKEN", "RESEND_API_KEY", "ORDER_NOTIFY_EMAIL", "SITE_URL"]) {
  env[k] ? ok(`${k} está definida`) : bad(`${k} NO está definida`, "completala en .env.local y guardá con Ctrl+S");
}
if (!env.ADMIN_LINK_SECRET) warn("ADMIN_LINK_SECRET no está definida", "sin ella los mails de transferencia NO traen el link para confirmar el pago. Generá una con:  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
else if (env.ADMIN_LINK_SECRET.length < 32) bad("ADMIN_LINK_SECRET es muy corta (mínimo 32 caracteres)", "generá una más larga: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
else ok("ADMIN_LINK_SECRET está definida");
for (const k of ["DEV_TEST_PRICE", "NEXT_PUBLIC_LAUNCHED", "MP_WEBHOOK_SECRET", "MAIL_FROM"]) {
  console.log(`  · ${k}: ${env[k] ? "definida" : "no definida (opcional)"}`);
}
if (env.DEV_TEST_PRICE && env.NODE_ENV === "production") warn("DEV_TEST_PRICE con NODE_ENV=production: se ignora, pero sacala del entorno real");
if (env.SITE_URL && !env.SITE_URL.startsWith("https://")) {
  warn("SITE_URL no es https", "Mercado Pago NO va a avisar los pagos solos. Usá scripts/simulate-webhook.mjs para probar, o un túnel https (ver docs/PRUEBA-DE-COMPRA.md).");
}

// ── 2. Supabase ─────────────────────────────────────────────────────────────
title("2. Supabase");
if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  // La clave tiene que ser la SECRETA (service_role). Si se pegó la pública (anon), RLS bloquea todo.
  if (key.startsWith("sb_secret_")) ok("la clave es una 'secret key'");
  else if (key.startsWith("sb_publishable_")) bad("pegaste la clave PÚBLICA (publishable)", "usá la service role / secret key (Project Settings → API)");
  else {
    try {
      const role = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role;
      role === "service_role" ? ok("la clave es service_role") : bad(`la clave es de rol '${role}', no service_role`, "usá la 'service_role' (Project Settings → API), no la 'anon'");
    } catch {
      warn("no pude reconocer el formato de la clave");
    }
  }
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  try {
    const root = await fetch(`${env.SUPABASE_URL}/rest/v1/`, { headers });
    if (!root.ok) bad(`Supabase respondió ${root.status} al conectar`, "revisá SUPABASE_URL y la clave");
    else {
      ok("conexión con Supabase");
      const paths = Object.keys((await root.json()).paths ?? {});
      for (const t of ["/stock", "/orders", "/revocations", "/rate_limits", "/subscribers"]) paths.includes(t) ? ok(`tabla ${t.slice(1)} existe`) : bad(`falta la tabla ${t.slice(1)}`, "pegá TODO supabase/schema.sql en el SQL Editor y tocá Run");
      for (const f of ["reserve_order", "release_order", "confirm_order", "mark_transfer_notified", "confirm_transfer", "reset_transfer_notice", "expire_pending", "rate_limit_hit", "newsletter_subscribe", "newsletter_confirm", "newsletter_unsubscribe"]) {
        paths.includes(`/rpc/${f}`) ? ok(`función ${f} existe`) : bad(`falta la función ${f}`, "volvé a correr TODO supabase/schema.sql (es seguro correrlo de nuevo)");
      }
      const stock = await (await fetch(`${env.SUPABASE_URL}/rest/v1/stock?select=slug,color,size,qty&order=slug`, { headers })).json();
      if (!Array.isArray(stock)) bad("no pude leer la tabla stock");
      else if (stock.length === 0) warn("la tabla stock está vacía: no se puede comprar nada", "para probar, corré supabase/seed-test.sql");
      else ok(`stock cargado: ${stock.length} variantes, ${stock.reduce((n, r) => n + r.qty, 0)} unidades en total`);
    }
  } catch (e) {
    bad(`no pude conectar con Supabase (${e.cause?.code ?? e.message})`, "revisá SUPABASE_URL");
  }
}

// ── 3. Mercado Pago ─────────────────────────────────────────────────────────
title("3. Mercado Pago");
if (env.MP_ACCESS_TOKEN) {
  try {
    const r = await fetch("https://api.mercadopago.com/users/me", { headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` } });
    if (r.ok) {
      const u = await r.json();
      ok(`token válido (cuenta ${u.id}, país ${u.site_id})`);
      if (u.site_id && u.site_id !== "MLA") warn(`la cuenta es de ${u.site_id}, no de Argentina (MLA)`);
      console.log("  · Verificá que esa cuenta sea la VENDEDORA DE PRUEBA (Tus integraciones → tu aplicación → Cuentas de prueba).");
    } else bad(`Mercado Pago rechazó el token (${r.status})`, "copiá de nuevo el Access Token de las credenciales de PRUEBA");
  } catch (e) {
    bad(`no pude conectar con Mercado Pago (${e.cause?.code ?? e.message})`);
  }
}

// ── 4. Mails (Resend) ───────────────────────────────────────────────────────
title("4. Mails (Resend)");
if (env.RESEND_API_KEY) {
  if (sendMail && env.ORDER_NOTIFY_EMAIL) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.MAIL_FROM ?? "BYSLF <onboarding@resend.dev>",
        to: [env.ORDER_NOTIFY_EMAIL],
        subject: "BYSLF — mail de prueba",
        text: "Si lo estás leyendo, los avisos de venta van a llegar a esta casilla. (Revisá también Spam la primera vez.)",
      }),
    });
    r.ok
      ? ok(`mail de prueba enviado a ${env.ORDER_NOTIFY_EMAIL}: revisá la bandeja (y Spam)`)
      : bad(`Resend rechazó el envío (${r.status}): ${(await r.text()).slice(0, 200)}`, "con onboarding@resend.dev solo podés escribirle al mail con el que abriste la cuenta de Resend");
  } else {
    try {
      const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` } });
      if (r.ok) ok("la clave de Resend es válida");
      else if (r.status === 401 || r.status === 403) warn("no pude validar la clave sin enviar (puede ser una clave de solo envío)", "corré con --mail para probarla enviando un mail de verdad");
      else bad(`Resend respondió ${r.status}`);
    } catch (e) {
      bad(`no pude conectar con Resend (${e.cause?.code ?? e.message})`);
    }
  }
  if (!env.MAIL_FROM) {
    console.log("  · Sin MAIL_FROM: los avisos salen de onboarding@resend.dev y solo pueden llegarte a vos (suficiente para avisos de venta).");
    warn(
      "Newsletter SIN confirmación por mail",
      "sin dominio verificado no se le puede escribir a quien se anota: queda guardado como 'sin verificar' (email_verified = false). Verificá un dominio en Resend y definí MAIL_FROM para activar la confirmación (doble opt-in) antes de abrir al público.",
    );
  } else {
    ok("MAIL_FROM definido: el newsletter pide confirmación por mail (doble opt-in)");
  }
}

console.log(`\n${failed ? `✗ ${failed} problema(s) para resolver antes de probar.` : "✓ Todo listo para probar."}${warned ? ` (${warned} aviso/s)` : ""}`);
process.exit(failed ? 1 : 0);
