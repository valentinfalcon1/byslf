/**
 * Datos del titular de la tienda. Se muestran en las páginas legales y en el footer.
 * COMPLETAR todo lo que está entre [corchetes] antes de abrir la tienda (la ley exige identificar al proveedor).
 */
export const BUSINESS = {
  brand: "BYSLF",
  legalName: "Valentin Falcon Pfister",
  cuit: "20-45380475-6",
  address: "Córdoba, Argentina", // ⚠ PROVISORIO: antes de empezar a vender, poner el domicilio comercial real (oficina, coworking, etc.)
  email: "byslfco@gmail.com",
  phone: "[TELÉFONO / WHATSAPP]",
  /** Plazo que declarás para conservar datos de pedidos (ej. el que corresponda por obligaciones contables/fiscales). */
  retention: "[PLAZO DE CONSERVACIÓN]",
  /** Número de inscripción en el Registro Nacional de Bases de Datos Personales, si corresponde. */
  dbRegistry: "[N° DE INSCRIPCIÓN, si corresponde]",
  updated: "[FECHA DE ÚLTIMA ACTUALIZACIÓN]",
} as const;

/** Reclamos del consumidor (verificar el link vigente al publicar). */
export const CONSUMER_DEFENSE_URL = "https://www.argentina.gob.ar/produccion/defensadelconsumidor";

/**
 * Plazos y condiciones de la política comercial. Un solo lugar: los leen "Cambios y devoluciones" y el desplegable del producto.
 * ⚠ Son los valores propuestos al armar el sitio: confirmá que los vas a cumplir antes de abrir la tienda.
 */
export const POLICY = {
  /** Días corridos, desde que el cliente recibe el pedido, para pedir un cambio de talle o color. */
  exchangeDays: 30,
  /** Días hábiles para devolver el dinero, desde que recibimos el producto devuelto. */
  refundBusinessDays: 10,
  /** Tiempo que tardamos en despachar, desde que se acredita el pago (días hábiles). */
  dispatchDays: "2 a 5",
  /** Tiempo estimado de entrega de Correo Argentino, según el destino (días hábiles). */
  deliveryDays: "3 a 10",
} as const;
