import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-errors";
import { authenticateApiRequest } from "@/lib/auth";
import {
  cambiarEstadoPedido,
  confirmarPedido,
  crearPedido,
  getPedidoFactura,
  getProductoDetalle,
  listProductos,
  listarPedidos,
  reporteGanancias,
} from "@/lib/comercial-service";

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function handleGetProductos(request: NextRequest) {
  const auth = await authenticateApiRequest(request, { allowBot: true });
  if (!auth.ok) return apiError(auth.status, auth.error);

  try {
    const url = new URL(request.url);
    const activos = (url.searchParams.get("activos") ?? "true") !== "false";
    const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") ?? "100"), 200));
    const page = Math.max(1, Number(url.searchParams.get("pagina") ?? "1"));
    const data = await listProductos({ activos, limit, page });
    return apiOk(data);
  } catch (error) {
    return apiError(500, "Error consultando productos", String(error));
  }
}

export async function handleGetProductoDetalle(request: NextRequest, productoId: string) {
  const auth = await authenticateApiRequest(request, { allowBot: true });
  if (!auth.ok) return apiError(auth.status, auth.error);

  const data = await getProductoDetalle(productoId);
  if (!data) return apiError(404, "Producto no encontrado");
  return apiOk(data);
}

export async function handlePostPedido(request: NextRequest) {
  const auth = await authenticateApiRequest(request, { allowBot: true });
  if (!auth.ok) return apiError(auth.status, auth.error);

  const payload = await request.json();
  const result = await crearPedido(payload);
  if (!result.ok) return apiError(result.status, result.error);
  return apiOk(result.data, result.status);
}

export async function handleGetPedidos(request: NextRequest) {
  const auth = await authenticateApiRequest(request, { requireAdmin: true });
  if (!auth.ok) return apiError(auth.status, auth.error);

  try {
    const url = new URL(request.url);
    const data = await listarPedidos({
      canal: url.searchParams.get("canal") ?? undefined,
      estado: url.searchParams.get("estado") ?? undefined,
      fechaDesde: url.searchParams.get("fecha_desde") ?? undefined,
      fechaHasta: url.searchParams.get("fecha_hasta") ?? undefined,
    });
    return apiOk(data);
  } catch (error) {
    return apiError(500, "Error listando pedidos", String(error));
  }
}

export async function handlePutConfirmarPedido(request: NextRequest, pedidoIdRaw: string) {
  const auth = await authenticateApiRequest(request, { requireAdmin: true });
  if (!auth.ok) return apiError(auth.status, auth.error);
  if (auth.kind !== "user") return apiError(403, "Permisos insuficientes");

  const pedidoId = parseId(pedidoIdRaw);
  if (!pedidoId) return apiError(400, "ID de pedido inválido");

  const body = (await request.json()) as { imprimirFactura?: boolean; observaciones?: string };
  const result = await confirmarPedido({
    pedidoId,
    adminUserId: auth.userId,
    imprimirFactura: Boolean(body.imprimirFactura),
    observaciones: body.observaciones,
  });

  if (!result.ok) return apiError(result.status, result.error);
  return apiOk(result.data);
}

export async function handlePutEstadoPedido(request: NextRequest, pedidoIdRaw: string) {
  const auth = await authenticateApiRequest(request, { requireAdmin: true });
  if (!auth.ok) return apiError(auth.status, auth.error);
  if (auth.kind !== "user") return apiError(403, "Permisos insuficientes");

  const pedidoId = parseId(pedidoIdRaw);
  if (!pedidoId) return apiError(400, "ID de pedido inválido");

  const body = (await request.json()) as { nuevo_estado?: string; razon?: string };
  if (!body.nuevo_estado) return apiError(400, "nuevo_estado es obligatorio");

  const result = await cambiarEstadoPedido({
    pedidoId,
    nuevoEstado: body.nuevo_estado,
    adminUserId: auth.userId,
    razon: body.razon,
  });

  if (!result.ok) return apiError(result.status, result.error);
  return apiOk(result.data);
}

export async function handleGetPedidoFactura(request: NextRequest, pedidoIdRaw: string) {
  const auth = await authenticateApiRequest(request, { requireAdmin: true });
  if (!auth.ok) return apiError(auth.status, auth.error);

  const pedidoId = parseId(pedidoIdRaw);
  if (!pedidoId) return apiError(400, "ID de pedido inválido");

  const data = await getPedidoFactura(pedidoId);
  if (!data) return apiError(404, "Factura no encontrada para el pedido");
  return apiOk(data);
}

export async function handleGetGanancias(request: NextRequest) {
  const auth = await authenticateApiRequest(request, { requireAdmin: true });
  if (!auth.ok) return apiError(auth.status, auth.error);

  try {
    const url = new URL(request.url);
    const data = await reporteGanancias({
      fechaDesde: url.searchParams.get("fecha_desde") ?? undefined,
      fechaHasta: url.searchParams.get("fecha_hasta") ?? undefined,
    });
    return apiOk(data);
  } catch (error) {
    return apiError(500, "Error generando reporte", String(error));
  }
}
