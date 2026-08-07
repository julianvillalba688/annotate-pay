# AnnotatePay API

Python FastAPI backend for analytics, CSV/Excel exports, and earnings previews.

## Stack

- Python 3.11+
- FastAPI + Uvicorn
- Pydantic v2
- httpx â†’ Supabase PostgREST (user JWT forwarded; RLS applies)
- PyJWT (HS256 with `SUPABASE_JWT_SECRET`)
- openpyxl (XLSX export)

## Earnings formula (authoritative)

```
hours = (tasks_attempter * aht_attempter_seconds + tasks_reviewer * aht_reviewer_seconds) / 3600
earnings = hours * hourly_rate
```

- AHT is in **seconds**
- Zero tasks allowed for either role
- Historical logs are **immutable snapshots** â€” aggregations/exports always use AHT/rate stored on each `task_logs` row

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
| `SUPABASE_JWT_SECRET` | JWT Secret from Supabase â†’ Project Settings â†’ API |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `PORT` | Listen port (Render sets this) |

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
| `POST` | `/api/v1/calculations/preview` | Bearer | Pure math preview |

### Analytics query params

- `project_id` (UUID, optional)
- `date_from` / `date_to` (ISO date, optional)
- `group_by`: `month` (default) | `project`

### Export query params

- `project_id`, `date_from`, `date_to`
- `format`: `csv` (default) | `xlsx`

### Preview body

```json
{
  "tasks_attempter": 10,
  "tasks_reviewer": 5,
  "aht_attempter": 60,
  "aht_reviewer": 45,
  "hourly_rate": 42.5
}
```

`aht_*` fields are seconds.

## Deploy on Render

### Option A â€” `render.yaml` (native Python)

1. Push this `backend/` folder (or monorepo root with root dir set to `backend`).
2. New â†’ Blueprint â†’ select `render.yaml`.
3. Set env vars in the Render dashboard (same as `.env.example`).
4. Free web service starts with:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Option B â€” Dockerfile

1. New Web Service â†’ connect repo â†’ Runtime: Docker.
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
| `snapshot_aht_attempter` | numeric seconds (immutable snapshot) |
| `snapshot_aht_reviewer` | numeric seconds (immutable snapshot) |
| `hourly_rate_used` | numeric (immutable snapshot from profile) |
| `calculated_earnings` | numeric (trigger-maintained) |
| `created_at` | timestamptz |

The API normalizes these into internal names (`work_date`, `aht_*_seconds`, `hourly_rate`, `earnings`) in `coerce_task_log`. Alternate aliases (`work_date`, `aht_attempter`, etc.) are also accepted if present.

Optional embed: FK `project_id → projects(id,name)` so selects can use `projects(id,name)`.

## Project layout
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
    services/
      earnings.py
      analytics_service.py
      export_service.py
```

