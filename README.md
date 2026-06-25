# PulseVolt Pipeline Board — Backend API

Backend serverless para el CRM de PulseVolt. Desplegado en Vercel.

## Variables de entorno requeridas
- `PG_URL` — Connection string de Neon DB
- `JWT_SECRET` — Secreto para firmar tokens JWT
- `CRON_SECRET` — Llave para autenticar el cron job
- `DENCH_CLOUD_KEY` — API key para el chat AI
- `AI_MODEL` — Modelo AI (default: claude-sonnet-4.6)

## Endpoints
- POST `/api/login` — Autenticación
- POST `/api/logout` — Cerrar sesión
- POST `/api/query` — Consultas SELECT
- POST `/api/execute` — INSERT/UPDATE (admin/gerente)
- POST `/api/edit_deal` — Editar campo de un deal
- POST `/api/create_deal` — Crear nuevo deal
- POST `/api/delete_deal` — Eliminar deal
- POST `/api/rescore` — Calcular scores de un deal
- POST `/api/chat` — Chat AI con contexto CRM
- GET  `/api/materiales` — Listar materiales
- POST `/api/upload` — Subir archivo
- GET  `/api/files/:name` — Archivos de un deal
- GET  `/api/cron/recalcular-score` — Cron diario de deal_score
