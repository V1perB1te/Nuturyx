# Estado actual del proyecto — Nuturyx

Este documento resume el estado real del proyecto para que cualquier persona o IA pueda retomar el trabajo con contexto técnico y operativo completo.

## 1) Resumen ejecutivo
- Proyecto: `Nuturyx` (base de inventario + facturación + API multicanal).
- Stack principal: `Next.js 14 (App Router)`, `TypeScript`, `Tailwind`, `Supabase`, `Zustand`, `next-pwa`.
- Estado general: **estable en rama `dev`**, con build/lint pasando.
- Enfoque actual: operación local + API para integraciones (bot WhatsApp y canal Shopify).

## 2) Arquitectura actual

### 2.1 Frontend/app operativa
Módulos ya funcionales:
- Login y control de sesión.
- Roles (`admin`, `vendedor`).
- Inventario (incluye kardex con costo promedio).
- Facturación + historial + impresión de tickets.
- PWA activa con `manifest` y `service worker`.

### 2.2 Backend/API multicanal
Se implementó una capa neutral y dos alias:
- Capa neutral: `/api/comercial/*`
- Alias: `/api/shopify/*`
- Alias: `/api/whatsapp/*`

Todos consumen lógica compartida en:
- `src/lib/comercial-api.ts`
- `src/lib/comercial-service.ts`

## 3) Estado de Git
- Repositorio: `https://github.com/V1perB1te/Nuturyx`
- Rama de trabajo: `dev`
- Estado del árbol: limpio (`git status -sb` sin cambios)
- Últimos commits relevantes:
  - `6ac0d3d` docs: update env, setup and multichannel operational guides
  - `b8e14bf` feat(api): add multichannel commercial endpoints and auth
  - `f2891c3` feat: add Supabase migrations, docs and execution plan

## 4) Variables de entorno actuales
Definidas en `.env.example`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `BOT_API_TOKEN` (server-only)
- `SHOPIFY_STORE` (reservada fase sync)
- `SHOPIFY_API_TOKEN` (reservada fase sync)
- `SHOPIFY_WEBHOOK_SECRET` (reservada fase sync)

## 5) Base de datos y migraciones
Orden de migraciones actual (debe ejecutarse en Supabase SQL Editor):
1. `20260429_001_init.sql`
2. `20260430_002_clientes_campos.sql`
3. `20260430_003_precio_costo_kardex.sql`
4. `20260430_004_negocio.sql`
5. `20260430_005_usuarios_email.sql`
6. `20260430_006_anular_factura.sql`
7. `20260501_007_negocio_email_mensajes.sql`
8. `20260502_008_realtime_facturas.sql`
9. `20260503_009_puede_crear_productos.sql`
10. `20260516_010_kardex_costo_promedio.sql`
11. `20260516_011_api_multicanal.sql`

### 5.1 Lo nuevo de la migración multicanal (`011`)
- Campos extendidos en `productos` para recomendaciones/descripciones.
- Tablas nuevas:
  - `pedidos_whatsapp`
  - `pedidos_whatsapp_log`
  - `bot_interacciones`
- Índices para performance por estado/cliente/confirmador.
- Trigger de `actualizado_en` en pedidos.
- RLS habilitado + políticas base.
- Función `generar_numero_pedido_whatsapp()`.

## 6) Endpoints implementados

### 6.1 Capa neutral (fuente de verdad)
- `GET /api/comercial/productos`
- `GET /api/comercial/productos/:id`
- `GET /api/comercial/pedidos`
- `POST /api/comercial/pedidos`
- `PUT /api/comercial/pedidos/:id/confirmar`
- `PUT /api/comercial/pedidos/:id/estado`
- `GET /api/comercial/pedidos/:id/factura`
- `GET /api/comercial/ganancias`

### 6.2 Alias completos
Mismas rutas disponibles en:
- `/api/shopify/*`
- `/api/whatsapp/*`

## 7) Seguridad y autenticación API
Implementado en `src/lib/auth.ts`:
- Bot token (`x-bot-token`) contra `BOT_API_TOKEN`.
- Bearer Supabase (`Authorization: Bearer ...`).
- Restricción admin para rutas críticas (confirmar, estado, factura, ganancias).

## 8) Reglas de negocio clave implementadas
- Al crear pedido por API:
  - valida payload y stock,
  - crea registro en `pedidos_whatsapp`,
  - crea log inicial,
  - registra interacción de bot,
  - **no descuenta stock aún**.
- Al confirmar pedido (admin):
  - valida estado,
  - **siempre genera factura**,
  - descuenta stock y crea movimientos,
  - marca pedido como confirmado,
  - registra transición en log,
  - impresión queda separada (no automática obligatoria).

## 9) Archivos clave para continuar
- `src/lib/auth.ts`
- `src/lib/validators.ts`
- `src/lib/api-errors.ts`
- `src/lib/comercial-api.ts`
- `src/lib/comercial-service.ts`
- `src/app/api/comercial/**`
- `src/app/api/shopify/**`
- `src/app/api/whatsapp/**`
- `supabase/migrations/20260516_011_api_multicanal.sql`
- `README.md`
- `SUPABASE_CHECKLIST.md`
- `SHOPIFY_FASE2_ESTRATEGIA.md`

## 10) Validación técnica más reciente
Última validación local:
- `npm run lint` ✅
- `npm run build` ✅

## 11) Pendientes recomendados (siguientes pasos)
1. Ejecutar migración `011` en Supabase y validar tablas/policies.
2. Probar endpoints con `curl`/Postman (bot vs admin).
3. Definir transición de estado con reglas más estrictas (opcional).
4. Añadir tests API (integración) para flujo de pedido-confirmación-factura.
5. Fase posterior: sync real con Shopify (webhooks + reconciliación).

## 12) Notas de contexto funcional
- El bot de WhatsApp es proyecto separado y consume estas APIs.
- Shopify también se conectará a Nuturyx, pero el sync automático completo queda como fase posterior.
- El sistema está diseñado para centralizar operación en Nuturyx y exponer APIs por canal sin duplicar lógica.
