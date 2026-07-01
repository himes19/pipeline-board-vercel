# ⚡ PulseVolt CRM — Pipeline Board

Sistema de gestión de pipeline de ventas B2B para PulseVolt, especializado en proyectos BESS (Battery Energy Storage Systems) para manufactura industrial en México.

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (pv-deal-editor en Vercel)                    │
│  /frontend/index.html — SPA en HTML/JS puro             │
└────────────────────┬────────────────────────────────────┘
                     │ fetch API
┌────────────────────▼────────────────────────────────────┐
│  Backend (pipeline-board-vercel en Vercel)              │
│  Node.js serverless functions en /api/                   │
│  URL: pipeline-board-vercel.vercel.app                  │
└────────────────────┬────────────────────────────────────┘
                     │ pg (PostgreSQL)
┌────────────────────▼────────────────────────────────────┐
│  Base de Datos (Neon PostgreSQL)                        │
│  Proyecto: twilight-rain-88348863 / DB: neondb          │
└─────────────────────────────────────────────────────────┘
```

---

## Repositorio GitHub

**`himes19/pipeline-board-vercel`** (rama: `master`)

```
/api/
  chat.js                ← AI Sales Manager (no activo actualmente)
  create_deal.js         ← Crear deals
  delete_deal.js         ← Eliminar deals
  edit_deal.js           ← Editar campos + registra deal_movements + actualiza stage_change_date
  files/[name].js        ← Archivos por deal (placeholder, sin storage configurado)
  freeze.js              ← GET/POST análisis de congelamiento
  login.js               ← Login + Logout fusionados
  playbook.js            ← GET/POST checks del playbook por deal
  query.js               ← SELECT (lectura) + INSERT/UPDATE (escritura admin)
  rescore_daily.js       ← CRON: recalcula deal_score + temperatura diariamente
  snapshot_weekly.js     ← CRON: snapshot semanal del pipeline por vendedor
  weekly_report.js       ← CRON: detecta cambios de stage de la semana
/lib/
  auth.js                ← JWT, usuarios, CORS
  db.js                  ← Pool de conexión a Neon (usa PG_URL)
  utils.js               ← STAGE_STATUS_MAP, DEAL_FIELD_MAP, calcScoresFromDeal
/frontend/
  index.html             ← Frontend completo (SPA)
  vercel.json            ← Config del proyecto frontend
vercel.json              ← Config del backend + cron schedules
package.json
README.md
```

---

## Variables de Entorno (Vercel — proyecto backend)

| Variable | Descripción | Estado |
|---|---|---|
| `PG_URL` | Connection string Neon PostgreSQL | ✅ Activa |
| `JWT_SECRET` | Secreto para firmar tokens JWT (7 días) | ✅ Activa |
| `CRON_SECRET` | Llave para autenticar cron jobs manualmente | ✅ Activa |
| `DENCH_CLOUD_KEY` | API key del chat AI | ⏸ En pausa |
| `DENCH_CLOUD_URL` | URL del gateway del chat AI | ⏸ En pausa |

---

## Usuarios del Sistema

| Username | Nombre | Rol | Acceso |
|---|---|---|---|
| `jorge` | Jorge H | admin | Todo el pipeline |
| `horacio` | Horacio Garcia | admin | Todo el pipeline |
| `alejandro` | Alejandro | admin | Todo el pipeline |
| `mauricio` | MAURICIO LIRA MORIN | gerente | Todo el pipeline |
| `alberto` | Alberto Rivera | vendedor | Solo sus deals |
| `carlos` | Carlos Cruz | vendedor | Solo sus deals |

> ⚠️ Las contraseñas están en `lib/auth.js`. Hacer el repo **privado** antes de producción.

---

## Cron Jobs

| Endpoint | Schedule (UTC) | Hora México | Función |
|---|---|---|---|
| `/api/rescore_daily` | `0 4 * * *` | ~10pm diario | Recalcula `deal_score` y `temperatura` |
| `/api/snapshot_weekly` | `0 4 * * 4` | ~10pm jueves | Snapshot del pipeline por vendedor |
| `/api/weekly_report` | `30 4 * * 4` | ~10:30pm jueves | Detecta cambios de stage de la semana |

### Correr manualmente:
```bash
curl -s https://pipeline-board-vercel.vercel.app/api/rescore_daily \
  -X POST -H "x-admin-key: [CRON_SECRET]"
```

---

## Base de Datos

### Arquitectura EAV
```
objects → entries → entry_fields ← fields
(tipo)    (registro)  (valor)      (definición)
```
Object ID de deals: `e9f17fa1-bdd2-4bcc-9798-458ae301ec2c`

### Tablas activas

| Tabla | Descripción |
|---|---|
| `entries` | Un registro por deal/contacto/empresa (~16,700 filas) |
| `entry_fields` | Almacén de valores EAV (~164,000 filas) |
| `fields` | Definición de campos por objeto (273 fields) |
| `objects` | Tipos de entidad (deal, contact, company...) |
| `config` | Configuración global (meta_anual_usd) |
| `deal_movements` | Historial de cambios de stage por deal |
| `weekly_snapshots_v2` | Snapshot semanal por vendedor |
| `weekly_changes` | Cambios detectados semana a semana |
| `freeze_analysis` | Análisis de congelamiento por deal |
| `playbook_checks` | Checks del playbook por deal |
| `stage_expiry_config` | Días máximos por stage (8 stages) |
| `stage_gates` | Requisitos por stage para avanzar |

### Tablas en pausa (módulo Outreach — Fase 2)
`outreach_campaigns`, `outreach_config`, `outreach_events`, `outreach_messages`, `outreach_metrics`, `outreach_signals`, `lead_sequences`

### Vistas
- **`v_deal`** — pivot de entry_fields, nombres con comillas
- **`deals`** — capa sobre v_deal con nombres snake_case. **Vista de uso diario.**

---

## Field IDs Críticos

| Campo | UUID |
|---|---|
| `Deal Name` | `aa797617-3ac4-4469-af73-cb4233c2d689` |
| `Stage` | `f5d3458d-fbae-4dc2-a4ae-5fd6289f9e0e` |
| `Stage Change Date` | `763c5085-b381-4646-a461-82c328523024` |
| `Deal Score` | `38b24a2e-c656-45f3-aa0f-bed6ca2f5b56` |
| `Temperatura` | `f457c08e-50c2-4c98-973a-fa1fd52f905c` |
| `Freeze Status` | `e8615681-e021-40da-ac53-110b16f8c41c` |
| `Nivel de Contacto Score` | `a0a18c2d-706c-438b-8c19-8165f91f81bd` |
| `Etapa del Proceso Score` | `982235fc-c40d-4757-87f2-f3d04226be6a` |
| `Solidez Business Case Score` | `8062fa32-bc81-45fc-a774-d2e47e451b62` |
| `Tipo de Cliente Score` | `9b560523-3178-4791-922a-2c90c13f0e1e` |
| `Assigned To` | `1ef2318b-fe6f-407e-918c-2f8ad378a00f` |
| `Next Action` | `27f3cda3-4781-455b-98e6-574d29cf3efd` |
| `Next Follow-up Date` | `6e6aabca-f191-4aaa-b31e-6f4901f9bab0` |
| `Last Interaction Notes` | `6ceafecf-2089-4e6c-920a-43dd490b4040` |
| `Priority` | `9932a45b-568c-47e9-ad2f-0930b66fe973` |

---

## Stages del Pipeline (Proceso Consultivo PulseVolt)

| # | Stage | Exit Criteria |
|---|---|---|
| 1 | Discovery Call | 3 turnos confirmado + dolor articulado + recibo CFE comprometido + siguiente reunión agendada |
| 2 | Propuesta Preliminar | Cliente quiere seguir + identificó área interna + agenda siguiente semana |
| 3 | Reunión con Producción | Información de pérdidas por paros recibida |
| 4 | Reunión con Calidad | Información de scrap y retrabajos recibida |
| 5 | Reunión con Finanzas | Entienden depreciación acelerada + parámetros de aprobación + validan BC |
| 6 | Reunión Técnica / Pre-Ingeniería | Checklist técnico completo + sin sorpresas mayores |
| 7 | Desarrollo del Business Case | BC documentado + presentado al champion + listo para aprobación |
| 8 | Presentación Ejecutiva | Junta con Gerente de Planta o superior confirmada |
| 0 | Perdido | — |
| 13 | Ganado | — |

---

## Deal Scoring

**Fórmula:** `score = (nc×10% + ep×15% + sbc×30% + tc×45%) × 100`

| Sub-score | Peso | 1 (33%) | 2 (67%) | 3 (100%) |
|---|---|---|---|---|
| Nivel de Contacto | 10% | Solo técnico | Gerencial | Decision Maker |
| Etapa del Proceso | 15% | Stages 1-2 | Stages 3-6 | Stages 7-8 |
| Solidez Business Case | 30% | Sin datos | Datos parciales | Validado con cliente |
| Tipo de Cliente | 45% | Baja criticidad | Manufactura general | Auto/Electrónica/Pharma |

---

## Temperatura Automática

Calculada cada noche por `rescore_daily`:

| Temperatura | Criterio |
|---|---|
| 🔥 Caliente | Cambió de stage hace ≤7 días |
| 🌡️ Tibio | Cambió de stage hace 8-14 días |
| ❄️ Frío | Sin cambio de stage en +14 días |

---

## Backup

- Neon Plan Gratuito: 6 horas de historial de restauración continua
- Snapshot manual creado: `2026-07-01` (117MB, nunca expira)
- **Acción mensual:** Primer lunes de cada mes → Neon Console → Backup & Restore → Create snapshot

---

## Pendientes / Próximas Fases

- [ ] Hacer repo privado en GitHub
- [ ] Módulo de Outreach — pipeline desde prospecto hasta Discovery Call
- [ ] Conversion rate por rep por stage en KPIs
- [ ] Pain score por deal
- [ ] Storage real para archivos (Vercel Blob o S3)

---

*Última actualización: Julio 2026*
