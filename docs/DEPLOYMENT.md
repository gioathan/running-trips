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
   minimum: `SECRET_KEY` (random, 32+ characters — the API refuses to start
   outside `ENVIRONMENT=local` with a placeholder), `ENVIRONMENT=production`,
   `PROXY_SHARED_SECRET` (required — the API refuses to start without it
   outside local dev) and `REVALIDATE_SECRET` (random values, shared with
   Vercel below), `DATABASE_URL` with the
   **same** password you just put in the root `.env`
   (`postgresql+asyncpg://runtrips:<that password>@postgres:5432/runtrips`),
   `FRONTEND_ORIGIN` set to your real Vercel URL (e.g.
   `https://yourapp.vercel.app`, or your custom domain if you attach one to
   Vercel), and the Stripe/Resend/R2/Google keys once you have them —
   the app runs without them (emails are logged instead of sent; payments
   and uploads return a clear 503), so you can deploy before every
   third-party account is set up. When you add them:
   - **Stripe**: add a webhook endpoint `https://api.yourdomain.com/payments/webhook`
     for `payment_intent.succeeded` and `payment_intent.payment_failed`, and
     put its signing secret in `STRIPE_WEBHOOK_SECRET`.
   - **R2**: set the bucket's CORS policy to allow `PUT` (with a
     `Content-Type` header) from your site's origin — admin uploads go
     straight from the browser to the bucket.
   - **Google sign-in**: a full-page redirect, not Google's embedded
     button. On the OAuth client (type "Web application") add the site's
     callback under **Authorised redirect URIs** —
     `https://yourdomain.com/api/auth/google/callback` (and
     `http://localhost:3000/api/auth/google/callback` for local dev). It must
     match `NEXT_PUBLIC_SITE_URL` exactly. No client secret is used.
   - **Resend**: verify your sending domain; set `RESEND_AUDIENCE_ID` to
     sync newsletter subscribers into an Audience.
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
   - `BACKEND_PROXY_SECRET` = the backend's `PROXY_SHARED_SECRET` (lets
     backend rate limits see the real user IP)
   - `REVALIDATE_SECRET` = the backend's `REVALIDATE_SECRET` (admin saves
     refresh the public site immediately)
   - `NEXT_PUBLIC_SITE_URL` = the public site origin, e.g.
     `https://yourdomain.com` (canonical/hreflang URLs, sitemap)
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

## Security and caching — what's in place, and what it depends on

- **Rate limits** (Redis): per endpoint and visitor IP on every auth,
  contact, booking and newsletter endpoint; per *account* on sign-in (20
  wrong passwords in 15 minutes pauses that account's sign-in); and a global
  ceiling of 300 requests/minute per visitor
  (`GLOBAL_RATE_LIMIT_PER_MINUTE`). All of it relies on the backend seeing
  the real visitor IP, which needs `PROXY_SHARED_SECRET` (backend) =
  `BACKEND_PROXY_SECRET` (Vercel). If Redis is down the limiters let
  requests through and log an error rather than taking sign-in down.
- **API surface**: interactive docs are off outside local dev; request
  bodies are capped at 1 MB (API + Caddy); responses carry security headers
  and per-user responses are `no-store`; the container runs as a non-root
  user.
- **Frontend**: a Content-Security-Policy and the usual security headers
  (`next.config.mjs`). If you add another third-party script, payment
  method or media host, it must be added to the policy there or the browser
  will block it. Cross-site requests to `/api/*` are refused, and the two
  API proxies only forward the paths the site actually uses.
- **Images**: the optimizer only loads from `NEXT_PUBLIC_MEDIA_HOSTNAME` —
  set it to your R2 media domain or images uploaded there won't display.
  Optimized images are cached for 30 days.
- **Caching**: pages render per request and are never cached by browsers
  or CDNs (they contain the signed-in header). The public data inside them
  is cached on the Next.js server for 1–5 minutes and refreshed immediately
  after an admin save (needs `REVALIDATE_SECRET` on both sides). Free-text
  trip searches are not cached.
- **After pulling dependency updates**, rebuild the images
  (`docker compose … up -d --build`) — a running container keeps the
  packages it was built with.

## Backups

The `backup` service in `docker-compose.prod.yml` runs `ops/backup.sh`: a
`pg_dump` at startup and every 24 hours after, written to `./backups` on the
VM and pruned after `BACKUP_RETENTION_DAYS` (default 14). Set the
`BACKUP_S3_*` values in the root `.env` to also copy each dump off the VM —
a backup that only lives on the VM's own disk doesn't survive losing the
VM. Use a **private** bucket (e.g. a second R2 bucket, not the public media
one) with its own access key.

- Check it's working: `docker compose -f docker-compose.prod.yml logs backup`
  should show `[backup] wrote …` (and `uploaded to …` if off-site is on).
- Take one now: `docker compose -f docker-compose.prod.yml exec backup sh /backup.sh --once`
- Restore (stops writes first, replaces the current data):
  ```bash
  docker compose -f docker-compose.prod.yml stop api worker
  docker compose -f docker-compose.prod.yml exec -T postgres \
    psql -U runtrips -d postgres -c "DROP DATABASE runtrips" -c "CREATE DATABASE runtrips OWNER runtrips"
  gunzip -c backups/runtrips-<timestamp>.sql.gz \
    | docker compose -f docker-compose.prod.yml exec -T postgres psql -U runtrips -d runtrips
  docker compose -f docker-compose.prod.yml start api worker
  ```
- Practise a restore into a scratch database once, before you need it.

## Not set up yet (flagging, not blocking)


- **Monitoring/alerting**: nothing beyond `docker compose logs`. Fine to
  start; revisit if uptime starts to matter more than "check it
  occasionally."
- **CD for the backend**: CI (`.github/workflows/ci.yml` — backend ruff +
  pytest against Postgres/Redis services, frontend typecheck/lint/build)
  runs on every push and PR, but deploying to the VM is still the manual
  `git pull && docker compose … up -d --build` above.
