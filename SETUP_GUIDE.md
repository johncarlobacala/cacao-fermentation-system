# Cacao Fermentation Monitor — Setup Guide

## What's in this zip (Phase 1 — done and working)
- Full Supabase auth: **Login, Forgot password, Reset password, Email verification**
- Middleware that protects every route, auto-redirects by role, and stops farmers
  from wandering into `/admin/*` (and vice versa)
- **Admin sidebar + Dashboard** — real stat cards, temperature trend chart, recent
  alerts, upcoming turnings, recently completed batches — all pulled live from Supabase
- **Farmer sidebar + Dashboard** — current batch, live countdown to next turning,
  live temperature reading with in-range/out-of-range badge, alert banner
- **Admin → Create account** — fully working: creates the farmer's login via the
  Supabase Admin API and sends them a verification email
- Every other sidebar item (Farms, Batches, Sensors, Reports, Analytics, Settings,
  etc.) exists as a real route with a "scaffolded, ready to build" placeholder —
  so nothing 404s and every link in the sidebar works today

## What's NOT built yet (Phase 2 — say the word and we do these next, one at a time)
Farms CRUD, Batches CRUD + turning schedule logic, Sensors table, Alerts
resolve-flow, Reports (PDF/CSV export), Analytics charts, Notifications feed,
Settings form, Farmer's "My farm"/"My reports"/Help pages.

I deliberately didn't try to fake-finish all of these in one shot — a real
production system this size is genuinely a multi-session build, and dumping
50 unfinished pages "complete" would just hide bugs instead of avoiding them.
The foundation above (auth + both dashboards + the hardest wiring: middleware,
role-based routing, admin user creation) is the part most likely to break if
rushed, so that's what's solid right now.

## 1. Copy files into your existing project
You already have a Next.js project (`cacao-system`) open in VS Code. Copy every
folder/file from this zip into it, **merging** with what's already there:

```
your-project/
├── app/
│   ├── globals.css          ← REPLACE your existing one
│   ├── layout.tsx           ← REPLACE (or merge metadata into your own)
│   ├── page.tsx             ← REPLACE
│   ├── login/
│   ├── forgot-password/
│   ├── reset-password/
│   ├── email-verified/
│   ├── auth/confirm/
│   ├── api/admin/create-farmer/
│   ├── admin/               ← whole folder is new
│   └── farmer/              ← whole folder is new
├── components/
│   ├── admin/
│   ├── farmer/
│   └── ui/
├── lib/
│   ├── supabase/
│   └── types/
├── middleware.ts             ← put at project ROOT (same level as package.json)
└── .env.local.example
```

## 2. Install the two packages this needs
```bash
npm install @supabase/supabase-js @supabase/ssr
```

## 3. Set up your environment variables
Copy `.env.local.example` → `.env.local` (already filled in with your project
URL and anon key). Then add your **service role key**:
Supabase Dashboard → Project Settings → API → `service_role` secret →
paste into `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
⚠️ Never commit `.env.local` or expose the service role key to the browser.

## 4. Run the database schema
In Supabase Dashboard → SQL Editor, run your `database_schema.sql` (the one you
uploaded) if you haven't already — all the queries in this code assume those
exact tables/columns/RLS policies exist.

## 5. Supabase Auth dashboard settings (important!)
Go to **Authentication → URL Configuration**:
- Site URL: `http://localhost:3000` (change to your real domain later)
- Redirect URLs: add `http://localhost:3000/auth/confirm`

Go to **Authentication → Providers → Email**: since there's no public sign-up,
you don't need to touch this — accounts are only ever created through
`/admin/users/create`, which uses the service role key server-side.

## 6. Create your first admin manually (one-time only)
Since admins aren't created through the app UI, make your first one directly:
1. Supabase Dashboard → Authentication → Users → **Add user** → enter your
   admin email + password → check "Auto Confirm User"
2. Supabase Dashboard → Table Editor → `profiles` table → find the row that
   was just auto-created → change its `role` column from `farmer` to `admin`

After that, log in at `/login` with that email/password — you'll land on
`/admin/dashboard`.

## 6.5 Quick check: the `@/` import alias
All the code here imports things like `@/lib/supabase/client`. Open your
`tsconfig.json` and confirm it has this (Next.js adds it by default when you
scaffold a project, so it's very likely already there):
```json
"paths": { "@/*": ["./*"] }
```

## 7. Run it
```bash
npm run dev
```
Visit `http://localhost:3000` — it'll bounce you to `/login` automatically.

## How the pieces connect (the "flow")
1. `middleware.ts` runs on every request → refreshes the Supabase session
   cookie → checks if you're logged in → checks your `role` → sends you to
   the right place.
2. `lib/supabase/client.ts` = for Client Components (`"use client"`, like the
   login form). `lib/supabase/server.ts` = for Server Components/Route
   Handlers (like the dashboards, which fetch data server-side for speed).
   `lib/supabase/admin.ts` = service-role only, used once, only inside
   `/api/admin/create-farmer`.
3. Each dashboard page is a **Server Component** — it queries Supabase
   directly in the component function (no separate API call needed) and
   renders real numbers.
4. Sidebars (`components/admin/AdminSidebar.tsx`,
   `components/farmer/FarmerSidebar.tsx`) are Client Components so they can
   highlight the active link and handle the Logout button.

## Next step
Tell me which module to build next (Farms, Batches + turning logic, Sensors,
Reports/export, Analytics, or Notifications) and I'll wire that one up fully
against your schema next, the same way the dashboards are done now.
