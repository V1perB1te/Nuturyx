export const APP_NAME = "Nuturyx";

export const ROLES = {
  ADMIN: "admin",
  VENDEDOR: "vendedor",
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export const FACTURA_ESTADOS = {
  PENDIENTE_IMPRESION: "pendiente_impresion",
  IMPRESA: "impresa",
  ANULADA: "anulada",
} as const;

export const TIPO_DESCUENTO = {
  PORCENTAJE: "porcentaje",
  VALOR: "valor",
} as const;
