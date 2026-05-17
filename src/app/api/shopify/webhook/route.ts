import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { apiError, apiOk } from "@/lib/api-errors";
import { createAdminDbClient, crearPedido } from "@/lib/comercial-service";

type ShopifyLineItem = {
  sku?: string | null;
  quantity?: number;
  price?: string | number | null;
  title?: string | null;
};

type ShopifyOrderPayload = {
  id?: number | string;
  order_number?: number | string;
  name?: string | null;
  email?: string | null;
  financial_status?: string | null;
  phone?: string | null;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  shipping_address?: {
    name?: string | null;
    phone?: string | null;
  } | null;
  billing_address?: {
    phone?: string | null;
  } | null;
  line_items?: ShopifyLineItem[];
};

function normalizeDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

function isValidHmac(rawBody: string, providedHmac: string, secret: string) {
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const digestBuffer = Buffer.from(digest, "utf8");
  const providedBuffer = Buffer.from(providedHmac, "utf8");
  if (digestBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(digestBuffer, providedBuffer);
}

function toDigits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function normalizeWhatsAppPhone(order: ShopifyOrderPayload) {
  const candidates = [order.phone, order.customer?.phone, order.shipping_address?.phone, order.billing_address?.phone];

  for (const candidate of candidates) {
    const digits = toDigits(candidate);
    if (digits.length >= 10 && digits.length <= 15) return digits;
    if (digits.length > 15) return digits.slice(-15);
  }

  const fallback = toDigits(`${order.order_number ?? order.id ?? Date.now()}`).padStart(10, "0");
  return fallback.slice(-10);
}

function normalizeName(order: ShopifyOrderPayload) {
  const fullName = `${(order.customer?.first_name ?? "").trim()} ${(order.customer?.last_name ?? "").trim()}`.trim();
  if (fullName.length >= 2) return fullName;

  const shippingName = (order.shipping_address?.name ?? "").trim();
  if (shippingName.length >= 2) return shippingName;

  return `Cliente Shopify #${order.order_number ?? order.id ?? "s/n"}`;
}

function toPrice(value: string | number | null | undefined) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) / 100 : 0;
}

export async function POST(request: NextRequest) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    return apiError(500, "SHOPIFY_WEBHOOK_SECRET no está configurado");
  }

  const topic = request.headers.get("x-shopify-topic") ?? "";
  if (topic !== "orders/create" && topic !== "orders/paid") {
    return apiOk({ exito: true, ignorado: true, motivo: `topic no soportado: ${topic || "(vacío)"}` });
  }

  const hmacHeader = request.headers.get("x-shopify-hmac-sha256");
  if (!hmacHeader) {
    return apiError(401, "Falta header x-shopify-hmac-sha256");
  }

  const configuredStore = process.env.SHOPIFY_STORE;
  const shopDomain = request.headers.get("x-shopify-shop-domain") ?? "";
  if (configuredStore && normalizeDomain(configuredStore) !== normalizeDomain(shopDomain)) {
    return apiError(401, "Webhook recibido de una tienda no autorizada");
  }

  const rawBody = await request.text();
  if (!isValidHmac(rawBody, hmacHeader, secret)) {
    return apiError(401, "Firma de webhook inválida");
  }

  let order: ShopifyOrderPayload;
  try {
    order = JSON.parse(rawBody) as ShopifyOrderPayload;
  } catch {
    return apiError(400, "Payload JSON inválido");
  }

  const orderId = order.id ? String(order.id) : null;
  if (!orderId) {
    return apiError(400, "El evento no contiene id de orden");
  }

  const db = createAdminDbClient();
  const marker = `shopify_order_id:${orderId}`;

  const { data: existing, error: existingError } = await db
    .from("pedidos_whatsapp")
    .select("id,numero_pedido,estado")
    .eq("canal", "shopify")
    .eq("descripcion_bot", marker)
    .maybeSingle();

  if (existingError) {
    return apiError(500, "Error validando idempotencia", existingError.message);
  }

  if (existing) {
    return apiOk({
      exito: true,
      duplicado: true,
      topic,
      pedido_id: existing.id,
      numero_pedido: existing.numero_pedido,
      estado: existing.estado,
    });
  }

  const lineItems = Array.isArray(order.line_items) ? order.line_items : [];
  if (lineItems.length === 0) {
    return apiError(400, "La orden no contiene line_items");
  }

  const skuList = Array.from(new Set(lineItems.map((item) => (item.sku ?? "").trim()).filter(Boolean)));
  if (skuList.length === 0) {
    return apiError(400, "No se encontraron SKU en la orden de Shopify");
  }

  const { data: productos, error: productosError } = await db
    .from("productos")
    .select("id,nombre,sku_code,precio_venta,precio_costo,activo")
    .in("sku_code", skuList);

  if (productosError) {
    return apiError(500, "Error consultando productos", productosError.message);
  }

  const productoBySku = new Map((productos ?? []).map((p) => [String(p.sku_code).trim().toLowerCase(), p]));

  const missingSkus: string[] = [];
  const items: Array<{
    producto_id: string;
    nombre: string;
    cantidad: number;
    precio_unitario: number;
    costo_unitario: number;
  }> = [];

  for (const item of lineItems) {
    const sku = (item.sku ?? "").trim();
    if (!sku) continue;

    const producto = productoBySku.get(sku.toLowerCase());
    if (!producto) {
      missingSkus.push(sku);
      continue;
    }

    if (!producto.activo) {
      return apiError(409, `Producto inactivo para SKU ${sku}`);
    }

    const quantity = Number(item.quantity ?? 0);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;

    const incomingPrice = toPrice(item.price);
    const fallbackPrice = toPrice(producto.precio_venta);
    const unitPrice = incomingPrice > 0 ? incomingPrice : fallbackPrice;
    if (unitPrice <= 0) {
      return apiError(400, `Precio inválido para SKU ${sku}`);
    }

    items.push({
      producto_id: producto.id,
      nombre: item.title?.trim() || producto.nombre,
      cantidad: quantity,
      precio_unitario: unitPrice,
      costo_unitario: toPrice(producto.precio_costo),
    });
  }

  if (missingSkus.length > 0) {
    return apiError(400, `No existe mapeo local para SKU(s): ${Array.from(new Set(missingSkus)).join(", ")}`);
  }

  if (items.length === 0) {
    return apiError(400, "No hay items válidos para crear pedido");
  }

  const createResult = await crearPedido({
    cliente_nombre: normalizeName(order),
    cliente_whatsapp: normalizeWhatsAppPhone(order),
    cliente_email: (order.email ?? order.customer?.email ?? undefined) ?? undefined,
    canal: "shopify",
    items,
    metodo_pago: order.financial_status ?? undefined,
    notas_cliente: order.name ?? undefined,
    descripcion_bot: marker,
  });

  if (!createResult.ok) {
    return apiError(createResult.status, createResult.error);
  }

  return apiOk(
    {
      exito: true,
      topic,
      shopify_order_id: orderId,
      pedido: createResult.data.pedido,
      mensaje: "Pedido Shopify recibido y registrado en Nuturyx",
    },
    201,
  );
}
