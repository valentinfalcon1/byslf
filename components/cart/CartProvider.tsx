"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartItem = {
  key: string;
  slug: string;
  name: string;
  image: string;
  price: number | null;
  color: string;
  size: string;
  qty: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  /** Suma de precios; `null` si algún producto todavía no tiene precio. */
  subtotal: number | null;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (item: Omit<CartItem, "key" | "qty">) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "byslf-cart";

/**
 * El carrito guardado en el navegador no es de fiar (se puede borrar, corromper o editar a mano).
 * Se descarta todo lo que no tenga la forma exacta: un dato roto no puede tirar abajo el sitio entero.
 * (El servidor igual vuelve a validar y a poner los precios al pagar: esto protege la pantalla, no el cobro.)
 */
function sanitizeCart(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  const str = (v: unknown, max = 120) => typeof v === "string" && v.length > 0 && v.length <= max;
  return raw.filter(
    (i): i is CartItem =>
      !!i &&
      typeof i === "object" &&
      str(i.key, 300) &&
      str(i.slug) &&
      str(i.name) &&
      // solo imágenes propias del sitio: next/image falla con orígenes no configurados
      typeof i.image === "string" && /^\/img\/[\w./-]+$/.test(i.image) &&
      (i.price === null || (typeof i.price === "number" && Number.isFinite(i.price) && i.price >= 0)) &&
      str(i.color, 40) &&
      str(i.size, 10) &&
      Number.isInteger(i.qty) && i.qty >= 1 && i.qty <= 10,
  );
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(sanitizeCart(JSON.parse(raw)));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items, hydrated]);

  const add = useCallback<CartContextValue["add"]>((item) => {
    const key = `${item.slug}|${item.color}|${item.size}`;
    setItems((prev) => {
      const found = prev.find((i) => i.key === key);
      if (found) return prev.map((i) => (i.key === key ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { ...item, key, qty: 1 }];
    });
    setIsOpen(true);
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setItems((prev) => (qty <= 0 ? prev.filter((i) => i.key !== key) : prev.map((i) => (i.key === key ? { ...i, qty } : i))));
  }, []);

  const remove = useCallback((key: string) => setItems((prev) => prev.filter((i) => i.key !== key)), []);

  // Estas funciones tienen que ser ESTABLES (misma identidad en cada render): hay efectos que dependen de ellas
  // (ClearCartOnMount, el cajón). Si cambian en cada render, esos efectos se repiten sin fin.
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  // Vaciar un carrito que ya está vacío no cambia nada (no devuelve un array nuevo): corta cualquier bucle.
  // También borra lo guardado en el navegador: este efecto puede correr ANTES de que el carrito termine de
  // cargarse desde ahí (los efectos de los hijos corren primero), y sin esto la carga lo restauraría.
  const clear = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setItems((prev) => (prev.length === 0 ? prev : []));
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((n, i) => n + i.qty, 0);
    const subtotal = items.some((i) => i.price === null) ? null : items.reduce((n, i) => n + (i.price ?? 0) * i.qty, 0);
    return { items, count, subtotal, isOpen, open, close, add, setQty, remove, clear };
  }, [items, isOpen, open, close, add, setQty, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}
