/**
 * Datos del titular de la tienda. Se muestran en las páginas legales y en el footer.
 * COMPLETAR todo lo que está entre [corchetes] antes de abrir la tienda (la ley exige identificar al proveedor).
 */
export const BUSINESS = {
  brand: "BYSLF",
  legalName: "[RAZÓN SOCIAL O NOMBRE Y APELLIDO DEL TITULAR]",
  cuit: "[CUIT]",
  address: "[DOMICILIO LEGAL — Córdoba, Argentina]",
  email: "[EMAIL DE CONTACTO]",
  phone: "[TELÉFONO / WHATSAPP]",
  /** Plazo que declarás para conservar datos de pedidos (ej. el que corresponda por obligaciones contables/fiscales). */
  retention: "[PLAZO DE CONSERVACIÓN]",
  /** Número de inscripción en el Registro Nacional de Bases de Datos Personales, si corresponde. */
  dbRegistry: "[N° DE INSCRIPCIÓN, si corresponde]",
  updated: "[FECHA DE ÚLTIMA ACTUALIZACIÓN]",
} as const;

/** Reclamos del consumidor (verificar el link vigente al publicar). */
export const CONSUMER_DEFENSE_URL = "https://www.argentina.gob.ar/produccion/defensadelconsumidor";
