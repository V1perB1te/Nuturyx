# Shopify Fase 2 — Estrategia de integración bidireccional (Nuturyx)

## Estado actual
- **No está implementada aún la Fase 2** de Shopify en el código actual.
- El MVP sí dejó la base lista: inventario, kardex, costo promedio y facturación.

## Objetivo Fase 2
Mantener sincronizados entre Nuturyx y Shopify:
1. Catálogo (producto/variante SKU)
2. Inventario (entradas/salidas/ajustes)
3. Costo unitario promedio (cost per item)
4. Ventas de Shopify para reflejarlas en kardex y márgenes

## Conexiones recomendadas (para plan Basic)
Para tu escenario (una tienda, permisos altos), usar combinación:

1. **Shopify Admin GraphQL API** (principal)
   - Mejor para operaciones modernas y consistentes.
   - Ideal para leer/escribir productos, variantes, inventory levels y costo.

2. **Webhooks de Shopify** (obligatorio para near real-time)
   - `orders/paid` o `orders/create`: registrar salida de stock en Nuturyx.
   - `products/update`: cambios de catálogo hechos en Shopify.
   - `inventory_levels/update`: conciliación de inventario.

3. **Jobs server-side en Next.js (cron/pull incremental)**
   - Respaldo cuando falle un webhook.
   - Reconciliación diaria/nocturna para consistencia total.

## Patrón de sincronización recomendado

### A) Nuturyx -> Shopify (push)
Disparadores internos:
- entrada kardex (con costo)
- salida por factura
- ajuste manual
- edición de producto/SKU

Acciones:
1. Actualizar inventario en Shopify (`inventorySetQuantities` o equivalente GraphQL vigente).
2. Actualizar costo de variante cuando cambie costo promedio.
3. Registrar `sync_log` con estado (`ok`, `error`, `reintento`).

### B) Shopify -> Nuturyx (pull/webhook)
Eventos:
- orden pagada en Shopify
- devoluciones/cancelaciones
- cambios directos en producto/inventario

Acciones:
1. Resolver SKU/variant_id -> `producto_id` local.
2. Aplicar movimiento en kardex (`salida`/`entrada`) según evento.
3. Mantener idempotencia (no procesar dos veces el mismo evento).

## Modelo de datos adicional sugerido para Fase 2
Crear tablas nuevas en Supabase:

1. `shopify_config`
   - `id`, `shop_domain`, `api_version`, `activo`, `created_at`

2. `shopify_product_map`
   - `producto_id`, `shopify_product_id`, `shopify_variant_id`, `sku_code`, `updated_at`

3. `shopify_webhook_events`
   - `event_id`, `topic`, `payload`, `procesado`, `error`, `created_at`
   - unique por `event_id` para idempotencia

4. `sync_log`
   - `id`, `origen`, `accion`, `entidad`, `entidad_id`, `estado`, `detalle`, `created_at`

## Reglas de costo promedio (tu caso de negocio)
- Entrada con costo distinto recalcula costo promedio ponderado local.
- Ese costo promedio se convierte en el costo objetivo a publicar en Shopify.
- Salidas por venta no recalculan costo promedio; solo reducen stock.
- Reconciliación nocturna valida que costo/inventario Shopify = Nuturyx.

## Seguridad recomendada
- Token de Shopify solo en servidor (nunca en cliente).
- Verificar firma HMAC de webhooks.
- Endpoint webhook con rate-limit + idempotencia + cola de reintentos.
- RLS en tablas de integración (`sync_log`, `shopify_*`).

## Qué te recomiendo implementar primero en Fase 2
1. Infraestructura base: tablas `shopify_*`, `sync_log`, endpoint webhook.
2. Mapeo SKU/variante y sync Nuturyx -> Shopify de inventario + costo.
3. Ingesta de órdenes Shopify -> movimientos_stock/facturas internas (modo resumido).
4. Reconciliación programada + panel de errores de sincronización.

## Nota técnica
Como Shopify evoluciona versiones de API, conviene fijar una `api_version` explícita en configuración y revisar compatibilidad trimestralmente.
