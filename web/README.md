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
hours = (tasks_att * aht_att_sec + tasks_rev * aht_rev_sec) / 3600
earnings = hours * hourly_rate
```

- Live preview on `/logs` uses **current** project AHT + profile rate
- Stored logs always display **snapshot** fields + `calculated_earnings` from DB

## API fallback

Analytics prefers FastAPI:

- `GET /api/v1/analytics/summary`
- `GET /api/v1/exports/task-logs`

If the API is unreachable, aggregates and CSV export fall back to client-side Supabase reads (snapshot fields only).
