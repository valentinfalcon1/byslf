import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad para todas las páginas.
 * La CSP incluye solo las directivas que no rompen Next (sin script-src: eso requiere nonces; ver README de seguridad).
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
];

const nextConfig: NextConfig = {
  // Permite correr una segunda copia del sitio (pruebas e2e) sin pisar la carpeta de build de desarrollo.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Next 16 guarda las fotos optimizadas 4 horas: si reemplazás una foto, se seguía viendo la vieja. En desarrollo se renueva
  // al minuto; en producción, a la hora (y conviene cambiar el nombre del archivo cuando se reemplaza una foto).
  images: { minimumCacheTTL: process.env.NODE_ENV === "production" ? 3600 : 60 },
  // Solo desarrollo: permite abrir el sitio local a través de un túnel (para recibir avisos reales de Mercado Pago).
  allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok-free.dev"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
