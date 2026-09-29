# Deployment

Decision: **frontend on Vercel, everything else on a single rented VM**
(Postgres, Redis, the FastAPI API, and the ARQ worker — via Docker Compose,
same containers as local dev, just hardened). No managed Postgres/Supabase,
no serverless backend — see the reasoning in chat if you want it again, but
in short: the backend isn't just an API, it also needs a persistent Redis
and a long-running background worker (booking-expiry cron, transactional
emails), which don't fit Vercel's serverless model, and Supabase would only
ever be acting as "a Postgres host" here since none of its Auth/Storage/
client-SDK features are used — a plain VM covers the same ground with one
fewer vendor and no code changes from what's already built.

## Why a separate prod compose file

`docker-compose.yml` (repo root) is **local dev only**: it bind-mounts the
backend source for live-reload, and publishes Postgres/Redis ports to the
host for convenience (e.g. connecting a local DB client). Neither is
appropriate on a public VM — a bind-mount means anyone who can reach the
box's filesystem affects the running app, and publishing 5432/6379 exposes
the database and cache directly to the internet with only their own
(often default/weak) credentials as a barrier.

`docker-compose.prod.yml` is the hardened counterpart:
- `postgres` and `redis` have **no published ports** — reachable only from
  other containers on the compose network, never from outside the VM.
- `api` and `worker` run the **built image**, not a live source
  bind-mount, and `api` also has no published port — it's only reachable
  through the `caddy` container.
- `caddy` is new: a reverse proxy that terminates HTTPS (automatic
  Let's Encrypt certificate, zero config beyond the domain name) and
  forwards to `api` on the internal network. It's the only container
  publishing ports (80/443) to the outside world.

## One-time VM setup

1. Rent a small VM (1–2 vCPU / 2GB RAM is plenty at this traffic level) —
   Hetzner, DigitalOcean, etc. Ubuntu 22.04/24.04 is a safe default.
2. Point DNS: an **A record** for your API subdomain (e.g.
   `api.yourdomain.com`) at the VM's public IP. Caddy won't be able to get
   a certificate until this resolves.
3. Install Docker + the Compose plugin on the VM (Docker's own install
   script: `curl -fsSL https://get.docker.com | sh`).
4. Open firewall ports **22** (SSH), **80**, **443** only — nothing else
   needs to be reachable from outside (Postgres/Redis/API are internal-only
   per above).
5. Clone the repo onto the VM.
6. `cp .env.prod.example .env` at the repo root, fill in a real
   `POSTGRES_PASSWORD` and your `API_DOMAIN`.
7. `cp backend/.env.example backend/.env`, fill in real values — at
   minimum: `SECRET_KEY` (long random string), `DATABASE_URL` with the
   **same** password you just put in the root `.env`
   (`postgresql+asyncpg://runtrips:<that password>@postgres:5432/runtrips`),
   `FRONTEND_ORIGIN` set to your real Vercel URL (e.g.
   `https://yourapp.vercel.app`, or your custom domain if you attach one to
   Vercel), and the Stripe/Resend/R2/Google keys once you have them —
   the app runs without them (each integration no-ops or logs instead of
   failing), so you can deploy before every third-party account is set up.
8. `docker compose -f docker-compose.prod.yml up -d --build`. First boot
   runs `alembic upgrade head` automatically (baked into the `api`
   container's command) before starting the server.
9. Verify: `curl https://api.yourdomain.com/health` should return
   `{"status": "ok"}` with a valid certificate.

## Frontend (Vercel)

1. Import the repo into Vercel, set the **root directory to `frontend/`**
   (this is a monorepo — Vercel needs to know not to build from the repo
   root).
2. Environment variables (Vercel project settings → Environment Variables):
   - `BACKEND_URL` = `https://api.yourdomain.com` (server-only — never
     exposed to the browser; see `frontend/README.md`'s auth-proxy
     architecture for why every backend call is server-side)
   - `REVALIDATE_SECRET` = same value you'd give the backend if/when you
     wire up on-demand revalidation (see `FRONTEND_PLAN.md` §9 — not
     wired up yet, safe to set now regardless)
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`,
     `NEXT_PUBLIC_MEDIA_HOSTNAME` — same values as the backend's
     corresponding keys where applicable (Stripe/Google), safe to leave
     blank until those accounts exist (those integrations degrade
     gracefully client-side too, per `frontend/README.md`)
3. Deploy. Vercel auto-builds/deploys on every push to `main` from here on.

## Redeploying

- **Frontend**: automatic on push to `main` (Vercel's default).
- **Backend**: no auto-deploy set up. On the VM:
  ```bash
  git pull
  docker compose -f docker-compose.prod.yml up -d --build
  ```
  This rebuilds the `api`/`worker` images and re-runs migrations
  (`alembic upgrade head` runs on every `api` container start — safe to
  run repeatedly, it's a no-op once the DB is current).

## Not set up yet (flagging, not blocking)

- **Backups**: no automated Postgres backup/snapshot. A `pg_dump` cron job
  writing to R2 (or the VM host's own snapshot feature, if the provider
  has one) is the next thing to add before this holds real customer data.
- **Monitoring/alerting**: nothing beyond `docker compose logs`. Fine to
  start; revisit if uptime starts to matter more than "check it
  occasionally."
- **CI**: no automated test/build check before merge — matches
  `BACKEND_PLAN.md` §9's "no tests are included yet."
