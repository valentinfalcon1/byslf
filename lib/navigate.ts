/** Navega a otra dirección (ej. la página de pago de Mercado Pago). Aislado en una función para poder probarlo. */
export function goTo(url: string) {
  window.location.href = url;
}
