# AnnotatePay API

Python FastAPI backend for analytics, CSV/Excel exports, and earnings previews.

## Stack

- Python 3.11+
- FastAPI + Uvicorn
- Pydantic v2
- httpx → Supabase PostgREST (user JWT forwarded; RLS applies) and Frankfurter FX
- PyJWT (HS256 with `SUPABASE_JWT_SECRET`)
- openpyxl (XLSX export)

## Earnings formula (authoritative)

```
hours = (tasks_attempter * aht_attempter_minutes + tasks_reviewer * aht_reviewer_minutes) / 60
earnings = hours * hourly_rate
rate_per_task = (aht_minutes / 60) * hourly_rate
```

- AHT is in **minutes**
- `hourly_rate`, `earnings`, and `earnings_usd` are canonical **USD** values
- Zero tasks allowed for either role
- Historical logs are **immutable snapshots** — aggregations/exports always use AHT/rate stored on each `task_logs` row

## Foreign exchange

Rates from [Frankfurter](https://www.frankfurter.app/) (free, no API key):

- `rate_to_usd` = USD value of **1 unit** of the target currency
- To display a USD amount in a target currency, divide the USD amount by `rate_to_usd`
- The rates list includes USD, EUR, GBP, CAD, MXN, COP, BRL, AUD, and JPY
- In-memory cache: 6 hours
- USD → `1.0`
- Provider failure or an unavailable requested rate → HTTP 503
- The service uses Frankfurter first and a no-key provider only for currencies Frankfurter does not publish (currently COP)

## Setup

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# edit .env with Supabase values
```

### Environment

| Variable | Description |
|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Project anon/public key |
| `SUPABASE_JWT_SECRET` | JWT Secret from Supabase → Project Settings → API |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `PORT` | Listen port (Render sets this) |

No FX API key required.

## Run locally

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- Health: http://localhost:8000/health  
- OpenAPI: http://localhost:8000/docs  

## Auth (JWT)

1. Frontend signs in with Supabase Auth and obtains an **access token**.
2. Client sends `Authorization: Bearer <access_token>` on API calls.
3. Backend validates the JWT with `SUPABASE_JWT_SECRET` (HS256, audience `authenticated`).
4. `sub` claim becomes `user_id`.
5. The **same user JWT** is forwarded to Supabase REST (`/rest/v1/task_logs`) with the anon key as `apikey`, so **RLS** enforces per-user isolation. No service-role key is required for these routes.

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | No | `{ "status": "ok" }` |
| `GET` | `/api/v1/analytics/summary` | Bearer | KPIs + series (`group_by=month\|project`) |
| `GET` | `/api/v1/exports/task-logs` | Bearer | Download CSV or XLSX |
| `POST` | `/api/v1/calculations/preview` | Bearer | USD math preview plus optional display conversion |
| `GET` | `/api/v1/fx/rates?base=USD` | No | Current list of `{code, rate_to_usd}` plus `as_of` |
| `GET` | `/api/v1/fx/rate/{currency}` | No | `{currency, rate_to_usd, as_of}` |

### Analytics query params

- `project_id` (UUID, optional)
- `date_from` / `date_to` (ISO date, optional)
- `group_by`: `month` (default) | `project`

### Export query params

- `project_id`, `date_from`, `date_to`
- `format`: `csv` (default) | `xlsx`

Export columns include `aht_*_minutes`, `hourly_rate`, `earnings_usd`,
`currency_code`, and `fx_rate_to_usd`. `hourly_rate` and `earnings_usd` are
USD; the FX column is metadata and is never used to rewrite those values.

### Preview body

```json
{
  "tasks_attempter": 10,
  "tasks_reviewer": 5,
  "aht_attempter": 1.0,
  "aht_reviewer": 0.75,
  "hourly_rate": 42.5,
  "currency": "EUR"
}
```

`aht_*` fields are **minutes**. The response includes canonical
`earnings`/`earnings_usd` plus `display_currency`/`display_earnings` and
`rate_to_usd` (`currency`/`fx_rate_to_usd` remain compatibility names).

The response's `earnings` and `earnings_usd` fields are always USD. The
backward-compatible request field `currency` selects `display_currency`; the
converted amount is `display_earnings = earnings_usd / rate_to_usd`. The
hourly rate and per-task rates remain USD.

### FX examples

```bash
curl -s "http://localhost:8000/api/v1/fx/rates?base=USD"
curl -s "http://localhost:8000/api/v1/fx/rate/EUR"
```

## Deploy on Render

### Option A — `render.yaml` (native Python)

1. Push this `backend/` folder (or monorepo root with root dir set to `backend`).
2. New → Blueprint → select `render.yaml`.
3. Set env vars in the Render dashboard (same as `.env.example`).
4. Free web service starts with:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Option B — Dockerfile

1. New Web Service → connect repo → Runtime: Docker.
2. Dockerfile path: `backend/Dockerfile` (or repo root if only backend is pushed).
3. Set the same env vars. `PORT` is injected by Render.

### CORS

Set `ALLOWED_ORIGINS` to your Next.js origin(s), e.g.:

```
https://your-app.vercel.app,http://localhost:3000
```

## Expected Supabase table shape (`task_logs`)

Canonical columns from `supabase/migrations/20260807_initial_schema.sql`:

| Column | Notes |
|---|---|
| `id` | UUID |
| `user_id` | UUID (RLS) |
| `project_id` | UUID FK → projects |
| `date` | work date (API filters/orders on this column) |
| `tasks_attempter` | int |
| `tasks_reviewer` | int |
| `snapshot_aht_attempter` | numeric **minutes** (immutable snapshot) |
| `snapshot_aht_reviewer` | numeric **minutes** (immutable snapshot) |
| `hourly_rate_used` | numeric **USD** (immutable snapshot from profile) |
| `calculated_earnings` | numeric **USD** (trigger-maintained) |
| `calculated_earnings_usd` | numeric **USD** (canonical export snapshot) |
| `currency_code` | `USD` accounting metadata |
| `fx_rate_to_usd` | accounting FX metadata; canonical USD rows use `1` |
| `created_at` | timestamptz |

The initial schema stored AHT in seconds, but
`20260808_aht_minutes_currency_i18n.sql` converts existing snapshots once and
records `app_meta.aht_unit = minutes`. If the initial schema was applied
manually, run this follow-up SQL once in the Supabase SQL Editor. The
`aht_unit` guard prevents a second conversion. The backend assumes that
follow-up migration has been applied and maps only the converted SQL snapshot fields;
it does not guess whether arbitrary legacy AHT names are minutes or seconds.
Rows without `calculated_earnings_usd` use `calculated_earnings` as USD; a
partially backfilled zero uses a positive `calculated_earnings` value instead.

The API normalizes these into internal names (`work_date`,
`aht_*_minutes`, `hourly_rate`, `earnings_usd`) in `coerce_task_log`.

Optional embed: FK `project_id → projects(id,name)` so selects can use `projects(id,name)`.

## Project layout

```
backend/
  main.py
  requirements.txt
  render.yaml
  Dockerfile
  .env.example
  README.md
  app/
    config.py
    auth.py
    deps.py
    models/schemas.py
    routers/
      health.py
      analytics.py
      exports.py
      calculations.py
      fx.py
    services/
      earnings.py
      analytics_service.py
      export_service.py
      fx.py
```
