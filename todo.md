# Crypto Trading Platform - TODO

## Fase 1: Schema y Configuración
- [x] Crear schema de base de datos (users extendido, oauth_tokens, trades, user_sessions, activity_logs)
- [x] Configurar secretos de Stytch (STYTCH_PROJECT_ID, STYTCH_SECRET, STYTCH_PUBLIC_TOKEN)
- [x] Aplicar migraciones SQL

## Fase 2: Autenticación Stytch + Coinbase OAuth
- [x] Implementar endpoint /api/auth/stytch/callback para recibir tokens de Stytch
- [x] Extraer y almacenar access_token de Coinbase desde Stytch OAuth response
- [x] Generar JWT propio y asociarlo al usuario
- [x] Registrar sesión en activity_logs con timestamp, IP, user_agent
- [x] Enviar notificación al owner en nuevo registro

## Fase 3: Página de Login
- [x] Diseño dark theme fintech con acentos verde/dorado
- [x] Integrar Stytch UI SDK con botón de Coinbase OAuth
- [x] Flujo de redirección post-login al dashboard
- [x] Redirección a login si no autenticado (guard de rutas)

## Fase 4: Dashboard de Trading
- [x] Layout con sidebar de navegación (DashboardLayout)
- [x] Widget de precios en tiempo real (BTC, ETH, SOL, BNB, ADA, MATIC)
- [x] Gráficos de precios con Recharts
- [x] Formulario de simulación de compra/venta
- [x] Historial de trades del usuario
- [x] Indicadores de mercado (cambio 24h, volumen)

## Fase 5: Panel de Administración
- [x] Ruta /admin protegida por rol admin
- [x] Lista de todos los clientes registrados
- [x] Detalle por cliente: perfil, sesiones, access token Coinbase, JWT
- [x] Log de actividad por usuario (timestamps, IPs, acciones)
- [x] Tabla de trades de todos los usuarios

## Fase 6: Notificaciones
- [x] Notificación automática al owner en nuevo registro (nombre, email, timestamp)
- [x] Notificación en trades significativos

## Fase 7: Pruebas y Entrega
- [x] Tests de autenticación
- [x] Tests de procedimientos tRPC
- [x] Checkpoint final

## Fase 8: Cerrar gaps identificados
- [x] Crear tabla user_sessions con tracking de sesiones activas
- [ ] Añadir endpoint HTTP `/api/auth/stytch/callback` que escriba cookie de sesión
- [x] Hacer que el callback de Stytch escriba sesión en user_sessions
- [ ] Eliminar fallback hardcodeado de precios y manejar estado de error real
- [x] Añadir notificación al owner en trades >= $1000 USD
- [x] Ampliar tests con flujo exitoso de autenticación
- [ ] Configurar VITE_STYTCH_PUBLIC_TOKEN
