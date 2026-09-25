# Running Trips — Frontend

Next.js (App Router) + next-intl + Tailwind, per `docs/FRONTEND_PLAN.md` and
`docs/DESIGN_SYSTEM.md` at the repo root. Read those first — this README is
"how to run it" plus what changed during the build.

## Local development

```bash
cp frontend/.env.example frontend/.env.local
# BACKEND_URL should point at the FastAPI service (http://api:8000 in
# docker-compose, http://localhost:8000 if running the backend bare)

cd frontend
npm install
npm run dev
```

Runs against the backend from `docs/BACKEND_PLAN.md`. Start that first
(`docker compose up` at the repo root covers `api` + `postgres` + `redis`);
this app doesn't have its own database.

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

Public, cacheable reads (trip listings, CMS pages) do **not** go through
either proxy — they're plain `backendFetch` calls from Server Components
with Next's `next: { revalidate }`, so Next's own fetch cache/ISR actually
applies. See `BACKEND_PLAN.md`'s Next.js caching split for the reasoning.

## What's implemented vs. simplified vs. stubbed

**Fully implemented**: the whole public site (Home, Destinations with
filters/search/pagination, Trip detail, Services, Contact), the full
booking + Stripe payment flow, auth (email/password + Google, remember me,
forgot/reset password, email verification, newsletter unsubscribe), account
pages (My Trips, profile — both basic info and travel profile), and an
admin dashboard with working Trips CRUD (including images/inclusions),
Bookings, Newsletter, and Contact Messages screens.

**Simplified from the original plan, on purpose**:
- **Distance filter is single-select, not multi-select.** The Figma
  reference showed multi-select pills, but the backend's
  `GET /trips?category=` only accepts one slug. Built single-select to
  match what the API actually supports rather than fake multi-select
  client-side; extending the backend to accept repeated `category=` params
  (OR'd) would be the way to add real multi-select later.
- **Checkout collects a reduced participant field set**: full name,
  nationality, shirt size. The backend's `booking_participants` also
  supports date of birth, passport number, and an open `extra` JSONB bag —
  left out of the form to keep checkout short; add fields to
  `components/site/CheckoutModal.tsx`'s `ParticipantForm` as needed.
- **Admin image management is a URL-paste field, not a real upload
  widget.** The backend's presigned-upload flow
  (`POST /admin/uploads/presign`) exists and works, but
  `TripImagesManager` doesn't yet call it — admin uploads to R2 by some
  other means and pastes the resulting public URL. Wiring an actual
  `<input type="file">` → presign → PUT-to-R2 → save-URL flow is the next
  step here.

**Left as stubs** (admin sidebar links that render a "not built yet" panel
naming exactly what backend endpoint to build against): Race Categories,
Content Pages, Site Settings — all have working backend CRUD, just no
frontend yet; build them the same way as `components/admin/TripForm.tsx`
(the EN/EL tab pattern). Payments has **no** backend list endpoint yet
(`payments/router.py` only has create-intent, get-by-id, and the
webhook) — add `GET /admin/payments` before building that page.

**Backend gap found and fixed while integrating**: admin access tokens
couldn't fetch their own profile (`GET /users/me` is gated to `role=user`
only) — added `GET /admin/auth/me` to `admin_auth/router.py`. See
`backend/README.md`.

## Verification note

Same constraint as the backend: this sandbox's network policy blocks
npm/PyPI, so nothing here could actually be `npm install`ed or run live.
What was verified instead:
- Every `.ts`/`.tsx` file's syntax, via the TypeScript compiler API's
  `getSyntacticDiagnostics` directly (no `node_modules` needed for this —
  it's pure parsing, not type resolution).
- A custom unused-import sweep across the whole `src/` tree (same
  approach as the backend's Python check) — zero findings on both.
- The `messages/en.json` and `messages/el.json` key sets were
  cross-checked programmatically against each other (identical key
  structure, verified via a script, not by eye) and against every
  `useTranslations`/`getTranslations` call site in the code.

What this does **not** catch: real TypeScript type errors (needs the
actual `react`/`next`/etc. type packages, unavailable here), and of course
anything you'd only see at runtime — actual rendering, the real Stripe
Elements flow, real Google Sign-In. Run `npm install && npm run dev`
(and `npm run typecheck`) in an environment with normal internet access
to do that pass — it's the one step I couldn't complete myself here.
