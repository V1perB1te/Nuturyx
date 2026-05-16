# Plan de ejecución — Nuturyx

Este plan construye desde cero una PWA de inventario y facturación en `c:\Proyectos\Nutory\Nuturyx` con enfoque de producción, MVP completo, seguridad RLS/RPC en Supabase y una base preparada para Fase 2 de integración bidireccional con Shopify.

## 1) Decisiones confirmadas
- Proyecto nuevo en: `c:\Proyectos\Nutory\Nuturyx`.
- Repositorio GitHub: `Nuturyx` (público).
- Estrategia de ramas: trabajo en `dev`, promoción a `main` al estabilizar.
- Gestor de paquetes: `npm`.
- UI y contenido: 100% español.
- Shopify: Fase 2 (post-MVP).
- Kardex/costo promedio: funcional desde MVP e independiente de Shopify.
- Migraciones Supabase: se entregan scripts SQL completos para ejecución manual por el usuario.

## 2) Alcance MVP (Fase 1)
### 2.1 Infraestructura app
- Inicializar `Next.js 14 + TypeScript + Tailwind + App Router`.
- Configurar `next-pwa` (manifest, service worker y assets base).
- Definir estructura modular por dominios (`auth`, `inventario`, `facturacion`, `historial`, `impresion`, `admin`, `shared`).

### 2.2 Autenticación y autorización
- Integrar Supabase SSR (`@supabase/ssr` + `@supabase/supabase-js`).
- Implementar `/login` y middleware de protección de rutas privadas.
- Reglas de navegación:
  - no autenticado -> `/login`
  - autenticado en `/login` -> `/dashboard`
- Validar perfil activo con `usuarios.activo`.
- Guard/permiso por rol (`admin`, `vendedor`) en layout y páginas.

### 2.3 Base de datos Supabase (SQL inicial)
- Crear enums:
  - `user_role`, `movimiento_tipo`, `factura_estado`, `tipo_descuento`
- Crear tablas:
  - `usuarios`, `productos`, `clientes`, `facturas`, `items_factura`, `movimientos_stock`
- Extensión de kardex/costo promedio para MVP:
  - campos de costo en `productos` (ej. `costo_promedio`, opcional `ultimo_costo`)
  - soporte de movimientos de entrada/salida/ajuste con trazabilidad.
- Habilitar RLS en todas las tablas de negocio.
- Políticas por rol (admin total, vendedor restringido por ownership y alcance).
- Restringir operaciones sensibles directas y canalizarlas por RPC.

### 2.4 RPC/funciones de negocio
- `current_user_role()`
- `is_admin()`
- `ajustar_stock_manual(producto_id, cantidad, motivo)`
- `confirmar_factura(payload jsonb)` (transaccional: factura + ítems + salidas de stock)
- `marcar_factura_impresa(factura_id)`
- Extensión kardex/costos:
  - función de entrada de inventario por kardex que recalcula costo promedio ponderado.
  - reglas para preservar costo en salidas sin recalcular promedio por venta.

### 2.5 Módulos frontend
- `/dashboard`: resumen operativo y alertas bajo stock.
- `/inventario`: listado productos, alertas, crear/activar/desactivar (admin), ajuste stock (admin).
- `/facturas` y `/facturas/nueva`:
  - carrito con Zustand + `persist` en localStorage
  - búsqueda por SKU + escaneo con `@zxing/browser`
  - descuentos por ítem y global (porcentaje/valor)
  - confirmación por RPC
- `/historial` y `/historial/[id]`:
  - admin: global
  - vendedor: solo propias
- `/imprimir` (solo admin):
  - cola de `pendiente_impresion`
  - realtime de Supabase para nuevos pendientes
  - vista ticket 72/80mm + `react-to-print`
  - marcado a `impresa` vía RPC
- `/admin/usuarios`, `/admin/reportes`, `/admin/negocio`:
  - versión MVP funcional (mínimo útil), evitando sobrealcance.

### 2.6 Entregables documentales
- `.env.example` con:
  - `NEXT_PUBLIC_SUPABASE_URL=`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=`
  - `SUPABASE_SERVICE_ROLE_KEY=` (solo server)
- `README.md` paso a paso:
  - `npm install`
  - configurar `.env.local`
  - ejecutar migración SQL en Supabase
  - `npm run dev`
- Scripts npm: `dev`, `build`, `start`, `lint`.

## 3) Enfoque de calidad y seguridad
- Tipado estricto TypeScript y separación cliente/servidor.
- Validación de acceso en middleware + capa de datos (RLS).
- UI responsive (desktop/móvil), priorizando operación rápida en caja.
- Manejo de errores controlado en RPC y formularios críticos.
- Evitar dependencias no requeridas.

## 4) Git y entregas continuas
- Inicializar git en `Nuturyx` si aplica, conectar remoto GitHub público `Nuturyx`.
- Flujo de commits por hitos en `dev`:
  1. scaffolding base + PWA
  2. auth + middleware + roles
  3. schema SQL + RLS + RPC
  4. inventario
  5. facturación + escaneo + descuentos
  6. impresión + realtime
  7. historial + admin secciones
  8. README + `.env.example` + hardening
- Merge a `main` solo tras validación funcional end-to-end.

## 5) Uso práctico de Devin (paralelo recomendado)
Paquetes delegables a Devin sin bloquear desarrollo core:
1. QA E2E de flujos críticos (login, venta, impresión, historial).
2. Auditoría de políticas RLS (matriz de acceso por rol y tabla).
3. Revisión UX móvil (resoluciones comunes de POS).
4. Checklist de release (`dev` listo para promover a `main`).

## 6) Criterios de aceptación del MVP
- Login y guards funcionando con validación de `usuarios.activo`.
- Roles aplicados en UI y data-access (RLS efectiva).
- Inventario admin operativo con ajuste manual por RPC.
- Factura confirmada vía RPC con descuento + impacto stock + movimientos.
- Kardex de entradas con costo promedio operativo e independiente.
- Centro de impresión admin con realtime y cambio de estado a impresa.
- Historial por rol y detalle por factura.
- PWA instalable y scripts npm operativos.

## 7) Fase 2 (Shopify bidireccional, no incluida en MVP)
- Diseñar integración para una sola tienda Shopify (plan Basic).
- Sincronización prioritaria:
  - catálogo productos/variantes
  - niveles de inventario
  - costo de producto (basado en costo promedio de Nuturyx)
  - eventos de venta para conciliación de kardex y margen
- Definir estrategia técnica (Admin API REST/GraphQL + webhooks) en función de límites y permisos reales de tienda.
