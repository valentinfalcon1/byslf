"use client";

import { useEffect } from "react";
import { useCart } from "./CartProvider";

/** Vacía el carrito al volver de un pago aprobado. */
export function ClearCartOnMount() {
  const { clear } = useCart();
  useEffect(() => clear(), [clear]);
  return null;
}
