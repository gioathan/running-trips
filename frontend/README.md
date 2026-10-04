# Running Trips — Frontend

Next.js (App Router) + next-intl + Tailwind, per `docs/FRONTEND_PLAN.md` and
`docs/DESIGN_SYSTEM.md` at the repo root. Read those first — this README is
"how to run it" plus what changed during the build.

## Local development

```bash
cp frontend/.env.example frontend/.env.local
# BACKEND_URL=http://localhost:8000 — this dev server runs on the host,
# not inside the docker-compose network, so use the port docker-compose.yml
# publishes to the host, not the internal service name (`api`) that only
# resolves *between* containers.

cd frontend
npm install
npm run dev
```

Runs against the backend from `docs/BACKEND_PLAN.md`. Start that first
(`docker compose up` at the repo root covers `api` + `postgres` + `redis`);
this app doesn't have its own database.

For production (Vercel), see `docs/DEPLOYMENT.md`.

## Auth architecture (why there are two proxy routes)

Per `BACKEND_PLAN.md` §6, the browser never sees an access or refresh
token — both live in `httpOnly` cookies set by this app's own Route
Handlers, not by the backend directly:

- `/api/auth/*` and `/api/admin-auth/*` — login/signup/logout/session
  endpoints. Each sets `httpOnly` cookies on success.
- `/api/backend/[...path]` and `/api/admin-backend/[...path]` — generic
  same-origin proxies. Every authenticated client-side call
  (`apiFetch`/`adminApiFetch` in `lib/api.ts`) goes through one of these,
  which reads the relevant `httpOnly` cookie server-side, attaches
  `Authorization: Bearer`, forwards the request, and transparently
  refreshes once on a 401 before retrying.

Two full copies of this (user vs. admin) rather than one parameterized
version, deliberately — mirrors the backend's own separate
`refresh_tokens`/`admin_refresh_tokens` tables: a leaked or expired user
session can never be valid against an admin endpoint or vice versa.

**Session refresh happens in `src/middleware.ts`, never during render.**
Server Components can read cookies but not set them, so refreshing there
would rotate the refresh token on the backend and throw the new one away.
The middleware refreshes an expiring access token before the page renders,
writes the new cookies onto both the response and the in-flight request (so
the render sees them), and clears them if the refresh token is dead. The
`/api/*` proxies still refresh on their own after a 401. The backend accepts
a just-rotated refresh token for 30 seconds, so parallel requests carrying
the same cookie don't log the user out.

Every proxied call also forwards the browser's IP (`X-Client-IP`) together
with `BACKEND_PROXY_SECRET`, so the backend's per-IP rate limits apply per
user rather than to this server as a whole.

Public, cacheable reads (trip listings, CMS pages) do **not** go through
either proxy — they're plain `backendFetch` calls from Server Components
with Next's `next: { revalidate }`, so Next's own fetch cache/ISR actually
applies. See `BACKEND_PLAN.md`'s Next.js caching split for the reasoning.

## What's implemented vs. simplified

**Implemented**: the whole public site (Home, Destinations with
filters/search/pagination, Trip detail with runners' comments, Services,
Contact), the booking + Stripe payment flow, auth (email/password + Google,
remember me, forgot/reset password, email verification, newsletter
unsubscribe), account pages, and the full admin dashboard: Trips (with R2
image uploads), Race Categories, Content Pages, Site Settings, Bookings,
Payments (with refunds), Newsletter, Contact Messages, Trip Comments.

SEO: per-page titles/descriptions (`seo` namespace in the message catalogs),
canonical + `hreflang` alternates between `/en` and `/el`, Open Graph data
for trips, `sitemap.xml` (static pages + every published trip) and
`robots.txt`. Absolute URLs come from `NEXT_PUBLIC_SITE_URL`.

**Simplified from the original plan, on purpose**:
- **Distance filter is single-select, not multi-select.** The backend's
  `GET /trips?category=` only accepts one slug; extending it to accept
  repeated `category=` params (OR'd) would be the way to add multi-select.
- **Checkout collects a reduced participant field set**: full name,
  nationality, shirt size (participant 1 prefilled from the user's name and
  saved travel profile). Add fields to
  `components/site/CheckoutModal.tsx`'s `ParticipantForm` as needed.
- **Every public page renders per request**, because the layout reads the
  session cookie to render the header. Backend data fetches inside those
  renders are still cached (`next: { revalidate }`) and dropped on admin
  saves via `/api/revalidate`, so the API isn't hit on every view.

## Verification

`npm run typecheck`, `npm run lint` and `npm run build` pass (and run in CI,
`.github/workflows/ci.yml`). The session
refresh, proxies, SEO output, admin screens and on-demand revalidation have
been exercised end-to-end against the real backend (production build +
uvicorn + ARQ worker + Postgres/Redis). Not yet exercised: a real Stripe
payment (needs keys + `stripe listen`), real Google Sign-In, and real R2
uploads (needs a bucket with CORS allowing `PUT` from the site's origin).
