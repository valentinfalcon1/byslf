import { defineConfig } from "@playwright/test";

/**
 * Pruebas en un Chrome real. Levantan DOS copias del sitio (puertos 3200 y 3201) con carpetas de build propias,
 * así que no interfieren con tu `npm run dev`.
 *   - "tienda abierta": LAUNCHED simulado + precio de prueba (NEXT_PUBLIC_LAUNCHED / DEV_TEST_PRICE)
 *   - "teaser": el sitio como está hoy (misterioso, sin tienda)
 * Requiere Chrome instalado.
 */
// Variables vacías: Next no las pisa con las de .env.local, así que estas pruebas NUNCA tocan tu Supabase,
// ni Mercado Pago, ni mandan mails de verdad, aunque tengas todo configurado.
const NO_REAL_SERVICES = {
  SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  MP_ACCESS_TOKEN: "",
  MP_WEBHOOK_SECRET: "",
  RESEND_API_KEY: "",
  ORDER_NOTIFY_EMAIL: "",
  MAIL_FROM: "",
};

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { channel: "chrome", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "tienda-abierta", testMatch: /abierta\.spec\.ts/, use: { baseURL: "http://localhost:3200" } },
    { name: "teaser", testMatch: /teaser\.spec\.ts/, use: { baseURL: "http://localhost:3201" } },
  ],
  webServer: [
    {
      command: "npx next dev -p 3200",
      url: "http://localhost:3200",
      timeout: 180_000,
      reuseExistingServer: false,
      env: { NEXT_DIST_DIR: ".next-e2e", NEXT_PUBLIC_LAUNCHED: "true", NEXT_PUBLIC_HOME_DELIVERY: "true", DEV_TEST_PRICE: "1000", ...NO_REAL_SERVICES },
    },
    {
      command: "npx next dev -p 3201",
      url: "http://localhost:3201",
      timeout: 180_000,
      reuseExistingServer: false,
      env: { NEXT_DIST_DIR: ".next-e2e-teaser", NEXT_PUBLIC_LAUNCHED: "false", ...NO_REAL_SERVICES },
    },
  ],
});
