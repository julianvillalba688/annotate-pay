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

The web app defaults to English and offers Spanish as an option. Product-facing UI uses project terminology throughout.

### Earnings formula & snapshot immutability

AHT is entered and stored in **minutes** for projects and immutable task-log snapshots. The formula divides weighted AHT minutes by 60 to convert minutes to hours.

```
hours = (tasks_attempter * snapshot_aht_attempter
       + tasks_reviewer  * snapshot_aht_reviewer) / 60.0

calculated_earnings = hours * hourly_rate_used
```

USD is the canonical accounting currency. `global_hourly_rate` is an editable USD hourly rate for future logs; once a log is committed, its `hourly_rate_used` and earnings snapshots (`calculated_earnings` / `calculated_earnings_usd`) remain immutable USD values. `preferred_currency` changes display values only: the web app gets current FX rates from FastAPI and never rewrites historical USD accounting values.

**On INSERT** a `BEFORE INSERT` trigger:

1. Loads the project’s `current_aht_attempter` / `current_aht_reviewer` in minutes
2. Loads the profile’s USD `global_hourly_rate`
3. Overwrites client-supplied snapshot fields for integrity
4. Ensures `user_id` matches `project.user_id`
5. Computes `calculated_earnings` using minute-based AHT
6. Forces canonical USD metadata and copies the result to `calculated_earnings_usd`

**On UPDATE** only `date`, `tasks_attempter`, and `tasks_reviewer` may change. Snapshot columns, `hourly_rate_used`, and accounting metadata are immutable. Earnings are recalculated from the **existing** minute-based row snapshots — never from the project’s current AHT. Changing project AHT or the global USD rate does **not** rewrite historical logs.

### Payment bookkeeping

Payment status is stored per task log in `task_logs.payment_status` and can be `pending` or `paid`; `paid_at` stores the timestamp for the user-reported paid state. Status is per log because a project can be paid in installments. This is self-reported bookkeeping, not external payment verification.

The dashboard displays **gross earnings**, **acquired/paid earnings**, and **pending earnings** in the selected display currency. Accounting and stored earnings remain canonical USD; selecting another currency changes presentation only.

### FX display rates and freshness

FX conversion is display-only; accounting remains canonical USD. Stored earnings, aggregates, and exports are not rewritten when the display currency changes.

- When `ALLRATES_API_KEY` is configured, the authenticated AllRatesToday endpoint is the primary provider and requests the required display currencies in one batch. Without a key, or when it fails, the backend uses the ExchangeRate-API open endpoint and then Frankfurter as fallbacks.
- `ALLRATES_API_KEY` is backend-only. It must never be placed in frontend code, `NEXT_PUBLIC_*` variables, or Vercel. Render stores it privately.
- The normal in-memory refresh window is 3600 seconds (one hour) by default; set `FX_CACHE_TTL_SECONDS` to change it. One hour or longer is recommended for free-tier quota protection. A manual `refresh=true` bypasses the cache and can consume a provider request, so avoid polling it.
- Successful responses include the provider's published update timestamp and source; if a refresh fails after rates are available, the last known rates are retained and marked stale. AllRatesToday 401/429 responses safely fall through to the other providers.
- The currency selector has a manual refresh control and displays the provider update timestamp, source, and stale status.
- Both FX API endpoints support `refresh=true` to bypass the normal in-memory window and force a fetch from the current provider.
- `rate_to_usd` is the USD value of 1 unit of the target currency. Providers return target-currency units per 1 USD, so the backend inverts those quotes. FX remains display-only; stored USD earnings and accounting data are never rewritten.
- Free providers publish the latest available rates, not tick-by-tick trading prices. If true real-time market quotes are required, a paid/live provider key is needed.

### Project deletion

Projects can be deleted from the UI. The confirmation warning explains that deleting a project permanently deletes all of its task logs through the database foreign-key cascade. This cannot be undone.

### Local setup

#### 1. Supabase schema

Apply the migrations in this order:

1. `supabase/migrations/20260807_initial_schema.sql`
2. `supabase/migrations/20260808_aht_minutes_currency_i18n.sql`
3. `supabase/migrations/20260809_payment_status.sql`

The `20260808_aht_minutes_currency_i18n.sql` migration must run after the initial migration. If the initial schema was applied manually, run it once in the Supabase SQL Editor. Its `aht_unit` guard prevents a second AHT conversion. It converts existing AHT values from seconds to minutes once, adds currency and locale metadata, and installs the minutes/USD triggers. Run `20260809_payment_status.sql` after it to add per-task-log payment bookkeeping.

**Option A – Supabase CLI**

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

`supabase db push` applies all pending migrations in order. If the initial migration is already tracked as applied, it applies the two follow-up migrations as the remaining pending migrations.

**Option B – Dashboard SQL**

1. Open Supabase Dashboard → SQL Editor
2. Paste and run `supabase/migrations/20260807_initial_schema.sql`
3. Paste and run `supabase/migrations/20260808_aht_minutes_currency_i18n.sql`
4. Paste and run `supabase/migrations/20260809_payment_status.sql`

If the initial migration is already applied, skip step 2. If the `20260808` migration is already applied, skip step 3. Run the payment migration after `20260808`.

#### 2. Environment

Use the example file for each app and fill in local values without committing secrets:

- Web (`web/.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`
- Backend (`backend/.env.example`): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`, `ALLOWED_ORIGINS`, optional `ALLRATES_API_KEY`, and `FX_CACHE_TTL_SECONDS`
- `PORT` is optional locally and is supplied by Render in production.
- `ALLRATES_API_KEY` is private backend configuration; there is no frontend key.
- A Supabase service-role key is optional for separate admin work only; it is not required by the web app or API.

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
| **Supabase** | Create project → apply the initial migration, then `20260808_aht_minutes_currency_i18n.sql` and `20260809_payment_status.sql` (`supabase db push` or SQL Editor) |
| **Vercel** | Set Root Directory to `web/`; set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_API_URL` (the deployed FastAPI URL); deploy |
| **Render** | From the repository root, create a Blueprint from `render.yaml` (it sets the service Root Directory to `backend/`); enter the Supabase variables and `ALLOWED_ORIGINS`; optionally add the private `ALLRATES_API_KEY` and `FX_CACHE_TTL_SECONDS=3600`; deploy |

For a repository-root Render Blueprint, use the root-level `render.yaml`. The retained `backend/render.yaml` is valid when `backend/` is selected as the service root, or when a custom setup explicitly supplies `rootDir: backend`; selecting the nested Blueprint path alone is not enough.

### Environment variables

See [`.env.example`](.env.example).

| Variable | Used by | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | web | Supabase project URL; required |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | Public anon key (RLS applies); required |
| `SUPABASE_SERVICE_ROLE_KEY` | optional admin only | Bypass RLS (never expose to browser; API does not require it) |
| `NEXT_PUBLIC_API_URL` | web | FastAPI base URL; required for deployment |
| `SUPABASE_JWT_SECRET` | backend | Verify Supabase JWTs (HS256); required |
| `SUPABASE_URL` | backend | Supabase project URL for the PostgREST client; required |
| `SUPABASE_ANON_KEY` | backend | PostgREST client key (forwards user JWT); required |
| `ALLOWED_ORIGINS` | backend | CORS origins (comma-separated); required |
| `PORT` | backend | Render supplies this; optional locally |
| `ALLRATES_API_KEY` | backend | Optional private AllRatesToday Bearer key; never frontend |
| `FX_CACHE_TTL_SECONDS` | backend | Optional positive FX cache TTL; default/recommendation `3600` |

No FX key is required for fallback operation. When configured, AllRatesToday is tried first and the backend falls back safely if it is unavailable.

For the exact private Render action: open Render Dashboard → `annotate-pay-api` → Environment → Add Environment Variable → add `ALLRATES_API_KEY` with the private value → add `FX_CACHE_TTL_SECONDS` with `3600` → Save Changes → Manual Deploy → Deploy latest commit. Do not add the key to Vercel or frontend environment variables.

### Project structure

```
annotate_pay/
├── render.yaml                        # Root Render Blueprint (service rootDir: backend)
├── web/                              # Next.js App Router (dashboard, logs, projects, analytics)
│   └── src/
│       ├── app/                      # Routes: login, dashboard, logs, projects, analytics
│       ├── components/               # UI, forms, charts, layout
│       ├── hooks/                    # React Query data hooks
│       ├── lib/                      # Supabase clients, API client, earnings math
│       └── types/                    # Shared TS types (matches SQL column names)
├── backend/                          # FastAPI (analytics, FX, CSV/XLSX export, preview)
│   ├── main.py
│   ├── requirements.txt
│   ├── render.yaml                   # Backend-root Blueprint alternative
│   ├── Dockerfile                    # Optional container deploy
│   └── app/
│       ├── auth.py                   # Supabase JWT (HS256) verification
│       ├── config.py                 # Env / CORS
│       ├── deps.py                   # Auth + PostgREST client (user JWT → RLS)
│       ├── models/schemas.py
│       ├── routers/                  # health, analytics, exports, calculations, fx
│       └── services/                 # earnings, analytics aggregation, export builders, FX
├── supabase/
│   └── migrations/
│       ├── 20260807_initial_schema.sql
│       ├── 20260808_aht_minutes_currency_i18n.sql
│       └── 20260809_payment_status.sql
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
| `POST` | `/api/v1/calculations/preview` | Bearer | USD math preview plus optional display conversion |
| `GET` | `/api/v1/fx/rates` | No | Current `{code, rate_to_usd}` list plus `as_of`, `source`, and `stale`; supports optional `refresh=true` |
| `GET` | `/api/v1/fx/rate/{currency}` | No | Current `{currency, rate_to_usd, as_of, source, stale}`; supports optional `refresh=true` |

Aggregations and exports use **snapshot columns only** (`snapshot_aht_*`, `hourly_rate_used`) — never current project AHT. FX endpoints provide current display rates; they do not change canonical USD aggregates or exports.

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

La aplicación web usa inglés por defecto y ofrece español como opción. La interfaz del producto usa terminología de proyectos en todo momento.

### Fórmula de ganancias e inmutabilidad de snapshots

El AHT se introduce y se guarda en **minutos** para los proyectos y los snapshots inmutables de los logs. La fórmula divide el AHT ponderado en minutos entre 60 para convertirlo a horas.

```
horas = (tasks_attempter * snapshot_aht_attempter
       + tasks_reviewer  * snapshot_aht_reviewer) / 60.0

calculated_earnings = horas * hourly_rate_used
```

USD es la moneda contable canónica. `global_hourly_rate` es una tarifa por hora editable en USD para logs futuros; al registrar un log, sus snapshots de `hourly_rate_used` y ganancias (`calculated_earnings` / `calculated_earnings_usd`) permanecen como valores USD inmutables. `preferred_currency` solo cambia los valores mostrados: la aplicación obtiene los tipos de cambio actuales desde FastAPI y nunca reescribe los valores contables históricos en USD.

**Al INSERTAR**, un trigger `BEFORE INSERT`:

1. Carga el AHT actual del proyecto (`current_aht_attempter` / `current_aht_reviewer`) en minutos
2. Carga la tarifa `global_hourly_rate` del perfil en USD
3. Sobrescribe los campos de snapshot enviados por el cliente (integridad)
4. Verifica que `user_id` coincida con `project.user_id`
5. Calcula `calculated_earnings` usando AHT en minutos
6. Fuerza los metadatos USD canónicos y copia el resultado a `calculated_earnings_usd`

**Al ACTUALIZAR**, solo pueden cambiar `date`, `tasks_attempter` y `tasks_reviewer`. Las columnas de snapshot, `hourly_rate_used` y los metadatos contables son inmutables. Las ganancias se recalculan con los snapshots **en minutos ya guardados** en la fila — nunca con el AHT actual del proyecto. Cambiar el AHT del proyecto o la tarifa global en USD **no** reescribe el historial.

### Contabilidad de pagos

El estado de pago se guarda por log de tareas en `task_logs.payment_status` y puede ser `pending` o `paid`; `paid_at` guarda la marca de tiempo del estado pagado declarado por el usuario. El estado es por log porque un proyecto puede pagarse en varias cuotas. Es una contabilidad autodeclarada, no una verificación de pagos externa.

El dashboard muestra **ganancias brutas**, **ganancias adquiridas/pagadas** y **ganancias pendientes** en la moneda de visualización seleccionada. La contabilidad y las ganancias almacenadas siguen siendo USD canónicos; seleccionar otra moneda solo cambia la presentación.

### Tipos de cambio de visualización y frescura

La conversión de FX solo cambia la visualización; la contabilidad sigue siendo USD canónico. Las ganancias almacenadas, los agregados y los exports no se reescriben al cambiar la moneda de visualización.

- Cuando se configura `ALLRATES_API_KEY`, el endpoint autenticado de AllRatesToday es el proveedor principal y solicita las monedas de visualización requeridas en un lote. Sin clave, o si falla, la API usa el endpoint abierto de ExchangeRate-API y después Frankfurter como respaldos.
- `ALLRATES_API_KEY` es solo para el backend. Nunca debe estar en el código del frontend, variables `NEXT_PUBLIC_*` ni Vercel. Render la guarda de forma privada.
- La ventana normal de actualización en memoria es de 3600 segundos (una hora) por defecto; `FX_CACHE_TTL_SECONDS` permite cambiarla. Se recomienda una hora o más para proteger la cuota del nivel gratuito. `refresh=true` omite la caché y puede consumir una solicitud, así que no se debe consultar continuamente.
- Las respuestas correctas incluyen la marca de tiempo publicada y la fuente; si falla una actualización después de obtener tasas, se conservan las últimas tasas conocidas y se marcan como desactualizadas. Los errores 401/429 de AllRatesToday pasan de forma segura al siguiente proveedor.
- El selector de moneda tiene un control de actualización manual y muestra la marca de tiempo de actualización del proveedor, la fuente y el estado de desactualización.
- Ambos endpoints de FX admiten `refresh=true` para omitir la ventana normal en memoria y forzar una consulta al proveedor actual.
- `rate_to_usd` es el valor en USD de 1 unidad de la moneda objetivo. Los proveedores devuelven unidades de la moneda objetivo por 1 USD, por lo que el backend invierte esas cotizaciones. FX solo cambia la visualización; las ganancias almacenadas y la contabilidad en USD nunca se reescriben.
- Los proveedores gratuitos publican las últimas tasas disponibles, no precios de mercado tick a tick. Si se requieren cotizaciones de mercado verdaderamente en tiempo real, se necesita una clave de un proveedor de pago/en vivo.

### Eliminación de proyectos

Los proyectos se pueden eliminar desde la interfaz. La advertencia de confirmación explica que eliminar un proyecto elimina permanentemente todos sus logs de tareas mediante la cascada de clave foránea de la base de datos. Esta acción no se puede deshacer.

### Configuración local

#### 1. Esquema Supabase

Aplica las migraciones en este orden:

1. `supabase/migrations/20260807_initial_schema.sql`
2. `supabase/migrations/20260808_aht_minutes_currency_i18n.sql`
3. `supabase/migrations/20260809_payment_status.sql`

La migración `20260808_aht_minutes_currency_i18n.sql` debe ejecutarse después de la migración inicial. Si el esquema inicial se aplicó manualmente, ejecútala una sola vez en el SQL Editor de Supabase. Su guardia `aht_unit` evita una segunda conversión de AHT. Convierte una sola vez los valores existentes de AHT de segundos a minutos, añade los metadatos de moneda e idioma e instala los triggers de minutos/USD. Ejecuta `20260809_payment_status.sql` después para añadir la contabilidad de pagos por log de tareas.

**Opción A – CLI de Supabase**

```bash
supabase login
supabase link --project-ref <tu-project-ref>
supabase db push
```

`supabase db push` aplica todas las migraciones pendientes en orden. Si la migración inicial ya figura como aplicada, aplica las dos migraciones de seguimiento como las migraciones pendientes restantes.

**Opción B – SQL en el Dashboard**

1. Supabase Dashboard → SQL Editor
2. Pegar y ejecutar `supabase/migrations/20260807_initial_schema.sql`
3. Pegar y ejecutar `supabase/migrations/20260808_aht_minutes_currency_i18n.sql`
4. Pegar y ejecutar `supabase/migrations/20260809_payment_status.sql`

Si la migración inicial ya está aplicada, omite el paso 2. Si la migración `20260808` ya está aplicada, omite el paso 3. Ejecuta la migración de pagos después de `20260808`.

#### 2. Variables de entorno

Usa el archivo de ejemplo de cada aplicación y completa valores locales sin confirmar secretos:

- Web (`web/.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`
- Backend (`backend/.env.example`): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`, `ALLOWED_ORIGINS`, `ALLRATES_API_KEY` opcional y `FX_CACHE_TTL_SECONDS`
- `PORT` es opcional en local y Render lo proporciona en producción.
- `ALLRATES_API_KEY` es configuración privada del backend; no existe una clave para el frontend.
- La clave service-role de Supabase solo es opcional para tareas administrativas separadas; la web y la API no la necesitan.

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
| **Supabase** | Crear proyecto → aplicar la migración inicial y después `20260808_aht_minutes_currency_i18n.sql` y `20260809_payment_status.sql` (`supabase db push` o SQL Editor) |
| **Vercel** | Definir Root Directory como `web/`; configurar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `NEXT_PUBLIC_API_URL` (la URL de FastAPI desplegada); desplegar |
| **Render** | Desde la raíz del repositorio, crear un Blueprint con `render.yaml` (define `backend/` como Root Directory del servicio); configurar las variables de Supabase y `ALLOWED_ORIGINS`; añadir opcionalmente `ALLRATES_API_KEY` privada y `FX_CACHE_TTL_SECONDS=3600`; desplegar |

Para un Blueprint de Render desde la raíz del repositorio, usa el `render.yaml` de nivel raíz. El `backend/render.yaml` conservado es válido cuando se selecciona `backend/` como raíz del servicio o cuando una configuración personalizada define explícitamente `rootDir: backend`; seleccionar solo la ruta del Blueprint anidado no es suficiente.

### Variables de entorno

Ver [`.env.example`](.env.example).

| Variable | Usado por | Propósito |
|----------|-----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | web | URL del proyecto Supabase; obligatorio |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | Clave anon pública (aplica RLS); obligatorio |
| `SUPABASE_SERVICE_ROLE_KEY` | admin opcional | Bypass RLS (nunca en el navegador; la API no la requiere) |
| `NEXT_PUBLIC_API_URL` | web | URL base de FastAPI; obligatorio en despliegue |
| `SUPABASE_JWT_SECRET` | backend | Verificar JWTs de Supabase (HS256); obligatorio |
| `SUPABASE_URL` | backend | URL del proyecto Supabase para PostgREST; obligatorio |
| `SUPABASE_ANON_KEY` | backend | Clave para PostgREST (reenvía el JWT del usuario); obligatorio |
| `ALLOWED_ORIGINS` | backend | Orígenes CORS (separados por coma); obligatorio |
| `PORT` | backend | Render lo proporciona; opcional en local |
| `ALLRATES_API_KEY` | backend | Clave Bearer privada opcional de AllRatesToday; nunca en frontend |
| `FX_CACHE_TTL_SECONDS` | backend | TTL opcional positivo de caché FX; predeterminado/recomendado `3600` |

No se requiere una clave FX para el funcionamiento con respaldos. Cuando se configura, AllRatesToday se prueba primero y el backend cambia de forma segura a los otros proveedores si no está disponible.

Acción privada exacta en Render: abrir Render Dashboard → `annotate-pay-api` → Environment → Add Environment Variable → añadir `ALLRATES_API_KEY` con el valor privado → añadir `FX_CACHE_TTL_SECONDS` con `3600` → Save Changes → Manual Deploy → Deploy latest commit. No añadir la clave a Vercel ni a variables del frontend.

### Estructura del proyecto

```
annotate_pay/
├── render.yaml                        # Blueprint raíz de Render (rootDir del servicio: backend)
├── web/                              # Next.js App Router (dashboard, logs, projects, analytics)
│   └── src/
│       ├── app/                      # Rutas: login, dashboard, logs, projects, analytics
│       ├── components/               # UI, formularios, gráficos, layout
│       ├── hooks/                    # Hooks de React Query
│       ├── lib/                      # Clientes Supabase, API, fórmula de ganancias
│       └── types/                    # Tipos TS (nombres de columnas SQL)
├── backend/                          # FastAPI (analytics, FX, export CSV/XLSX, preview)
│   ├── main.py
│   ├── requirements.txt
│   ├── render.yaml                   # Alternativa de Blueprint con raíz backend
│   ├── Dockerfile                    # Deploy opcional con contenedor
│   └── app/
│       ├── auth.py                   # Verificación JWT Supabase (HS256)
│       ├── config.py                 # Env / CORS
│       ├── deps.py                   # Auth + cliente PostgREST (JWT → RLS)
│       ├── models/schemas.py
│       ├── routers/                  # health, analytics, exports, calculations, fx
│       └── services/                 # earnings, agregación, builders de export, FX
├── supabase/
│   └── migrations/
│       ├── 20260807_initial_schema.sql
│       ├── 20260808_aht_minutes_currency_i18n.sql
│       └── 20260809_payment_status.sql
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
| `POST` | `/api/v1/calculations/preview` | Bearer | Preview de cálculo USD con conversión mostrada opcional |
| `GET` | `/api/v1/fx/rates` | No | Lista actual de `{code, rate_to_usd}` y `as_of`, `source` y `stale`; admite `refresh=true` opcional |
| `GET` | `/api/v1/fx/rate/{currency}` | No | `{currency, rate_to_usd, as_of, source, stale}` actual; admite `refresh=true` opcional |

Las agregaciones y exports usan **solo columnas snapshot** (`snapshot_aht_*`, `hourly_rate_used`) — nunca el AHT actual del proyecto. Los endpoints FX proporcionan tipos actuales para mostrar valores; no cambian los agregados ni exports canónicos en USD.
