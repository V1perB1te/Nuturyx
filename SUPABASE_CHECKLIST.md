# Checklist de despliegue Supabase — Nuturyx

## 1) Variables de entorno locales
1. Copia `.env.example` a `.env.local`.
2. Completa:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (solo server-side)

## 2) Ejecutar migraciones SQL (en este orden)
Ejecuta cada archivo en SQL Editor de Supabase (una por una, validando que termine sin error):

1. `supabase/migrations/20260429_001_init.sql`
2. `supabase/migrations/20260430_002_clientes_campos.sql`
3. `supabase/migrations/20260430_003_precio_costo_kardex.sql`
4. `supabase/migrations/20260430_004_negocio.sql`
5. `supabase/migrations/20260430_005_usuarios_email.sql`
6. `supabase/migrations/20260430_006_anular_factura.sql`
7. `supabase/migrations/20260501_007_negocio_email_mensajes.sql`
8. `supabase/migrations/20260502_008_realtime_facturas.sql`
9. `supabase/migrations/20260503_009_puede_crear_productos.sql`
10. `supabase/migrations/20260516_010_kardex_costo_promedio.sql`
11. `supabase/migrations/20260516_011_api_multicanal.sql`

## 3) Validaciones rápidas de base de datos
En SQL Editor, ejecuta estas consultas:

```sql
-- Tablas clave
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'usuarios','productos','clientes','facturas','items_factura','movimientos_stock'
  )
order by table_name;

-- RLS activo
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'usuarios','productos','clientes','facturas','items_factura','movimientos_stock'
  )
order by tablename;

-- RPC disponibles
select proname
from pg_proc
join pg_namespace n on n.oid = pg_proc.pronamespace
where n.nspname = 'public'
  and proname in (
    'current_user_role','is_admin','ajustar_stock_manual',
    'confirmar_factura','marcar_factura_impresa','anular_factura'
  )
order by proname;
```

## 4) Crear usuario admin inicial
1. Crea un usuario en `Authentication > Users` (email + password).
2. Obtén su `id` (UUID) y ejecuta:

```sql
update public.usuarios
set rol = 'admin', activo = true
where id = 'UUID_DEL_USUARIO';
```

## 5) Smoke test funcional (manual)
1. Inicia app: `npm run dev`.
2. Login con usuario admin.
3. Crea 1 producto con costo y precio.
4. Registra una entrada por kardex con costo distinto.
5. Verifica en inventario/kardex que el costo promedio se recalcula.
6. Crea factura y confirma salida de stock.
7. Revisa historial y detalle.
8. En `/imprimir`, imprime y valida cambio de estado a `impresa`.

## 6) Realtime para impresión
Si no llegan pendientes en tiempo real:
- Verifica que la migración `20260502_008_realtime_facturas.sql` se ejecutó correctamente.
- Revisa que la tabla `facturas` esté en publicación de realtime (`supabase_realtime`).

## 7) Seguridad mínima antes de producción
- No exponer `SUPABASE_SERVICE_ROLE_KEY` en cliente.
- Mantener RLS habilitado en tablas de negocio.
- Evitar inserts/updates directos sensibles fuera de RPC.
- Rotar credenciales si se compartieron accidentalmente.
