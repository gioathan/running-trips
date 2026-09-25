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
| Newsletter | Resend Audiences/Broadcasts (or Brevo free tier as fallback) | avoid a 3rd vendor if Resend's tier covers it |
| Payments | Stripe (Checkout/Payment Intents + webhooks) | best international coverage — **confirm this is the provider you want** |
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

**Identity**
- `users(id, email UNIQUE, password_hash NULLABLE, full_name, phone, role ENUM[user,admin], email_verified BOOL, is_active BOOL, created_at, updated_at)`
- `oauth_accounts(id, user_id FK, provider ENUM[google], provider_user_id, created_at)` — separate table so email+password and Google can coexist/link cleanly.
- `refresh_tokens(id, user_id FK, token_hash, expires_at, revoked_at NULLABLE, user_agent, ip, created_at)`
- `user_travel_profiles(id, user_id FK, date_of_birth, nationality, passport_number, emergency_contact_name, emergency_contact_phone, shirt_size, extra JSONB)` — the "extra data we don't normally ask at signup but need at checkout" bucket. `extra` JSONB absorbs anything trip-specific without a migration.

**Catalog**
- `race_categories(id, name, slug UNIQUE, created_at)` — admin-defined, e.g. "5km", "10km", "Half Marathon".
- `trips(id, title, slug UNIQUE, description RICHTEXT/markdown, cover_image_url, location_city, location_country, start_date, end_date, base_currency, capacity, is_full_override BOOL, status ENUM[draft,published,archived], created_at, updated_at)`
  - `is_full_override`: admin can force "Full" to display even if seats remain — per your spec, this is a display flag, not derived purely from capacity math.
- `trip_categories(id, trip_id FK, race_category_id FK, price, capacity NULLABLE)` — join table carrying per-category price/capacity (a trip offering both 10km and 5km can price them differently).
- `trip_images(id, trip_id FK, url, sort_order, alt_text)`
- `trip_inclusions(id, trip_id FK, label, icon NULLABLE, sort_order)` — the variable-length "bullets" of what's included, admin adds/removes freely.

**Booking & payment**
- `bookings(id, user_id FK, trip_id FK, trip_category_id FK, status ENUM[pending,awaiting_payment,confirmed,cancelled,refunded], participant_count, total_amount, currency, created_at, updated_at)`
- `booking_participants(id, booking_id FK, full_name, date_of_birth, nationality, passport_number, shirt_size, extra JSONB)`
- `payments(id, booking_id FK, provider ENUM[stripe], provider_ref, amount, currency, status ENUM[requires_payment,succeeded,failed,refunded], raw_payload JSONB, created_at)`

**Content / CMS (admin-configurable pages)**
- `pages(id, slug UNIQUE e.g. "home"/"services"/"contact", title, meta_description)`
- `content_sections(id, page_id FK, type ENUM[hero,widget_list,richtext,faq,...], sort_order, data JSONB)` — a lightweight page-builder: each section's shape lives in `data` (JSON), so admin can add/reorder/reconfigure widgets (services page cards, homepage hero, etc.) without a schema migration per content change.
- `site_settings(key TEXT PRIMARY KEY, value JSONB)` — footer text, social links, newsletter widget copy, contact page intro, etc.

**Engagement**
- `newsletter_subscribers(id, email UNIQUE, subscribed_at, unsubscribed_at NULLABLE, source)`
- `contact_messages(id, user_id FK, subject, message, status ENUM[new,replied,archived], created_at)`

**Ops**
- `audit_log(id, admin_user_id FK, action, entity_type, entity_id, diff JSONB, created_at)` — worth having from day one once you have an admin panel touching money and content.

## 5. API surface (by module, role-tagged)

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
GET    /race-categories
POST   /admin/race-categories
PATCH  /admin/race-categories/{id}
DELETE /admin/race-categories/{id}
```

Trips (`public` read, `admin` write):
```
GET    /trips?status=upcoming|past&category=10km&page=&page_size=   # paginated + filtered
GET    /trips/{slug}
POST   /admin/trips
PATCH  /admin/trips/{id}
DELETE /admin/trips/{id}
POST   /admin/trips/{id}/images
DELETE /admin/trips/{id}/images/{image_id}
POST   /admin/trips/{id}/inclusions
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
GET   /content/pages/{slug}
PATCH /admin/content/pages/{slug}
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
- Rate limiting on `/auth/login`, `/contact`, `/newsletter/subscribe` via
  Redis (sliding window per IP+email) to blunt brute-force/spam.

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

## 10. Open questions for you

1. **Payments provider** — confirming Stripe, or did you have another in mind?
2. **Newsletter** — OK to go with Resend Audiences (same vendor as contact
   email) rather than a dedicated ESP like Brevo?
3. Do you want admin auth to be the *same* login (gated by `role=admin`) or a
   fully separate admin login path? Plan above assumes the former (simpler,
   still secure since it's role-gated).
4. Any requirement to support multiple currencies per trip, or is one
   currency per trip (e.g. EUR) enough for launch?

## 11. Next steps

Once the above is confirmed: scaffold `backend/` (FastAPI app skeleton,
Docker Compose with `api` + `postgres` + `redis`, Alembic init, first
migration for the schema above), then move to the frontend (Next.js) plan.
