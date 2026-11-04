import { SOCIAL } from "@/lib/site";

/** Pago por transferencia: datos y ayudantes compartidos entre el formulario (navegador) y el servidor. */

/** Cuánto tiempo se le guarda el stock a quien elige pagar por transferencia. */
export const TRANSFER_RESERVE_MINUTES = 24 * 60;

/** Datos de la cuenta a la que transfiere el cliente. Completalos antes de lanzar. */
export const TRANSFER_ACCOUNT = {
  holder: "[TITULAR DE LA CUENTA]",
  bank: "[BANCO O BILLETERA]",
  cbu: "[CBU / CVU]",
  alias: "[ALIAS]",
};

/** Usuario de Instagram (sin @) al que el cliente manda el comprobante. */
export const INSTAGRAM_USER: string = SOCIAL.instagram.user;

/** Link para abrir el chat con la cuenta, o null mientras el usuario siga siendo un placeholder. */
export const instagramChatUrl = (user: string = INSTAGRAM_USER): string | null =>
  /^[A-Za-z0-9._]{1,30}$/.test(user) ? `https://ig.me/m/${user}` : null;

/** Código corto para poner en el concepto de la transferencia y reconocer el pedido. */
export const orderCode = (orderId: string): string => `BYSLF-${orderId.slice(0, 8).toUpperCase()}`;
