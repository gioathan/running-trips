# Backend Plan — Running Trips Platform

Status: planning draft. No backend code exists yet — this document defines the
target architecture before scaffolding starts.

## 1. Scope recap

A site listing organized running-race trips (e.g. "10km Madrid" with hotel and
other extras bundled in). Needs:

- Public: browse services/homepage content, browse trips (upcoming/past,
  paginated, filterable by race distance), view a trip detail + book/pay,
  contact form, newsletter signup.
- User: signup/login (email+password or Google), profile + travel details,
  "my trips" (past/upcoming bookings), booking + payment flow, contact form.
- Admin: manage everything above — trips, race categories, trip
  inclusions/extras, page content/widgets, site settings, bookings, payments,
  newsletter subscribers, contact messages, image uploads.

Everything an admin can edit must be data-driven — no hardcoded page copy.

## 2. Stack

| Concern | Choice | Why |
|---|---|---|
| API framework | FastAPI (async) | async I/O, Pydantic-native DTOs, OpenAPI for free |
| DB | PostgreSQL (Docker) | relational data (trips, bookings, categories) fits well |
| ORM | SQLAlchemy 2.0 (async) + asyncpg | mature, typed, async |
| Migrations | Alembic | standard pairing with SQLAlchemy |
| Cache/queue/locks | Redis (Docker) | rate limiting, token revocation, idempotency keys, job broker — **not** for page caching, that's Next.js's job |
| Background jobs | ARQ (async, Redis-backed) | fits the async stack better than Celery; used for emails, auto-archiving past trips, newsletter sends |
| Auth | JWT access + rotating refresh token, Google OAuth via `google-auth` | short-lived access token, revocable refresh token |
| Password hashing | passlib[argon2] | current best practice |
| Transactional email | Resend | contact form replies, verification, password reset, booking confirmations |
| Newsletter | Resend Audiences/Broadcasts | confirmed — avoids a 3rd vendor since Resend already handles contact/auth email |
| Payments | Stripe (Checkout/Payment Intents + webhooks) | best international coverage — confirmed |
| Object storage | Cloudflare R2 (S3-compatible), presigned uploads | trip images, content images |
| Settings | pydantic-settings (.env) | typed config |

Everything ships as Docker Compose services: `api`, `postgres`, `redis`, and a
`worker` (ARQ) process reusing the same image as `api`.

## 3. Design patterns / code layout

Layered, domain-modular monolith (not microservices — no need at this scale):

```
backend/
  app/
    main.py                    # FastAPI app, router include, middleware
    core/
      config.py                # pydantic-settings
      security.py              # JWT, password hashing, Google token verify
      dependencies.py          # get_db, get_current_user, require_role("admin")
      exceptions.py            # domain exceptions -> HTTP mapping
      pagination.py            # generic Page[T] schema + query params
    db/
      base.py                  # declarative base
      session.py               # async session factory
    modules/
      auth/          router.py  schemas.py  service.py
      users/         router.py  schemas.py  service.py  models.py
      race_categories/ router.py schemas.py service.py models.py
      trips/         router.py  schemas.py  service.py  repository.py  models.py
      bookings/      router.py  schemas.py  service.py  repository.py  models.py
      payments/      router.py  schemas.py  service.py  stripe_client.py  models.py
      content/       router.py  schemas.py  service.py  models.py   # CMS/page builder
      newsletter/    router.py  schemas.py  service.py  models.py
      contact/       router.py  schemas.py  service.py  models.py
      uploads/       router.py  schemas.py  service.py            # R2 presign
    workers/
      tasks.py                 # ARQ task functions
      cron.py                  # scheduled: archive past trips, digest emails
  alembic/
  tests/
  Dockerfile
docker-compose.yml
```

Per module:
- **router.py** — thin, only handles HTTP concerns + role dependency, calls
  service layer. Public and admin routes for the same resource live in the
  same module (e.g. `trips/router.py` has `GET /trips` public and
  `POST /admin/trips` behind `require_role("admin")`) — keeps domain logic
  together instead of duplicating it across a separate "admin module".
- **schemas.py** — Pydantic DTOs, split by direction: `TripCreate`,
  `TripUpdate`, `TripRead`, `TripListItem` (lighter, for paginated lists).
  Never expose ORM models directly.
- **service.py** — business logic, transaction boundaries, orchestrates
  repositories, raises domain exceptions.
- **repository.py** — SQLAlchemy queries only, no business logic. (Simple
  modules like `race_categories` can skip this and query directly in the
  service — don't force the pattern where it adds no value.)
- **models.py** — SQLAlchemy ORM models.

Cross-cutting:
- Consistent error envelope `{code, message, details}` via FastAPI exception
  handlers.
- Generic `Page[T]` response `{items, total, page, page_size}` for every
  paginated list endpoint.
- `require_role("user" | "admin")` as a FastAPI dependency, stacked on top of
  `get_current_user` (which itself decodes the JWT and 401s if missing/invalid).

## 4. Database schema

> Currency is EUR only for launch — no `currency` column needed on trips,
> bookings, or payments; amounts are integers in cents, EUR implied.
>
> Translatable entities (trips, race categories, trip inclusions, content
> sections) follow one pattern throughout: a base table holding
> locale-independent fields (ids, slugs, dates, prices, relations, sort
> order), plus a `*_translations` table holding the text fields, one row per
> `(entity_id, locale)`. See §10 for why, and for the locale resolution
> rules. `locale` is `ENUM[en, el]`.

**Identity**
- `users(id, email UNIQUE, password_hash NULLABLE, full_name, phone, role ENUM[user,admin], locale ENUM[en,el] DEFAULT 'en', email_verified BOOL, is_active BOOL, created_at, updated_at)` — `locale` is the user's preferred language, used to pick the language of transactional emails (confirmation, reset, etc.) regardless of which locale they happen to be browsing in at that moment.
- `oauth_accounts(id, user_id FK, provider ENUM[google], provider_user_id, created_at)` — separate table so email+password and Google can coexist/link cleanly.
- `refresh_tokens(id, user_id FK, token_hash, expires_at, revoked_at NULLABLE, user_agent, ip, created_at)`
- `user_travel_profiles(id, user_id FK, date_of_birth, nationality, passport_number, emergency_contact_name, emergency_contact_phone, shirt_size, extra JSONB)` — the "extra data we don't normally ask at signup but need at checkout" bucket. `extra` JSONB absorbs anything trip-specific without a migration.

**Catalog**
- `race_categories(id, slug UNIQUE, created_at)` — admin-defined, e.g. "5km", "10km", "Half Marathon". Slug is shared across locales (e.g. `10km`), not translated.
- `race_category_translations(id, race_category_id FK, locale, name)` — UNIQUE`(race_category_id, locale)`.
- `trips(id, slug UNIQUE, cover_image_url, location_city, location_country, start_date, end_date, capacity, is_full_override BOOL, status ENUM[draft,published,archived], created_at, updated_at)`
  - `is_full_override`: admin can force "Full" to display even if seats remain — per your spec, this is a display flag, not derived purely from capacity math.
  - `slug` is one shared value used under both `/en/...` and `/el/...` URLs (confirmed) — simpler schema, no per-locale uniqueness/routing complexity.
- `trip_translations(id, trip_id FK, locale, title, description RICHTEXT/markdown, meta_description)` — UNIQUE`(trip_id, locale)`.
- `trip_categories(id, trip_id FK, race_category_id FK, price, capacity NULLABLE)` — join table carrying per-category price/capacity (a trip offering both 10km and 5km can price them differently). Not translatable — race category name comes from `race_category_translations`.
- `trip_images(id, trip_id FK, url, sort_order, alt_text)` — `alt_text` only needs a translation if you care about accessibility SEO per locale; can add `trip_image_translations(image_id, locale, alt_text)` later if needed, skip for v1.
- `trip_inclusions(id, trip_id FK, icon NULLABLE, sort_order)` — the variable-length "bullets" of what's included, admin adds/removes freely.
- `trip_inclusion_translations(id, inclusion_id FK, locale, label)` — UNIQUE`(inclusion_id, locale)`.

**Booking & payment**
- `bookings(id, user_id FK, trip_id FK, trip_category_id FK, status ENUM[pending,awaiting_payment,confirmed,cancelled,refunded], participant_count, total_amount_cents, created_at, updated_at)`
- `booking_participants(id, booking_id FK, full_name, date_of_birth, nationality, passport_number, shirt_size, extra JSONB)`
- `payments(id, booking_id FK, provider ENUM[stripe], provider_ref, amount_cents, status ENUM[requires_payment,succeeded,failed,refunded], raw_payload JSONB, created_at)`

**Content / CMS (admin-configurable pages)**
- `pages(id, slug UNIQUE e.g. "home"/"services"/"contact")` — not translatable itself, just the container.
- `content_sections(id, page_id FK, type ENUM[hero,widget_list,richtext,faq,...], sort_order)` — layout/order is shared across locales; only the text inside moves per language.
- `content_section_translations(id, section_id FK, locale, data JSONB)` — the actual widget content (headings, body text, card labels, etc.) per language. Admin edit screen for a page loads both locale rows side by side.
- `site_settings(key TEXT PRIMARY KEY, value JSONB)` — for settings with user-facing text (footer copy, newsletter widget copy), `value` itself is locale-keyed, e.g. `{"en": "...", "el": "..."}`; for non-textual settings (social links, contact email) `value` is just the raw value. Simple enough not to need its own translation table.

**Engagement**
- `newsletter_subscribers(id, email UNIQUE, subscribed_at, unsubscribed_at NULLABLE, source)`
- `contact_messages(id, user_id FK, subject, message, status ENUM[new,replied,archived], created_at)`

**Ops**
- `audit_log(id, admin_user_id FK, action, entity_type, entity_id, diff JSONB, created_at)` — worth having from day one once you have an admin panel touching money and content.

## 5. API surface (by module, role-tagged)

> Locale handling: every public/user GET endpoint that returns translatable
> content resolves one locale per request (see §10) — the response is flat,
> single-language (`title`, `description`, ...), not a bag of all
> translations. Admin GET/PATCH endpoints for the same resources return and
> accept **all** locales at once (`translations: {en: {...}, el: {...}}`) so
> the admin edit form can show both languages together. Endpoint lists below
> only call this out where it isn't obvious.

Auth (`public`):
```
POST /auth/signup
POST /auth/login
POST /auth/google                 # exchange Google id_token
POST /auth/refresh
POST /auth/logout
POST /auth/verify-email
POST /auth/forgot-password
POST /auth/reset-password
```

Admin auth (`public` endpoint, `admin`-only success — separate path, per your
spec, not just a role-gated version of the endpoints above):
```
POST /admin/auth/login             # email+password only, no Google OAuth for admin
POST /admin/auth/refresh
POST /admin/auth/logout
```
Same JWT/refresh-token mechanism as §6, but a distinct route + distinct
refresh-token record type so an admin session can't be mixed up with (or
silently upgraded from) a regular user session, and so this path is easy to
keep off the public nav / lock down further later (e.g. IP allowlist) without
touching normal user auth.

Users (`user`):
```
GET   /users/me
PATCH /users/me
GET   /users/me/travel-profile
PATCH /users/me/travel-profile
GET   /users/me/bookings?status=upcoming|past   # paginated
```

Race categories (`public` read, `admin` write):
```
GET    /race-categories                    # locale-resolved name
POST   /admin/race-categories              # body includes translations: {en:{name}, el:{name}}
PATCH  /admin/race-categories/{id}
DELETE /admin/race-categories/{id}
```

Trips (`public` read, `admin` write):
```
GET    /trips?status=upcoming|past&category=10km&page=&page_size=   # paginated + filtered, locale-resolved title/description
GET    /trips/{slug}                       # locale-resolved
POST   /admin/trips                        # body includes translations: {en:{title,description,meta_description}, el:{...}}
PATCH  /admin/trips/{id}
DELETE /admin/trips/{id}
POST   /admin/trips/{id}/images
DELETE /admin/trips/{id}/images/{image_id}
POST   /admin/trips/{id}/inclusions        # translations: {en:{label}, el:{label}}
PATCH  /admin/trips/{id}/inclusions/{id}
DELETE /admin/trips/{id}/inclusions/{id}
```

Bookings & payments (`user` create, `admin` manage):
```
POST /bookings                          # creates pending booking, requires auth (frontend triggers login popup before this if not authed)
GET  /bookings/{id}
POST /payments/create-intent            # ties to a booking, returns Stripe client secret
POST /payments/webhook                  # Stripe-signed, public endpoint but signature-verified
GET  /admin/bookings?status=            # paginated
PATCH /admin/bookings/{id}
```

Content/CMS (`public` read, `admin` write):
```
GET   /content/pages/{slug}                # locale-resolved sections
PATCH /admin/content/pages/{slug}          # sections' translations for both locales in one payload
GET   /admin/site-settings
PATCH /admin/site-settings
```

Newsletter (`public`):
```
POST /newsletter/subscribe             # dedupe on email, no auth
POST /newsletter/unsubscribe           # token-based link from email
GET  /admin/newsletter/subscribers     # paginated
```

Contact (`user` only for POST — per your spec, anonymous users see the login popup instead):
```
POST /contact
GET  /admin/contact-messages
PATCH /admin/contact-messages/{id}
```

Uploads (`admin`):
```
POST /admin/uploads/presign            # returns R2 presigned PUT URL + public URL to store
```

## 6. Auth flow detail

- Access token: JWT, short-lived (~15 min), contains `sub`, `role`.
- Refresh token: opaque random value, stored **hashed** in `refresh_tokens`,
  rotated on every use, revocable (logout / "log out everywhere").
- Delivery: recommend the Next.js app proxy auth calls through its own route
  handlers (same-origin), so the refresh token can be set as an `httpOnly`,
  `Secure`, `SameSite=Lax` cookie without cross-site cookie headaches. Avoids
  storing tokens in `localStorage` (XSS risk) and avoids `SameSite=None`
  cross-domain cookie complexity if API and site end up on different domains.
- Google sign-in: frontend gets a Google `id_token` (Google Identity
  Services), POSTs it to `/auth/google`; backend verifies it server-side via
  `google-auth`, finds-or-creates the user, links an `oauth_accounts` row.
- Password reset / email verification: signed, expiring tokens, delivered via
  Resend.
- Rate limiting on `/auth/login`, `/admin/auth/login`, `/contact`,
  `/newsletter/subscribe` via Redis (sliding window per IP+email) to blunt
  brute-force/spam — `/admin/auth/login` gets the strictest limit since it's
  the highest-value target.
- Admin auth is a separate path (`/admin/auth/*`, confirmed) rather than the
  same login gated by `role=admin`: email+password only (no Google OAuth for
  the admin path), its own refresh-token record type, and no cross-mixing
  with a regular user session — a leaked/expired user session token is never
  valid against admin endpoints and vice versa.

## 7. Booking + payment flow

1. User hits a trip page, picks a category, clicks pay.
2. Frontend checks auth state — not logged in → login/signup modal first (per
   your spec), then checks if `user_travel_profiles` is complete → prompts
   for missing fields if not.
3. `POST /bookings` — creates a `pending` booking + participant rows inside
   one DB transaction; capacity check uses `SELECT ... FOR UPDATE` on the
   trip/category row to avoid two concurrent bookings overselling the last
   seat (Postgres row lock, no Redis lock needed at this scale).
4. `POST /payments/create-intent` — creates a Stripe PaymentIntent for the
   booking's total, returns `client_secret` to the frontend, which completes
   payment with Stripe.js/Elements.
5. Stripe webhook (`/payments/webhook`) is the source of truth for success —
   flips `payments.status` and `bookings.status` to `confirmed`, enqueues a
   confirmation email job. Idempotency: dedupe on Stripe event id (stored,
   checked via Redis or a unique constraint) so retried webhooks don't
   double-process.
6. A booking left `pending`/`awaiting_payment` past a TTL gets released by a
   scheduled ARQ job (frees the seat).

## 8. Background jobs (ARQ)

- Send transactional emails (verification, reset, booking confirmation,
  contact form acknowledgment) — don't block the request/response cycle.
- Nightly: flip trips whose `end_date` has passed into the "past" bucket for
  listing purposes (or compute this at query time — cheap enough that a
  stored flag isn't strictly required; simplest to just filter
  `end_date < now()` at query time rather than add a job. Mentioned here as
  the alternative if you'd rather precompute.)
- Release expired `pending` bookings back to available capacity.
- Optional: periodic newsletter digest, if you don't just trigger campaigns
  manually through Resend's dashboard.

## 9. Cross-cutting concerns

- **Pagination**: generic `Page[T]` — offset/limit is fine at this scale
  (cursor pagination is unnecessary complexity here).
- **CORS**: locked to the known frontend origin(s).
- **Validation**: Pydantic v2 schemas for all request/response bodies —
  never accept/return raw ORM objects.
- **Testing**: pytest + pytest-asyncio, a test Postgres via docker-compose
  override, factory-boy or plain fixtures for seed data.
- **Observability**: structured logging (JSON) from day one; add
  Sentry later if/when it's worth the setup cost — not needed to launch.

## 10. Internationalization (Greek + English)

Two clearly separate categories of translated text — mixing them causes most
i18n pain, so keep them apart from day one:

**A. Static UI strings** (nav labels, buttons, form labels, validation
copy, static bits of transactional emails) — these are written by devs, not
the admin, ship with a deploy, and don't need a DB round-trip.
- Frontend: Next.js message catalogs (`messages/en.json`, `messages/el.json`)
  via **next-intl**, with locale-prefixed routing (`/en/...`, `/el/...`).
  Middleware detects preferred locale (cookie, else `Accept-Language`) and
  redirects `/` to the right prefix.
- Backend: doesn't own these strings. API error responses return a stable
  `code` (e.g. `TRIP_FULL`, `INVALID_CREDENTIALS`), not a localized message —
  the frontend maps `code → localized string` via its own message catalog.
  This keeps the backend locale-agnostic for anything that isn't
  admin-authored content, and means adding a 3rd language later never touches
  backend code.

**B. Admin-authored content** (trip titles/descriptions, race category
names, trip inclusion bullets, CMS page sections, translatable site
settings) — this is exactly what §4's `*_translations` tables and
locale-keyed `site_settings.value` are for. The admin must be able to edit
both languages without a code deploy.

**Locale resolution on the API** (category B endpoints):
- Client sends `Accept-Language` (or an explicit `?locale=el` query param —
  simpler for the frontend to set explicitly based on its own route prefix
  rather than relying on header negotiation); backend normalizes to
  `en`/`el`, defaulting to `en` if missing/unsupported.
- Service layer resolves: translation row for the requested locale → else
  fallback to `en` → else any row that exists. This means a trip missing its
  Greek translation still renders (in English) instead of 404ing or showing
  blank fields — admin can be reminded/nudged in the admin UI without it
  being a hard requirement to publish.
- Admin endpoints (`/admin/...`) always return **all** locales in one
  response (`translations: {en: {...}, el: {...}}`) and accept the same
  shape on write, upserting both `*_translations` rows in a single
  transaction — one save button for both languages.

**Other locale-sensitive backend behavior**:
- Transactional emails (verification, reset, booking confirmation) are sent
  in the user's `users.locale`, not whatever locale they happened to submit
  the request from — set at signup (from the frontend's active locale),
  editable later from the profile page.
- Currency/date/number formatting is a frontend concern (`Intl`), not a
  backend one — backend deals in cents + ISO dates, EUR implied.
- Slugs are **not** translated (confirmed) — one slug per trip/page, shared
  under both `/en/...` and `/el/...`.

**SEO** (frontend concern, noted here for completeness): `<html lang>` per
route, `hreflang` alternate links between the `/en/x` and `/el/x` versions of
the same page, locale-aware sitemap. Covered in detail when we get to the
frontend plan.

## 11. Decisions locked in

- Payments: **Stripe**.
- Newsletter: **Resend Audiences/Broadcasts**.
- Admin auth: **separate path** (`/admin/auth/*`), email+password only.
- Currency: **EUR only**, no multi-currency support at launch.
- Trip/page slugs: **shared across locales**, not translated.

## 12. Next steps

Scaffold `backend/`: FastAPI app skeleton, Docker Compose with `api` +
`postgres` + `redis`, Alembic init, first migration covering the schema in
§4 (including the `*_translations` tables). Then move to the frontend
(Next.js + next-intl) plan.
