import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateCrearPedidoPayload } from "@/lib/validators";

type DbClient = SupabaseClient;

type PedidoEstado =
  | "pendiente_confirmacion"
  | "confirmado"
  | "empacado"
  | "enviado"
  | "entregado"
  | "cancelado";

const ESTADOS_PEDIDO: PedidoEstado[] = [
  "pendiente_confirmacion",
  "confirmado",
  "empacado",
  "enviado",
  "entregado",
  "cancelado",
];

export function createAdminDbClient(): DbClient {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { get: () => undefined, set: () => {}, remove: () => {} },
    },
  );
}

function toMoney(value: number) {
  return Math.round(value * 100) / 100;
}

async function getProductoById(db: DbClient, id: string) {
  const { data, error } = await db
    .from("productos")
    .select("id,nombre,sku_code,descripcion,descripcion_larga,imagen_url,categoria,beneficios,ingredientes,modo_uso,sabores,presentacion,precio_venta,precio_costo,stock_actual,activo")
    .eq("id", id)
    .single();

  if (error) return null;
  return data;
}

export async function listProductos(query: { activos: boolean; limit: number; page: number }) {
  const db = createAdminDbClient();
  const from = (query.page - 1) * query.limit;
  const to = from + query.limit - 1;

  let req = db
    .from("productos")
    .select(
      "id,nombre,descripcion,imagen_url,precio_venta,precio_costo,stock_actual,categoria,beneficios,activo",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (query.activos) {
    req = req.eq("activo", true);
  }

  const { data, error, count } = await req;
  if (error) throw new Error(error.message);

  const productos = (data ?? []).map((p) => {
    const precio = Number(p.precio_venta ?? 0);
    const costo = Number(p.precio_costo ?? 0);
    const ganancia = toMoney(precio - costo);
    return {
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion,
      imagen_url: p.imagen_url,
      precio,
      costo_unitario: costo,
      stock: Number(p.stock_actual ?? 0),
      ganancia_unitaria: ganancia,
      ganancia_porcentaje: costo > 0 ? toMoney((ganancia / costo) * 100) : 0,
      categoria: p.categoria,
      beneficios: p.beneficios ?? [],
      activo: p.activo,
    };
  });

  return {
    productos,
    total: count ?? productos.length,
    pagina: query.page,
  };
}

export async function getProductoDetalle(id: string) {
  const db = createAdminDbClient();
  const producto = await getProductoById(db, id);
  if (!producto) return null;

  const precio = Number(producto.precio_venta ?? 0);
  const costo = Number(producto.precio_costo ?? 0);
  const ganancia = toMoney(precio - costo);

  return {
    producto: {
      id: producto.id,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      descripcion_larga: producto.descripcion_larga,
      beneficios: producto.beneficios ?? [],
      ingredientes: producto.ingredientes,
      modo_uso: producto.modo_uso,
      stock: Number(producto.stock_actual ?? 0),
      precio,
      costo_unitario: costo,
      ganancia_unitaria: ganancia,
      imagen_url: producto.imagen_url,
      categoria: producto.categoria,
      sabores: producto.sabores ?? [],
      presentacion: producto.presentacion,
    },
  };
}

export async function crearPedido(payload: unknown) {
  const parsed = validateCrearPedidoPayload(payload);
  if (!parsed.ok) {
    return { ok: false as const, status: 400, error: parsed.error };
  }

  const db = createAdminDbClient();
  const data = parsed.data;

  let totalVenta = 0;
  let costoTotal = 0;
  const normalizedItems: Array<{
    producto_id: string;
    nombre: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    costo_unitario: number;
  }> = [];

  for (const item of data.items) {
    const producto = await getProductoById(db, item.producto_id);
    if (!producto || !producto.activo) {
      return { ok: false as const, status: 404, error: `Producto no encontrado: ${item.producto_id}` };
    }

    if (Number(producto.stock_actual) < item.cantidad) {
      return {
        ok: false as const,
        status: 400,
        error: `Stock insuficiente para ${producto.nombre}`,
      };
    }

    const precioUnit = Number(item.precio_unitario);
    const costoUnit = Number(item.costo_unitario ?? producto.precio_costo ?? 0);
    const subtotal = toMoney(precioUnit * item.cantidad);

    totalVenta = toMoney(totalVenta + subtotal);
    costoTotal = toMoney(costoTotal + toMoney(costoUnit * item.cantidad));

    normalizedItems.push({
      producto_id: producto.id,
      nombre: item.nombre || producto.nombre,
      cantidad: item.cantidad,
      precio_unitario: precioUnit,
      subtotal,
      costo_unitario: costoUnit,
    });
  }

  const gananciaBruta = toMoney(totalVenta - costoTotal);
  const gananciaNeta = toMoney(gananciaBruta);

  const { data: numeroData, error: seqError } = await db.rpc("generar_numero_pedido_whatsapp");
  if (seqError) {
    return { ok: false as const, status: 500, error: seqError.message };
  }

  const numeroPedido = String(numeroData);

  const { data: pedido, error: pedidoError } = await db
    .from("pedidos_whatsapp")
    .insert({
      numero_pedido: numeroPedido,
      cliente_nombre: data.cliente_nombre,
      cliente_whatsapp: data.cliente_whatsapp,
      cliente_email: data.cliente_email ?? null,
      canal: data.canal,
      items: normalizedItems,
      total_venta: totalVenta,
      costo_total: costoTotal,
      ganancia_bruta: gananciaBruta,
      ganancia_neta: gananciaNeta,
      metodo_pago: data.metodo_pago ?? null,
      notas_cliente: data.notas_cliente ?? null,
      descripcion_bot: data.descripcion_bot ?? null,
      estado: "pendiente_confirmacion",
      creado_por: "bot_whatsapp",
    })
    .select("*")
    .single();

  if (pedidoError || !pedido) {
    return { ok: false as const, status: 500, error: pedidoError?.message ?? "No se pudo crear pedido" };
  }

  await db.from("bot_interacciones").insert({
    cliente_whatsapp: data.cliente_whatsapp,
    pedido_id: pedido.id,
    tipo: "confirmacion",
    contenido: data.descripcion_bot ?? "Pedido confirmado por bot",
    respuesta_cliente: data.notas_cliente ?? null,
  });

  await db.from("pedidos_whatsapp_log").insert({
    pedido_id: pedido.id,
    estado_anterior: null,
    estado_nuevo: "pendiente_confirmacion",
    cambio_por: "bot_whatsapp",
    razon: "Creación inicial de pedido",
  });

  return {
    ok: true as const,
    status: 201,
    data: {
      exito: true,
      pedido: {
        id: pedido.id,
        numero_pedido: pedido.numero_pedido,
        cliente_nombre: pedido.cliente_nombre,
        cliente_whatsapp: pedido.cliente_whatsapp,
        items: pedido.items,
        total_venta: Number(pedido.total_venta),
        costo_total: Number(pedido.costo_total),
        ganancia_bruta: Number(pedido.ganancia_bruta),
        ganancia_neta: Number(pedido.ganancia_neta),
        estado: pedido.estado,
        confirmado_en: pedido.confirmado_en,
        confirmado_por: pedido.confirmado_por,
        impreso: pedido.impreso,
        creado_en: pedido.creado_en,
      },
      mensaje: "Pedido creado. Pendiente confirmación manual desde admin.",
    },
  };
}

function ensureEstadoValido(estado: string): estado is PedidoEstado {
  return ESTADOS_PEDIDO.includes(estado as PedidoEstado);
}

export async function confirmarPedido(params: { pedidoId: number; adminUserId: string; imprimirFactura: boolean; observaciones?: string }) {
  const db = createAdminDbClient();

  const { data: pedido, error: pedidoError } = await db
    .from("pedidos_whatsapp")
    .select("*")
    .eq("id", params.pedidoId)
    .single();

  if (pedidoError || !pedido) {
    return { ok: false as const, status: 404, error: "Pedido no encontrado" };
  }

  if (pedido.estado !== "pendiente_confirmacion") {
    return { ok: false as const, status: 409, error: "El pedido ya fue procesado" };
  }

  const items = (pedido.items as Array<{ producto_id: string; cantidad: number; precio_unitario: number; costo_unitario?: number; subtotal?: number }>);

  for (const item of items) {
    const producto = await getProductoById(db, item.producto_id);
    if (!producto) {
      return { ok: false as const, status: 404, error: `Producto no encontrado: ${item.producto_id}` };
    }
    if (Number(producto.stock_actual) < Number(item.cantidad)) {
      return { ok: false as const, status: 400, error: `Stock insuficiente para ${producto.nombre}` };
    }
  }

  const clientePayload = {
    nombre: pedido.cliente_nombre,
    identificacion: pedido.cliente_whatsapp,
    telefono: pedido.cliente_whatsapp,
    direccion: pedido.notas_cliente ?? null,
    email: pedido.cliente_email ?? null,
  };

  const invoicePayload = {
    cliente: clientePayload,
    items: items.map((item) => ({
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      descuento_item: 0,
      tipo_descuento_item: "valor",
    })),
    descuento_global_tipo: "valor",
    descuento_global_valor: 0,
    guardar_sin_imprimir: !params.imprimirFactura,
  };

  const { data: facturaResp, error: facturaError } = await db.rpc("confirmar_factura", { payload: invoicePayload });

  if (facturaError || !facturaResp) {
    return { ok: false as const, status: 500, error: facturaError?.message ?? "No fue posible generar factura" };
  }

  const facturaId = facturaResp.id as string;
  const numeroFactura = Number(facturaResp.numero_factura ?? 0);

  const { error: updateError } = await db
    .from("pedidos_whatsapp")
    .update({
      estado: "confirmado",
      confirmado_por: params.adminUserId,
      confirmado_en: new Date().toISOString(),
      factura_id: facturaId,
      factura_numero: numeroFactura,
      impreso: false,
      impreso_en: null,
    })
    .eq("id", params.pedidoId);

  if (updateError) {
    return { ok: false as const, status: 500, error: updateError.message };
  }

  await db.from("pedidos_whatsapp_log").insert({
    pedido_id: params.pedidoId,
    estado_anterior: "pendiente_confirmacion",
    estado_nuevo: "confirmado",
    cambio_por: params.adminUserId,
    razon: params.observaciones ?? "Confirmación manual desde admin",
  });

  return {
    ok: true as const,
    status: 200,
    data: {
      exito: true,
      pedido: {
        id: pedido.id,
        numero_pedido: pedido.numero_pedido,
        estado: "confirmado",
        confirmado_por: params.adminUserId,
        confirmado_en: new Date().toISOString(),
        factura_numero: numeroFactura,
        factura_creada: true,
        factura_url: `/api/comercial/pedidos/${pedido.id}/factura`,
        stock_descontado: true,
        kardex_creado: true,
        imprimible: true,
      },
      mensaje: "Venta confirmada. Stock descontado. Factura lista para imprimir.",
    },
  };
}

export async function cambiarEstadoPedido(params: { pedidoId: number; nuevoEstado: string; adminUserId: string; razon?: string }) {
  if (!ensureEstadoValido(params.nuevoEstado)) {
    return { ok: false as const, status: 400, error: "Estado inválido" };
  }

  const db = createAdminDbClient();
  const { data: pedido, error } = await db
    .from("pedidos_whatsapp")
    .select("id,estado")
    .eq("id", params.pedidoId)
    .single();

  if (error || !pedido) {
    return { ok: false as const, status: 404, error: "Pedido no encontrado" };
  }

  const { error: updateError } = await db
    .from("pedidos_whatsapp")
    .update({ estado: params.nuevoEstado })
    .eq("id", params.pedidoId);

  if (updateError) {
    return { ok: false as const, status: 500, error: updateError.message };
  }

  await db.from("pedidos_whatsapp_log").insert({
    pedido_id: params.pedidoId,
    estado_anterior: pedido.estado,
    estado_nuevo: params.nuevoEstado,
    cambio_por: params.adminUserId,
    razon: params.razon ?? null,
  });

  return {
    ok: true as const,
    status: 200,
    data: {
      exito: true,
      pedido: {
        id: params.pedidoId,
        estado: params.nuevoEstado,
      },
    },
  };
}

export async function getPedidoFactura(pedidoId: number) {
  const db = createAdminDbClient();
  const { data: pedido, error } = await db
    .from("pedidos_whatsapp")
    .select("*")
    .eq("id", pedidoId)
    .single();

  if (error || !pedido) return null;
  if (!pedido.factura_id) return null;

  const { data: factura } = await db
    .from("facturas")
    .select("id,numero_factura,total,estado,created_at,cliente:clientes(nombre,telefono,email),items:items_factura(cantidad,precio_unitario,subtotal_item,producto:productos(nombre))")
    .eq("id", pedido.factura_id)
    .single();

  if (!factura) return null;

  return {
    numero_factura: `FAC-${factura.numero_factura}`,
    numero_pedido: pedido.numero_pedido,
    canal: pedido.canal,
    cliente: {
      nombre: pedido.cliente_nombre,
      whatsapp: pedido.cliente_whatsapp,
      email: pedido.cliente_email,
    },
    items: (factura.items ?? []).map(
      (item: { producto: Array<{ nombre: string }>; cantidad: number; precio_unitario: number; subtotal_item: number }) => ({
        nombre: item.producto?.[0]?.nombre ?? "Producto",
        cantidad: item.cantidad,
        precio_unitario: Number(item.precio_unitario),
        subtotal: Number(item.subtotal_item),
      }),
    ),
    total_venta: Number(pedido.total_venta),
    costo_total: Number(pedido.costo_total),
    ganancia: Number(pedido.ganancia_neta),
    metodo_pago: pedido.metodo_pago,
    estado: pedido.estado,
    fecha: pedido.creado_en,
    creado_por: pedido.confirmado_por,
  };
}

export async function listarPedidos(params: { estado?: string; fechaDesde?: string; fechaHasta?: string; canal?: string }) {
  const db = createAdminDbClient();
  let req = db
    .from("pedidos_whatsapp")
    .select("id,numero_pedido,cliente_nombre,cliente_whatsapp,total_venta,ganancia_neta,estado,confirmado_por,impreso,creado_en", { count: "exact" })
    .order("creado_en", { ascending: false });

  if (params.estado) req = req.eq("estado", params.estado);
  if (params.canal) req = req.eq("canal", params.canal);
  if (params.fechaDesde) req = req.gte("creado_en", `${params.fechaDesde}T00:00:00`);
  if (params.fechaHasta) req = req.lte("creado_en", `${params.fechaHasta}T23:59:59`);

  const { data, error, count } = await req;
  if (error) throw new Error(error.message);

  const { data: porEstadoData } = await db
    .from("pedidos_whatsapp")
    .select("estado");

  const porEstado = (porEstadoData ?? []).reduce<Record<string, number>>((acc, row: { estado: string }) => {
    acc[row.estado] = (acc[row.estado] ?? 0) + 1;
    return acc;
  }, {});

  return {
    pedidos: (data ?? []).map((p) => ({
      ...p,
      total_venta: Number(p.total_venta),
      ganancia_neta: Number(p.ganancia_neta),
      confirmado: Boolean(p.confirmado_por),
    })),
    total: count ?? 0,
    por_estado: porEstado,
  };
}

export async function reporteGanancias(params: { fechaDesde?: string; fechaHasta?: string }) {
  const db = createAdminDbClient();
  let req = db
    .from("pedidos_whatsapp")
    .select("total_venta,costo_total,ganancia_bruta,ganancia_neta,comisiones,canal");

  if (params.fechaDesde) req = req.gte("creado_en", `${params.fechaDesde}T00:00:00`);
  if (params.fechaHasta) req = req.lte("creado_en", `${params.fechaHasta}T23:59:59`);

  const { data, error } = await req;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const resumen = rows.reduce(
    (acc, row) => {
      acc.total_ventas += Number(row.total_venta ?? 0);
      acc.total_costo += Number(row.costo_total ?? 0);
      acc.ganancia_bruta += Number(row.ganancia_bruta ?? 0);
      acc.comisiones += Number(row.comisiones ?? 0);
      acc.ganancia_neta += Number(row.ganancia_neta ?? 0);
      acc.cantidad_pedidos += 1;
      return acc;
    },
    {
      total_ventas: 0,
      total_costo: 0,
      ganancia_bruta: 0,
      comisiones: 0,
      ganancia_neta: 0,
      cantidad_pedidos: 0,
    },
  );

  return {
    periodo: {
      desde: params.fechaDesde ?? null,
      hasta: params.fechaHasta ?? null,
    },
    resumen,
    por_canal: {
      whatsapp: {
        ventas: resumen.total_ventas,
        comisiones: resumen.comisiones,
        ganancia_neta: resumen.ganancia_neta,
        cantidad: resumen.cantidad_pedidos,
      },
      shopify: {
        ventas: 0,
        comisiones: 0,
        ganancia_neta: 0,
        cantidad: 0,
      },
    },
    ahorro_comisiones: 0,
  };
}
