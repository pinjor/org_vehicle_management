# Vehicle Management System

Enterprise vehicle request, dispatch, and fleet operations app for organizations that run their own vehicles and drivers.

Product UI name: **Vehicle Management System**. Original product brief / master prompt lives in [`PROJECT_PROMPT.md`](./PROJECT_PROMPT.md). Session work log: [`../PROJECT_LOG.md`](../PROJECT_LOG.md).

## Stack

- **App:** TanStack Start (React) + Vite + Tailwind + Radix UI
- **API:** Hono handlers in `src/server/api.ts`
- **DB:** PostgreSQL 16 (Docker) — schema/migrations under `supabase/migrations` + `database/`
- **Cache:** Redis 7 (Docker)
- **Maps:** Leaflet + OpenStreetMap tiles + OSRM routing (in-app)

## Quick start (Docker)

```bash
cd org_vehicle_management
npm run docker:up
```

App: [https://vms.apptriangle.com](https://vms.apptriangle.com/) (production)  
Local Docker: [http://localhost:3000](http://localhost:3000)  
Postgres: `localhost:5433` · Redis: `localhost:6379`

```bash
npm run docker:logs    # follow app logs
npm run docker:down    # stop
npm run docker:reset   # wipe volumes and rebuild
```

## Local dev (optional)

```bash
npm run db:up          # postgres only
npm run db:init        # apply schema / patches
npm run db:seed        # starter data
npm install
npm run dev
```

Set `DATABASE_URL`, `REDIS_URL`, and `JWT_SECRET` as needed (see `docker-compose.yml` for Docker defaults).

## Roles

| Role | What they do |
|------|----------------|
| **Employee** | Request rides, track request/trip status |
| **Driver** | See assignments, navigate in-app, advance trip lifecycle |
| **Dispatch / transport admin** | Queue, assign vehicle+driver, live trips, fleet/drivers, trip history |
| **System admin** | User roster, lookups, settings |

Auth is **Bangladesh phone + password** (roster-gated signup). Drivers default UI language to **বাংলা** (toggle in profile / account menu; preference does not leak to other roles).

## Main routes

| Path | Audience |
|------|----------|
| `/auth` | Sign in / create account |
| `/dashboard` | Role home |
| `/requests`, `/requests/new`, `/requests/$id` | Employee (+ admin view) |
| `/my-trips`, `/my-trips/$tripId` | Driver list + trip detail (map, pathway, actions) |
| `/trips` | Admin: KPIs + pending queue, live, completed trips (`/dispatch` redirects here) |
| `/fleet`, `/drivers`, `/maintenance` | Ops |
| `/profile` | Account (driver layout includes language) |
| `/admin/*` | Roster, employees, settings |

## Notable product features

- Multi-stop / round-trip vehicle requests
- Ranked vehicle+driver recommendations + assignment
- Full trip state machine (`advance_trip`) with GPS pings + live map pathway
- Driver portal: preview cards → trip detail; in-app Navigate (no OSM redirect)
- Admin: trips board (KPIs + pending/live/completed)
- Shared status screens for load errors / 404
- Configurable lookups (statuses, categories, etc.)

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run docker:up` | Build & start app + postgres + redis |
| `npm run build` | Production build |
| `npm run lint` / `format` | ESLint / Prettier |
| `npm run db:init` / `db:seed` / `db:clean` | DB helpers (host port 5433) |

## Project layout (short)

```
org_vehicle_management/
  src/routes/          # TanStack file routes
  src/components/      # UI + fleet/map panels
  src/lib/             # auth, i18n, queries, fleet helpers
  src/server/          # Hono API, DB, Redis
  database/            # local SQL patches / init
  supabase/migrations/ # schema migrations
  docker-compose.yml
```

## Contributing notes

- Prefer matching existing UI patterns in `styles.css` and `fleet-ui`.
- Keep `PROJECT_LOG.md` updated after finished task batches.
- Do not commit secrets (`.env`, credentials).
