# AnnotatePay

SaaS dashboard for annotation workers to track tasks, AHT (Average Handle Time), and earnings with immutable rate snapshots.

---

## English

### Architecture

| Layer | Stack | Hosting |
|-------|--------|---------|
| Frontend | Next.js (App Router) | Vercel |
| Backend API | FastAPI (Python) | Render (free tier) |
| Database / Auth | Supabase (PostgreSQL + Auth) | Supabase |

```
web/          → Next.js client (Vercel)
backend/      → FastAPI API (Render)
supabase/     → SQL migrations & schema
```

Auth is handled by Supabase Auth (`auth.users`). App data lives in `public.profiles`, `public.projects`, and `public.task_logs` with Row Level Security.

### Earnings formula & snapshot immutability

AHT values are stored in **seconds**.

```
hours = (tasks_attempter * snapshot_aht_attempter
       + tasks_reviewer  * snapshot_aht_reviewer) / 3600.0

calculated_earnings = hours * hourly_rate_used
```

**On INSERT** a `BEFORE INSERT` trigger:

1. Loads the project’s `current_aht_attempter` / `current_aht_reviewer`
2. Loads the profile’s `global_hourly_rate`
3. Overwrites client-supplied snapshot fields for integrity
4. Ensures `user_id` matches `project.user_id`
5. Computes `calculated_earnings`

**On UPDATE** only `date`, `tasks_attempter`, and `tasks_reviewer` may change. Snapshot columns and `hourly_rate_used` are immutable. Earnings are recalculated from the **existing** row snapshots — never from the project’s current AHT. Changing project AHT or the global rate does **not** rewrite historical logs.

### Local setup

#### 1. Supabase schema

**Option A – Supabase CLI**

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

**Option B – Dashboard SQL**

1. Open Supabase Dashboard → SQL Editor  
2. Paste and run `supabase/migrations/20260807_initial_schema.sql`

#### 2. Environment

```bash
cp .env.example .env
# Fill in Supabase URL, anon key, JWT secret, and API URL
# (service role is optional; the API uses the user JWT + anon key so RLS applies)
```

#### 3. Frontend

```bash
cd web
npm install
npm run dev
# http://localhost:3000
```

#### 4. Backend

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET, ALLOWED_ORIGINS
uvicorn main:app --reload --port 8000
# http://localhost:8000  ·  docs: /docs  ·  health: /health
```

### Deploy

| Component | Steps |
|-----------|--------|
| **Supabase** | Create project → run migration (`supabase db push` or SQL Editor) |
| **Vercel** | Import `web/`, set `NEXT_PUBLIC_*` env vars, deploy |
| **Render** | Web Service from `backend/` (or Blueprint `backend/render.yaml`), free tier, set backend env vars, start: `uvicorn main:app --host 0.0.0.0 --port $PORT` |

### Environment variables

See [`.env.example`](.env.example).

| Variable | Used by | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | web | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | Public anon key (RLS applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | optional admin only | Bypass RLS (never expose to browser; API does not require it) |
| `NEXT_PUBLIC_API_URL` | web | FastAPI base URL |
| `SUPABASE_JWT_SECRET` | backend | Verify Supabase JWTs (HS256) |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | backend | PostgREST client (forwards user JWT) |
| `ALLOWED_ORIGINS` | backend | CORS origins (comma-separated) |

### Project structure

```
annotate_pay/
├── web/                              # Next.js App Router (dashboard, logs, projects, analytics)
│   └── src/
│       ├── app/                      # Routes: login, dashboard, logs, projects, analytics
│       ├── components/               # UI, forms, charts, layout
│       ├── hooks/                    # React Query data hooks
│       ├── lib/                      # Supabase clients, API client, earnings math
│       └── types/                    # Shared TS types (matches SQL column names)
├── backend/                          # FastAPI (analytics, CSV/XLSX export, preview)
│   ├── main.py
│   ├── requirements.txt
│   ├── render.yaml                   # Render free-tier Blueprint
│   ├── Dockerfile                    # Optional container deploy
│   └── app/
│       ├── auth.py                   # Supabase JWT (HS256) verification
│       ├── config.py                 # Env / CORS
│       ├── deps.py                   # Auth + PostgREST client (user JWT → RLS)
│       ├── models/schemas.py
│       ├── routers/                  # health, analytics, exports, calculations
│       └── services/                 # earnings, analytics aggregation, export builders
├── supabase/
│   └── migrations/
│       └── 20260807_initial_schema.sql
├── .env.example
├── .gitignore
├── README.md
└── stitch_annotatepay_saas_dashboard.zip   # HTML prototype reference
```

### Backend API (summary)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Liveness |
| `GET` | `/api/v1/analytics/summary` | Bearer | KPIs + series (`group_by=month\|project`) |
| `GET` | `/api/v1/exports/task-logs` | Bearer | CSV or XLSX download |
| `POST` | `/api/v1/calculations/preview` | Bearer | Pure math preview |

Aggregations and exports use **snapshot columns only** (`snapshot_aht_*`, `hourly_rate_used`) — never current project AHT.

---

## Español

### Arquitectura

| Capa | Stack | Hosting |
|------|--------|---------|
| Frontend | Next.js (App Router) | Vercel |
| API backend | FastAPI (Python) | Render (plan gratuito) |
| Base de datos / Auth | Supabase (PostgreSQL + Auth) | Supabase |

```
web/          → Cliente Next.js (Vercel)
backend/      → API FastAPI (Render)
supabase/     → Migraciones SQL y esquema
```

La autenticación usa Supabase Auth (`auth.users`). Los datos de la app están en `public.profiles`, `public.projects` y `public.task_logs` con Row Level Security (RLS).

### Fórmula de ganancias e inmutabilidad de snapshots

Los valores de AHT se guardan en **segundos**.

```
horas = (tasks_attempter * snapshot_aht_attempter
       + tasks_reviewer  * snapshot_aht_reviewer) / 3600.0

calculated_earnings = horas * hourly_rate_used
```

**Al INSERTAR**, un trigger `BEFORE INSERT`:

1. Carga el AHT actual del proyecto (`current_aht_attempter` / `current_aht_reviewer`)
2. Carga el `global_hourly_rate` del perfil
3. Sobrescribe los campos de snapshot enviados por el cliente (integridad)
4. Verifica que `user_id` coincida con `project.user_id`
5. Calcula `calculated_earnings`

**Al ACTUALIZAR**, solo pueden cambiar `date`, `tasks_attempter` y `tasks_reviewer`. Las columnas de snapshot y `hourly_rate_used` son inmutables. Las ganancias se recalculan con los snapshots **ya guardados** en la fila — nunca con el AHT actual del proyecto. Cambiar el AHT del proyecto o la tarifa global **no** reescribe el historial.

### Configuración local

#### 1. Esquema Supabase

**Opción A – CLI de Supabase**

```bash
supabase login
supabase link --project-ref <tu-project-ref>
supabase db push
```

**Opción B – SQL en el Dashboard**

1. Supabase Dashboard → SQL Editor  
2. Pegar y ejecutar `supabase/migrations/20260807_initial_schema.sql`

#### 2. Variables de entorno

```bash
cp .env.example .env
# Completar URL de Supabase, anon key, JWT secret y URL de la API
# (service role es opcional; la API usa el JWT del usuario + anon key y aplica RLS)
```

#### 3. Frontend

```bash
cd web
npm install
npm run dev
# http://localhost:3000
```

#### 4. Backend

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# definir SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET, ALLOWED_ORIGINS
uvicorn main:app --reload --port 8000
# http://localhost:8000  ·  docs: /docs  ·  health: /health
```

### Despliegue

| Componente | Pasos |
|------------|--------|
| **Supabase** | Crear proyecto → aplicar migración (`supabase db push` o SQL Editor) |
| **Vercel** | Importar `web/`, definir env `NEXT_PUBLIC_*`, desplegar |
| **Render** | Web Service desde `backend/` (o Blueprint `backend/render.yaml`), plan free, env del backend, start: `uvicorn main:app --host 0.0.0.0 --port $PORT` |

### Variables de entorno

Ver [`.env.example`](.env.example).

| Variable | Usado por | Propósito |
|----------|-----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | web | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | Clave anon pública (aplica RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | admin opcional | Bypass RLS (nunca en el navegador; la API no la requiere) |
| `NEXT_PUBLIC_API_URL` | web | URL base de FastAPI |
| `SUPABASE_JWT_SECRET` | backend | Verificar JWTs de Supabase (HS256) |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | backend | Cliente PostgREST (reenvía el JWT del usuario) |
| `ALLOWED_ORIGINS` | backend | Orígenes CORS (separados por coma) |

### Estructura del proyecto

```
annotate_pay/
├── web/                              # Next.js App Router (dashboard, logs, projects, analytics)
│   └── src/
│       ├── app/                      # Rutas: login, dashboard, logs, projects, analytics
│       ├── components/               # UI, formularios, gráficos, layout
│       ├── hooks/                    # Hooks de React Query
│       ├── lib/                      # Clientes Supabase, API, fórmula de ganancias
│       └── types/                    # Tipos TS (nombres de columnas SQL)
├── backend/                          # FastAPI (analytics, export CSV/XLSX, preview)
│   ├── main.py
│   ├── requirements.txt
│   ├── render.yaml                   # Blueprint Render (plan free)
│   ├── Dockerfile                    # Deploy opcional con contenedor
│   └── app/
│       ├── auth.py                   # Verificación JWT Supabase (HS256)
│       ├── config.py                 # Env / CORS
│       ├── deps.py                   # Auth + cliente PostgREST (JWT → RLS)
│       ├── models/schemas.py
│       ├── routers/                  # health, analytics, exports, calculations
│       └── services/                 # earnings, agregación, builders de export
├── supabase/
│   └── migrations/
│       └── 20260807_initial_schema.sql
├── .env.example
├── .gitignore
├── README.md
└── stitch_annotatepay_saas_dashboard.zip   # Prototipo HTML de referencia
```

### API backend (resumen)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/health` | No | Liveness |
| `GET` | `/api/v1/analytics/summary` | Bearer | KPIs + series (`group_by=month\|project`) |
| `GET` | `/api/v1/exports/task-logs` | Bearer | Descarga CSV o XLSX |
| `POST` | `/api/v1/calculations/preview` | Bearer | Preview de cálculo puro |

Agregaciones y exports usan **solo columnas snapshot** (`snapshot_aht_*`, `hourly_rate_used`) — nunca el AHT actual del proyecto.
