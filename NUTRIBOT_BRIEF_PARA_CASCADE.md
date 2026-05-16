# Prompt para Cascade

```md
Contexto:
Estoy creando un proyecto nuevo llamado NutriBot (chatbot de ventas por WhatsApp) que debe integrarse con la API de Nuturyx ya existente.

Necesito que primero generes un plan de desarrollo por fases y después implementes el MVP técnico base.

### Contexto de Nuturyx (sistema existente)
- Backend principal en Next.js + Supabase.
- API multicanal ya implementada con capa neutral y aliases:
  - /api/comercial/* (fuente de verdad)
  - /api/whatsapp/* (alias)
  - /api/shopify/* (alias)
- Endpoints disponibles:
  - GET /api/comercial/productos
  - GET /api/comercial/productos/:id
  - GET /api/comercial/pedidos
  - POST /api/comercial/pedidos
  - PUT /api/comercial/pedidos/:id/confirmar
  - PUT /api/comercial/pedidos/:id/estado
  - GET /api/comercial/pedidos/:id/factura
  - GET /api/comercial/ganancias
- Autenticación actual:
  - Bot: header x-bot-token: <BOT_API_TOKEN>
  - Admin: Bearer token Supabase
- Flujo de negocio clave:
  - El bot crea pedidos (pendiente_confirmacion).
  - Un admin confirma y entonces se genera factura y se descuenta stock.

### Objetivo de NutriBot
Construir chatbot para WhatsApp que:
1) reciba mensajes,
2) muestre catálogo,
3) permita armar pedido,
4) cree pedido en Nuturyx vía API,
5) devuelva confirmación al cliente,
6) registre contexto de conversación para continuidad.

### Requisitos técnicos
- Proyecto en TypeScript.
- Arquitectura limpia por capas (transport/webhook, dominio, servicios, adapters).
- Integración HTTP robusta con Nuturyx (timeouts, retry controlado, manejo de errores).
- Configuración por env vars (sin secretos hardcodeados).
- Logging estructurado (request_id, phone, action, latency_ms, error_code).
- Validación de payloads de entrada/salida.
- Tests mínimos del flujo principal.

### Contrato de integración con Nuturyx
- Base URL por entorno: `NUTURYX_API_BASE_URL` (ej: `https://tu-dominio.com/api/comercial`)
- Headers:
  - `x-bot-token: <NUTURYX_BOT_API_TOKEN>`
  - `Content-Type: application/json`
- Operaciones MVP:
  - `GET {BASE_URL}/productos`
  - `GET {BASE_URL}/productos/{id}`
  - `POST {BASE_URL}/pedidos`
- Payload recomendado para crear pedido:
  - `cliente_nombre`
  - `cliente_whatsapp`
  - `cliente_email` (opcional)
  - `canal = "whatsapp"`
  - `items: [{ producto_id, cantidad }]`
  - `notas_cliente` (opcional)

### Variables de entorno esperadas
```env
NODE_ENV=development
PORT=3001

# Integración Nuturyx
NUTURYX_API_BASE_URL=http://localhost:3000/api/comercial
NUTURYX_BOT_API_TOKEN=tu_token_bot

# Proveedor WhatsApp (ejemplo Meta Cloud API)
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_API_VERSION=v20.0

# Observabilidad / seguridad
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60
```

### Deployment definido
- El deployment de NutriBot será en Vercel.
- Optimizar para ejecución serverless (latencia baja, handlers rápidos, sin jobs largos bloqueantes).
- No usar Typebot en este proyecto.

### Entregables que te pido
1) Plan por fases (MVP → endurecimiento → producción).
2) Estructura de carpetas propuesta.
3) Contrato de estados conversacionales del bot.
4) Implementación inicial funcional del MVP.
5) README operativo con:
   - cómo correr local,
   - cómo configurar webhook,
   - cómo probar con ejemplos,
   - cómo desplegar en Vercel.

### Fases sugeridas (ajústalas si conviene)
- Fase 1: Base técnica + webhook + healthcheck.
- Fase 2: Catálogo desde Nuturyx.
- Fase 3: Carrito conversacional + crear pedido en Nuturyx.
- Fase 4: Manejo de errores/reintentos + observabilidad.
- Fase 5: Hardening y checklist de producción.

### Importante
- No implementes sincronización Shopify dentro de este repo.
- Este bot solo consume API de Nuturyx.
- Mantén compatibilidad con x-bot-token actual.
- Antes de editar archivos, muéstrame plan y supuestos.
```
