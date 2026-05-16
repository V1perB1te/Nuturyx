export type PedidoItemInput = {
  producto_id: string;
  nombre?: string;
  cantidad: number;
  precio_unitario: number;
  subtotal?: number;
  costo_unitario?: number;
};

export type CrearPedidoInput = {
  cliente_nombre: string;
  cliente_whatsapp: string;
  cliente_email?: string;
  canal?: string;
  items: PedidoItemInput[];
  metodo_pago?: string;
  notas_cliente?: string;
  descripcion_bot?: string;
  estado_inicial?: string;
};

const WHATSAPP_REGEX = /^\d{10,15}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateWhatsApp(value: string) {
  return WHATSAPP_REGEX.test(value);
}

export function validateEmail(value: string) {
  return EMAIL_REGEX.test(value);
}

export function validateCrearPedidoPayload(payload: unknown): { ok: true; data: CrearPedidoInput } | { ok: false; error: string } {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Payload inválido" };
  }

  const data = payload as Partial<CrearPedidoInput>;

  if (!data.cliente_nombre || data.cliente_nombre.trim().length < 2) {
    return { ok: false, error: "Nombre de cliente inválido" };
  }

  if (!data.cliente_whatsapp || !validateWhatsApp(data.cliente_whatsapp)) {
    return { ok: false, error: "WhatsApp inválido (10 a 15 dígitos)" };
  }

  if (data.cliente_email && !validateEmail(data.cliente_email)) {
    return { ok: false, error: "Email inválido" };
  }

  if (!Array.isArray(data.items) || data.items.length === 0) {
    return { ok: false, error: "El pedido debe incluir al menos un ítem" };
  }

  for (const item of data.items) {
    if (!item.producto_id || typeof item.producto_id !== "string") {
      return { ok: false, error: "producto_id es obligatorio" };
    }
    if (!Number.isFinite(item.cantidad) || item.cantidad <= 0 || item.cantidad > 1000) {
      return { ok: false, error: "Cantidad inválida (1-1000)" };
    }
    if (!Number.isFinite(item.precio_unitario) || item.precio_unitario <= 0 || item.precio_unitario > 10000000) {
      return { ok: false, error: "Precio inválido (1-10.000.000)" };
    }
  }

  return {
    ok: true,
    data: {
      cliente_nombre: data.cliente_nombre.trim(),
      cliente_whatsapp: data.cliente_whatsapp.trim(),
      cliente_email: data.cliente_email?.trim() || undefined,
      canal: data.canal?.trim() || "whatsapp",
      items: data.items,
      metodo_pago: data.metodo_pago?.trim() || undefined,
      notas_cliente: data.notas_cliente?.trim() || undefined,
      descripcion_bot: data.descripcion_bot?.trim() || undefined,
      estado_inicial: data.estado_inicial?.trim() || "pendiente_confirmacion",
    },
  };
}
