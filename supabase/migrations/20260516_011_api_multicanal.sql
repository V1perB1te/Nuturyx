alter table public.productos
  add column if not exists descripcion text,
  add column if not exists descripcion_larga text,
  add column if not exists imagen_url text,
  add column if not exists categoria text,
  add column if not exists beneficios text[] not null default '{}',
  add column if not exists ingredientes text,
  add column if not exists modo_uso text,
  add column if not exists sabores text[] not null default '{}',
  add column if not exists presentacion text;

create table if not exists public.pedidos_whatsapp (
  id bigserial primary key,
  numero_pedido text unique,
  cliente_nombre text not null,
  cliente_whatsapp text not null,
  cliente_email text,
  canal text not null default 'whatsapp',
  items jsonb not null,
  total_venta numeric(12,2) not null check (total_venta >= 0),
  costo_total numeric(12,2) not null default 0 check (costo_total >= 0),
  ganancia_bruta numeric(12,2) not null default 0,
  comisiones numeric(12,2) not null default 0 check (comisiones >= 0),
  ganancia_neta numeric(12,2) not null default 0,
  estado text not null default 'pendiente_confirmacion' check (
    estado in ('pendiente_confirmacion', 'confirmado', 'empacado', 'enviado', 'entregado', 'cancelado')
  ),
  confirmado_por uuid references public.usuarios(id),
  confirmado_en timestamptz,
  metodo_pago text,
  pago_confirmado boolean not null default false,
  descripcion_bot text,
  notas_cliente text,
  impreso boolean not null default false,
  impreso_en timestamptz,
  factura_id uuid references public.facturas(id),
  factura_numero bigint,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por text not null default 'bot_whatsapp'
);

create index if not exists idx_pedidos_wa_estado on public.pedidos_whatsapp(estado);
create index if not exists idx_pedidos_wa_cliente on public.pedidos_whatsapp(cliente_whatsapp);
create index if not exists idx_pedidos_wa_confirmado on public.pedidos_whatsapp(confirmado_por);
create index if not exists idx_pedidos_wa_creado_en on public.pedidos_whatsapp(creado_en desc);

create table if not exists public.pedidos_whatsapp_log (
  id bigserial primary key,
  pedido_id bigint not null references public.pedidos_whatsapp(id) on delete cascade,
  estado_anterior text,
  estado_nuevo text not null,
  cambio_por text,
  razon text,
  creado_en timestamptz not null default now()
);

create table if not exists public.bot_interacciones (
  id bigserial primary key,
  cliente_whatsapp text not null,
  pedido_id bigint references public.pedidos_whatsapp(id) on delete set null,
  tipo text,
  contenido text,
  respuesta_cliente text,
  creado_en timestamptz not null default now()
);

create sequence if not exists public.pedidos_whatsapp_numero_seq as bigint start with 1 increment by 1;

create or replace function public.generar_numero_pedido_whatsapp()
returns text
language sql
as $$
  select 'WA-' || lpad(nextval('public.pedidos_whatsapp_numero_seq')::text, 6, '0');
$$;

create or replace function public.tg_set_actualizado_en_pedidos_whatsapp()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists tg_set_actualizado_en_pedidos_whatsapp on public.pedidos_whatsapp;
create trigger tg_set_actualizado_en_pedidos_whatsapp
before update on public.pedidos_whatsapp
for each row
execute function public.tg_set_actualizado_en_pedidos_whatsapp();

alter table public.pedidos_whatsapp enable row level security;
alter table public.pedidos_whatsapp_log enable row level security;
alter table public.bot_interacciones enable row level security;

drop policy if exists pedidos_whatsapp_select_admin on public.pedidos_whatsapp;
create policy pedidos_whatsapp_select_admin on public.pedidos_whatsapp
for select using (public.is_admin());

drop policy if exists pedidos_whatsapp_insert_admin_or_vendedor on public.pedidos_whatsapp;
create policy pedidos_whatsapp_insert_admin_or_vendedor on public.pedidos_whatsapp
for insert with check (public.current_user_role() in ('admin', 'vendedor'));

drop policy if exists pedidos_whatsapp_update_admin on public.pedidos_whatsapp;
create policy pedidos_whatsapp_update_admin on public.pedidos_whatsapp
for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists pedidos_whatsapp_log_select_admin on public.pedidos_whatsapp_log;
create policy pedidos_whatsapp_log_select_admin on public.pedidos_whatsapp_log
for select using (public.is_admin());

drop policy if exists pedidos_whatsapp_log_insert_admin_or_vendedor on public.pedidos_whatsapp_log;
create policy pedidos_whatsapp_log_insert_admin_or_vendedor on public.pedidos_whatsapp_log
for insert with check (public.current_user_role() in ('admin', 'vendedor'));

drop policy if exists bot_interacciones_select_admin on public.bot_interacciones;
create policy bot_interacciones_select_admin on public.bot_interacciones
for select using (public.is_admin());

drop policy if exists bot_interacciones_insert_admin_or_vendedor on public.bot_interacciones;
create policy bot_interacciones_insert_admin_or_vendedor on public.bot_interacciones
for insert with check (public.current_user_role() in ('admin', 'vendedor'));
