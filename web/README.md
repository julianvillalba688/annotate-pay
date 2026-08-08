# AnnotatePay Web

Next.js (App Router) frontend for AnnotatePay — dark “hacker modern” earnings terminal for data annotators.

## Stack

- Next.js 14 + TypeScript + Tailwind CSS
- Supabase Auth (`@supabase/ssr` + `@supabase/supabase-js`)
- TanStack Query
- lucide-react icons
- recharts analytics
- zod (available for validation)

## Setup

```bash
cp .env.example .env.local
# fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command        | Description              |
|----------------|--------------------------|
| `npm run dev`  | Dev server               |
| `npm run build`| Production build         |
| `npm run start`| Start production server  |
| `npm run lint` | ESLint                   |

## Routes

| Path          | Access     | Description                          |
|---------------|------------|--------------------------------------|
| `/`           | public     | Redirect → dashboard or login        |
| `/login`      | public     | Email/password login + register      |
| `/dashboard`  | auth       | KPI overview + recent logs           |
| `/analytics`  | auth       | Filters, KPIs, chart, CSV export     |
| `/logs`       | auth       | Task entry + live earnings preview   |
| `/projects`   | auth       | Projects + global hourly rate        |

## Auth

- Supabase email/password via browser client
- Middleware refreshes session cookies and guards `(app)/*`
- Profile row is created by DB trigger on signup

## Earnings

```
hours = (tasks_att * aht_att_minutes + tasks_rev * aht_rev_minutes) / 60
earnings_usd = hours * hourly_rate_usd
```

- AHT is handled and stored in **minutes**.
- `global_hourly_rate`, `hourly_rate_used`, and `calculated_earnings` are canonical **USD** accounting values.
- Live preview on `/logs` uses current project AHT + the profile's USD rate.
- Stored logs always display immutable snapshot fields + `calculated_earnings` from DB.
- The shell can display current FX-converted values in USD, EUR, GBP, CAD, MXN, COP, BRL, or JPY.

## Preferences

- English is the default UI language; Spanish is available from the login screen and app shell.
- Locale and display-currency preferences are stored locally and sync to optional profile columns when available.
- FX rates come from the authenticated FastAPI `/api/v1/fx/rates` endpoint. If it is unavailable, the UI remains in USD and shows a non-blocking fallback status.

## API fallback

Analytics prefers FastAPI:

- `GET /api/v1/analytics/summary`
- `GET /api/v1/exports/task-logs`

If the API is unreachable, aggregates and CSV export fall back to client-side Supabase reads (snapshot fields only).
