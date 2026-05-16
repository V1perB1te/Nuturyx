drop function if exists public.ajustar_stock_manual(uuid, integer, text, numeric);

create or replace function public.ajustar_stock_manual(
  p_producto_id uuid,
  p_cantidad integer,
  p_motivo text default 'ajuste_manual',
  p_costo_unitario numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_stock_actual integer;
  v_precio_costo_actual numeric(12,2);
  v_nuevo_stock integer;
  v_nuevo_costo_promedio numeric(12,2);
  v_tipo_movimiento public.movimiento_tipo;
begin
  if not public.is_admin() then
    raise exception 'Solo admin puede ajustar stock';
  end if;

  if p_cantidad = 0 then
    raise exception 'La cantidad de ajuste no puede ser 0';
  end if;

  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'El motivo del ajuste es obligatorio';
  end if;

  select stock_actual, precio_costo
  into v_stock_actual, v_precio_costo_actual
  from public.productos
  where id = p_producto_id
  for update;

  if not found then
    raise exception 'Producto no encontrado';
  end if;

  if v_stock_actual + p_cantidad < 0 then
    raise exception 'Stock insuficiente para aplicar ajuste';
  end if;

  v_tipo_movimiento := case
    when p_cantidad > 0 then 'entrada'::public.movimiento_tipo
    else 'salida'::public.movimiento_tipo
  end;

  if p_cantidad > 0 and coalesce(p_costo_unitario, 0) > 0 then
    v_nuevo_stock := v_stock_actual + p_cantidad;
    v_nuevo_costo_promedio :=
      ((v_stock_actual * coalesce(v_precio_costo_actual, 0)) + (p_cantidad * p_costo_unitario)) / v_nuevo_stock;

    update public.productos
    set
      stock_actual = v_nuevo_stock,
      precio_costo = round(v_nuevo_costo_promedio, 2)
    where id = p_producto_id;
  else
    update public.productos
    set stock_actual = stock_actual + p_cantidad
    where id = p_producto_id;
  end if;

  insert into public.movimientos_stock (
    producto_id,
    tipo,
    cantidad,
    motivo,
    usuario_id,
    costo_unitario
  )
  values (
    p_producto_id,
    v_tipo_movimiento,
    abs(p_cantidad),
    trim(p_motivo),
    v_user_id,
    case
      when p_cantidad > 0 and coalesce(p_costo_unitario, 0) > 0 then p_costo_unitario
      when p_cantidad < 0 then nullif(v_precio_costo_actual, 0)
      else p_costo_unitario
    end
  );
end;
$$;

grant execute on function public.ajustar_stock_manual(uuid, integer, text, numeric) to authenticated;
