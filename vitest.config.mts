import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      // "server-only" lanza error fuera de Next; en las pruebas se reemplaza por un módulo vacío.
      "server-only": path.resolve(import.meta.dirname, "tests/helpers/empty.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    testTimeout: 30000,
    // Las pruebas existentes cubren también el envío a domicilio: se lo habilita acá. Hay pruebas aparte con el valor de producción (apagado).
    env: { NEXT_PUBLIC_HOME_DELIVERY: "true" },
  },
});
