import type { Metadata } from "next";
import { Archivo, Space_Mono } from "next/font/google";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartProvider } from "@/components/cart/CartProvider";
import { CookieNotice } from "@/components/CookieNotice";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: "900",
  style: "italic",
  variable: "--font-archivo",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "BYSLF — Create more", template: "%s — BYSLF" },
  description: "[DESCRIPCIÓN DE LA MARCA PARA SEO]",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${archivo.variable} ${spaceMono.variable}`}>
      <body>
        <CartProvider>
          {children}
          <CartDrawer />
        </CartProvider>
        <CookieNotice />
        <div className="grain" aria-hidden="true" />
      </body>
    </html>
  );
}
