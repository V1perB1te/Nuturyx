-- Seed de simulacion Nuturyx (app actual)
--
-- Objetivo:
-- 1) Configurar usuarios iniciales en public.usuarios (admin + vendedor)
-- 2) Cargar catalogo base de productos para pruebas de inventario/facturacion
-- 3) Cargar clientes de prueba
-- 4) Cargar pedidos_whatsapp de ejemplo (opcionales para pruebas internas)
--
-- IMPORTANTE:
-- Antes de correr este script, crea estos usuarios en Supabase Authentication > Users:
--   - admin@nuturyx.local
--   - vendedor@nuturyx.local
--
-- Puedes asignar cualquier password de pruebas. Este script no crea auth.users,
-- solo actualiza el perfil de negocio en public.usuarios para esos correos.

begin;

do $$
declare
  v_admin_id uuid;
  v_vendedor_id uuid;
begin
  select id into v_admin_id
  from auth.users
  where lower(email) = 'admin@nuturyx.local'
  limit 1;

  select id into v_vendedor_id
  from auth.users
  where lower(email) = 'vendedor@nuturyx.local'
  limit 1;

  if v_admin_id is null then
    raise exception 'Falta usuario auth: admin@nuturyx.local. Crealo en Authentication > Users.';
  end if;

  if v_vendedor_id is null then
    raise exception 'Falta usuario auth: vendedor@nuturyx.local. Crealo en Authentication > Users.';
  end if;

  update public.usuarios
  set
    nombre = 'Administrador Nuturyx',
    email = 'admin@nuturyx.local',
    rol = 'admin',
    activo = true,
    puede_crear_productos = true
  where id = v_admin_id;

  update public.usuarios
  set
    nombre = 'Vendedor Demo',
    email = 'vendedor@nuturyx.local',
    rol = 'vendedor',
    activo = true,
    puede_crear_productos = false
  where id = v_vendedor_id;
end $$;

insert into public.productos (
  nombre,
  sku_code,
  precio_venta,
  precio_costo,
  stock_actual,
  minimo_stock,
  activo,
  descripcion,
  descripcion_larga,
  imagen_url,
  categoria,
  beneficios,
  ingredientes,
  modo_uso,
  sabores,
  presentacion
)
values
  (
    'Proteina Whey 2LB',
    'NUT-WHEY-2LB',
    159900.00,
    102000.00,
    18,
    5,
    true,
    'Proteina de suero para recuperacion muscular',
    'Suplemento alto en proteina para apoyo de hipertrofia y recuperacion post-entreno.',
    null,
    'Suplementos',
    array['Recuperacion muscular', 'Alto aporte proteico', 'Facil digestion'],
    'Proteina de suero, enzimas digestivas, sabor natural',
    'Mezclar 1 scoop en 250ml de agua o leche despues de entrenar.',
    array['Vainilla', 'Chocolate'],
    'Bolsa 2LB'
  ),
  (
    'Creatina Monohidratada 300g',
    'NUT-CREA-300',
    89900.00,
    56000.00,
    32,
    8,
    true,
    'Creatina micronizada de alta pureza',
    'Ayuda a mejorar rendimiento en ejercicios de alta intensidad y fuerza.',
    null,
    'Suplementos',
    array['Mas fuerza', 'Mejor rendimiento', 'Sin azucar'],
    'Creatina monohidratada micronizada',
    'Consumir 5g al dia con agua.',
    array['Neutro'],
    'Tarro 300g'
  ),
  (
    'Omega 3 Premium',
    'NUT-OMEGA3-120',
    74900.00,
    44000.00,
    26,
    6,
    true,
    'Acidos grasos esenciales EPA y DHA',
    'Apoyo cardiovascular y cognitivo para uso diario.',
    null,
    'Bienestar',
    array['Salud cardiovascular', 'Funcion cognitiva', 'Antiinflamatorio'],
    'Aceite de pescado purificado (EPA/DHA)',
    'Tomar 2 capsulas al dia con comidas.',
    array['Sin sabor'],
    'Frasco x 120 capsulas'
  ),
  (
    'Preworkout Focus 30 servicios',
    'NUT-PRE-30',
    119900.00,
    77000.00,
    14,
    4,
    true,
    'Pre-entreno para energia y enfoque',
    'Formula preworkout para sesiones intensas con foco y resistencia.',
    null,
    'Rendimiento',
    array['Energia', 'Enfoque', 'Resistencia'],
    'Cafeina, beta alanina, citrulina, vitaminas del complejo B',
    'Tomar 1 porcion 20-30 min antes de entrenar.',
    array['Frutos rojos', 'Limon'],
    'Tarro 30 servicios'
  ),
  (
    'Shaker 700ml',
    'NUT-SHAKER-700',
    29900.00,
    12000.00,
    40,
    10,
    true,
    'Shaker para preparacion de suplementos',
    'Botella mezcladora con tapa hermetica y rejilla anti grumos.',
    null,
    'Accesorios',
    array['Practico', 'Resistente', 'Portatil'],
    'Plastico libre de BPA',
    'Lavar antes del primer uso.',
    array['Negro', 'Transparente'],
    'Unidad 700ml'
  )
on conflict (sku_code) do update
set
  nombre = excluded.nombre,
  precio_venta = excluded.precio_venta,
  precio_costo = excluded.precio_costo,
  stock_actual = excluded.stock_actual,
  minimo_stock = excluded.minimo_stock,
  activo = excluded.activo,
  descripcion = excluded.descripcion,
  descripcion_larga = excluded.descripcion_larga,
  imagen_url = excluded.imagen_url,
  categoria = excluded.categoria,
  beneficios = excluded.beneficios,
  ingredientes = excluded.ingredientes,
  modo_uso = excluded.modo_uso,
  sabores = excluded.sabores,
  presentacion = excluded.presentacion;

insert into public.clientes (nombre, identificacion, nit, email, telefono, direccion)
select v.nombre, v.identificacion, v.nit, v.email, v.telefono, v.direccion
from (
  values
    ('Cliente Mostrador', '22222', null, null, '3000000000', 'Venta en punto fisico'),
    ('Ana Gomez', 'CC-100245', null, 'ana.gomez@example.com', '3001112233', 'Calle 10 # 20-30'),
    ('Carlos Perez', 'CC-100246', null, 'carlos.perez@example.com', '3004445566', 'Carrera 45 # 12-08'),
    ('Gym Power SAS', 'NIT-900123456', '900123456-1', 'compras@gympower.co', '6012457788', 'Zona Industrial Bodega 7')
) as v(nombre, identificacion, nit, email, telefono, direccion)
where not exists (
  select 1
  from public.clientes c
  where c.identificacion = v.identificacion
);

insert into public.pedidos_whatsapp (
  numero_pedido,
  cliente_nombre,
  cliente_whatsapp,
  cliente_email,
  canal,
  items,
  total_venta,
  costo_total,
  ganancia_bruta,
  comisiones,
  ganancia_neta,
  estado,
  descripcion_bot,
  notas_cliente,
  creado_por
)
select
  public.generar_numero_pedido_whatsapp(),
  'Ana Gomez',
  '573001112233',
  'ana.gomez@example.com',
  'whatsapp',
  jsonb_build_array(
    jsonb_build_object(
      'producto_id', p.id,
      'nombre', p.nombre,
      'cantidad', 1,
      'precio_unitario', p.precio_venta,
      'subtotal', p.precio_venta
    )
  ),
  p.precio_venta,
  p.precio_costo,
  p.precio_venta - p.precio_costo,
  0,
  p.precio_venta - p.precio_costo,
  'pendiente_confirmacion',
  'Pedido de prueba para validacion API multicanal',
  'Seed demo',
  'bot_whatsapp'
from public.productos p
where p.sku_code = 'NUT-WHEY-2LB'
  and not exists (
    select 1
    from public.pedidos_whatsapp pw
    where pw.cliente_whatsapp = '573001112233'
      and pw.notas_cliente = 'Seed demo'
  );

insert into public.pedidos_whatsapp_log (
  pedido_id,
  estado_anterior,
  estado_nuevo,
  cambio_por,
  razon
)
select
  pw.id,
  null,
  'pendiente_confirmacion',
  'bot_whatsapp',
  'Creado por seed de simulacion'
from public.pedidos_whatsapp pw
where pw.cliente_whatsapp = '573001112233'
  and pw.notas_cliente = 'Seed demo'
  and not exists (
    select 1
    from public.pedidos_whatsapp_log l
    where l.pedido_id = pw.id
      and l.estado_nuevo = 'pendiente_confirmacion'
      and l.razon = 'Creado por seed de simulacion'
  );

insert into public.bot_interacciones (
  cliente_whatsapp,
  pedido_id,
  tipo,
  contenido,
  respuesta_cliente
)
select
  pw.cliente_whatsapp,
  pw.id,
  'pedido',
  'Cliente solicita informacion y confirma pedido de prueba',
  'OK, deseo continuar con el pedido'
from public.pedidos_whatsapp pw
where pw.cliente_whatsapp = '573001112233'
  and pw.notas_cliente = 'Seed demo'
  and not exists (
    select 1
    from public.bot_interacciones bi
    where bi.pedido_id = pw.id
      and bi.tipo = 'pedido'
      and bi.contenido = 'Cliente solicita informacion y confirma pedido de prueba'
  );

commit;
