# Frontend Plan — Running Trips Platform

Status: **implemented** — `frontend/` matches this document (see
`frontend/README.md` for setup, the auth-proxy architecture, and
verification notes). Originally informed by the Figma templates (file
`KD9K5ul4JXrKAtijVk4xPj`) and `docs/DESIGN_SYSTEM.md`. Pairs with
`docs/BACKEND_PLAN.md`. A few sections below were amended after
implementation surfaced gaps or simplifications not caught during planning
— same approach as the backend plan's own reconciliation pass.

## 1. What the Figma file covers vs. what we design fresh

Provided (desktop + mobile): **Home**, **Destinations** (trip listing),
**Services** (two layout variants), **Contact**, a **Login/Signup modal**,
plus shared **Header**, **Footer**, and a 5-tab **mobile bottom nav**.

Not in the file — designed here, reusing the same tokens/components:
**Trip detail/booking page**, **My Trips** (user dashboard), **Admin
dashboard**, forgot/reset-password screens, verify-email screen.

All copy in the file is placeholder ("AALOY" / "Travel Beyond The Finish
Lines") — treated as structural reference, not real content. **Real brand
name: ΑΛΛΟΥ.** Two logo assets incoming (full + a small mark, the latter
used in most placements) — see §5 for where each is used; no plan changes
needed once the files land, they just slot into the header/footer/admin
sidebar components.

## 2. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router, TypeScript) | SSR/ISR for content pages, matches backend plan's caching split |
| i18n | next-intl | locale-prefixed routing (`/en`, `/el`), confirmed approach |
| Styling | Tailwind CSS | maps 1:1 to the token table in `DESIGN_SYSTEM.md` |
| Component base | Radix UI primitives (`@radix-ui/react-*`) restyled to tokens | gets accessible primitives (dialog, select, tabs, accordion, checkbox) for free instead of hand-building the login modal, filter dropdown, FAQ accordion, etc. — visual layer is fully overridden by our tokens, so it doesn't fight the editorial look. Shipped as **Radix directly**, not the shadcn CLI, since shadcn's `init`/`add` generator needs npm registry access to scaffold its wrapper files — functionally the same outcome (shadcn's own components are Radix + Tailwind under the hood), just without its specific file-generation step. |
| Forms | react-hook-form + zod | matches the field-heavy contact/booking/admin forms |
| Server state | Next.js fetch cache (public content) + a thin fetch wrapper; no client cache library needed for a site this size (no React Query) | avoids a dependency the traffic level doesn't justify |
| Payments UI | Stripe.js + Elements | pairs with backend's PaymentIntent flow |
| Auth cookie handling | Next.js Route Handlers proxy `/api/*` → FastAPI, same-origin | per backend plan §6 — keeps refresh token `httpOnly` without cross-site cookie issues. Implemented as **two** parallel proxy pairs (`/api/auth/*` + `/api/backend/*` for users, `/api/admin-auth/*` + `/api/admin-backend/*` for admin) rather than one — see `frontend/README.md`'s "Auth architecture" section for why: it mirrors the backend's own separate refresh-token tables so a user session can never be valid against an admin endpoint. |

## 3. Design system

See `docs/DESIGN_SYSTEM.md` for the full token table, component specs, and
a starter Tailwind config. Summary: light editorial canvas (`#E6E6E6`) with
white cards, ink-black (`#14161A`) type/borders, lilac (`#D686EA`) primary
actions, volt (`#D4FF3F`) highlight actions — and the footer is the one
deliberately dark surface on the site.

## 4. Routing structure

```
/[locale]/                         Home
/[locale]/trips                    Destinations (listing)
/[locale]/trips/[slug]              Trip detail + booking
/[locale]/services                 Services
/[locale]/contact                  Contact
/[locale]/account                  My Trips (auth required)
/[locale]/account/profile          Profile + travel details (auth required)
/[locale]/forgot-password
/[locale]/reset-password
/[locale]/verify-email
/[locale]/newsletter/unsubscribe   token-link landing page — not in the original list, but needed as the target of the unsubscribe email link
/admin/login                       separate path, no locale prefix (internal tool)
/admin/...                         admin dashboard (see §8)
```

Login/Signup is a **modal**, not a route (per the Figma modal + your spec:
opens over whatever page triggered it — booking CTA, contact form for an
unauthenticated user, or a header "Log in" link). Implemented as a
parallel/intercepting route or simple client-state modal — either works;
client-state modal is simpler and avoids intercepting-route edge cases for
a component this contained.

## 5. Shared layout

- **Header** (from Figma): logo — **full logo** on desktop, **small
  mark** on mobile (header is height-constrained there) — nav links (Home /
  Trips / Services / Contact), right side: locale switcher, "Log in" link +
  primary CTA button when signed out, profile avatar dropdown (My Trips /
  Profile / Log out) when signed in. Shipped with a **text placeholder**
  (`ΑΛΛΟΥ` / `Α`) standing in for both logo variants — the real asset files
  were never provided during the build; swapping in `next/image` for both
  spots in `components/layout/Header.tsx` and `Footer.tsx` once they land
  is a two-line change, no restructuring.
- **Footer** (dark, per your preference — see DESIGN_SYSTEM.md): **small
  mark** (dark surface has less room than the hero-adjacent desktop header),
  brand blurb, contact info, 3 link columns (sourced from `site_settings`,
  not hardcoded — admin-editable), newsletter signup form (no auth, dedupes
  server-side), bottom bar with copyright + legal links.
- Logo usage elsewhere: **small mark** for the browser favicon, the admin
  sidebar (all states — sidebar is narrow), and any place the brand appears
  at a small size (loading states, email header). **Full logo** reserved for
  header (desktop) and anywhere with room to breathe (e.g. the login modal
  header, per the Figma layout, and an "about" section if one gets added
  later). Default to the small mark when in doubt — it's the one "mostly
  used," per your note.
- **Mobile bottom nav** (5 tabs, sticky, from Figma): Home / Trips /
  Services / Contact / Account (Account tab routes to login modal if
  signed out, My Trips if signed in). Desktop header hides this; mobile
  hides the inline nav links in favor of this bar.
- **Login/Signup modal**: tabbed (Log in / Sign up), Google OAuth button,
  divider, email+password form, "remember me" checkbox (→ backend
  `remember_me` on `/auth/login`), forgot-password link, consent/terms
  microcopy footer.

## 6. Component inventory

Buttons (primary/highlight/secondary/ghost), Trip Card, Service Widget Card
(icon+title+body, used for the 5-pillar/services grid), Stat Band
(label/value pairs), Testimonial Card, FAQ Accordion Item, Comparison Table,
Steps/Timeline list, CTA Banner, Chip/Badge (category tag, "Full" badge,
"Featured" badge), Filter Bar (status tabs + search + distance pills —
**single-select**, not multi-select: `GET /trips?category=` only accepts
one slug, and faking multi-select client-side without backend support
would just be misleading UI. Extending the backend to accept repeated
`category=` params, OR'd together, is the way to add real multi-select
later), Form Inputs (text/textarea/select/
checkbox/radio per DESIGN_SYSTEM.md), Pagination control, Empty state,
Toast/notification, Modal shell, Admin data table, Admin sidebar nav.

Every one of these maps to a `content_sections.type` on the backend (§4 of
BACKEND_PLAN.md) except the transactional ones (Trip Card, Filter Bar,
Pagination, admin components) which are driven by their own API resources.

## 7. Pages

**Home** — Hero (headline/CTA/stat strip, from Figma), Brand
Philosophy (3-pillar widget_list), Featured Trips (query
`GET /trips?featured=true`, uses `trips.is_featured` — new backend field),
Testimonials (3-quote strip), CTA banner. All non-trip-data sections driven
by `GET /content/pages/home`. (Correction from an earlier pass: the
route-elevation stats widget lives only on the Destinations page in the
Figma file, not Home — and per §11 it's out of scope for v1 anyway.)

**Destinations (`/trips`)** — Status tabs (Upcoming/Past), live search
(`?q=`), distance multi-select pills (backed by `race_categories`), results
count, paginated card grid, empty state. Skipping the season-dropdown filter
and the decorative route-elevation stats box seen in the Figma file for
v1 (confirmed) — neither is in scope; easy to add later since they'd need
no backend changes either way. Each card: image, date range or
`duration_label`, title, `summary`, race-category chips, first N
`trip_inclusions`, "Full" badge when `is_full_override`, link to detail.

**Trip detail (`/trips/[slug]`, new)** — Image gallery, title/dates/
location, category selector (chips, each showing its `trip_categories`
price), participant count stepper, sticky booking widget (desktop
sidebar) showing running total → "Book Now" (opens login modal if signed
out, else opens a checkout modal), full `description`, complete
`trip_inclusions` list.
  - **Checkout flow as shipped**: a 2-step modal (`CheckoutModal.tsx`) —
    per-participant name/nationality/shirt-size form → `POST /bookings` →
    `POST /payments/create-intent` → Stripe `PaymentElement`. Simplified
    from the original "proceeds to booking form → travel-profile
    completion if needed" idea: rather than requiring the account-level
    travel profile to be complete first, checkout just collects a reduced
    field set inline every time. Trade-off: faster/simpler checkout, at
    the cost of not reusing saved travel-profile data automatically —
    prefilling from `GET /users/me/travel-profile` when signed in would
    close that gap.
  - **Not shipped**: mobile bottom-sheet variant of the booking widget
    (renders as a normal sticky sidebar block on mobile too — still
    usable, just not the distinct mobile treatment originally sketched),
    and "related trips" (same primary race category) at the bottom of the
    page.

**Services** — Widget grid (5 cards, from Figma variant 1), comparison
table (Standard vs. Us — optional, nice-to-have), FAQ (from variant 2),
CTA banner. All `content_sections` on page slug `services`.

**Contact** — Two-column: left = contact info cards + FAQ (from
`site_settings`/`content_sections`), right = form (auth-gated: signed-out
click on the CTA opens the login modal instead of the form, per your
spec). Form fields: inquiry type (dropdown), optional "about this trip"
context (pre-filled when arriving from a trip page — sets
`contact_messages.trip_id`), message. Name/email come from the signed-in
user, not re-entered.

**My Trips (`/account`, new, auth required)** — Tabs: Upcoming / Past,
compact booking rows with a status badge, linking to the trip page. No
dedicated booking-detail page was built (`GET /bookings/{id}` exists on
the backend and is unused by the frontend) — the row itself shows enough
(trip, date, participant count, status) that a detail page wasn't
essential for v1; add `/account/bookings/[id]` if that changes. Also
added: a "basic info" form (full name, phone — `PATCH /users/me`) above
the travel-profile form on `/account/profile`, since the original plan
only covered travel details and there was otherwise no way to edit your
name after signup.

**Login/Signup, Forgot/Reset password, Verify email** — modal + 2 minimal
standalone pages for the email-link flows (can't be modals since they're
opened from an email).

## 8. Admin dashboard (new — standard pattern, per your instruction)

Deliberately **not** editorial-styled — a dense, standard admin shell using
the same color tokens (ink for nav/active states, primary/accent reserved
for primary actions and status highlights) but utility layout:

- **Shell**: fixed left sidebar (logo mark, nav sections) + topbar (search,
  admin profile menu) + content area.
- **Sidebar sections**: Dashboard, Trips (+ Race Categories), Bookings,
  Payments, Content Pages, Site Settings, Newsletter Subscribers, Contact
  Messages.
- **List views**: data table, server-paginated, column filters/search,
  row actions.
- **Edit views**: form per entity; translatable entities (trips, race
  categories, trip inclusions, content sections) show an **EN/EL tab
  switcher** at the top of the form, editing both `*_translations` rows in
  one save (matches backend §10's "admin returns/accepts all locales at
  once").
- **Auth**: separate login at `/admin/login` (backend §5/§6's
  `/admin/auth/*`), no Google OAuth, own session — this route is excluded
  from the public sitemap/nav entirely.

**Status per sidebar section, as shipped** — built to a "representative
module, fully done" depth (Trips) plus everything else that was
low-effort/high-value given existing backend support, same spirit as the
backend's own audit-log pattern:

| Section | Status |
|---|---|
| Dashboard | Stat tiles wired to real counts (trips, confirmed bookings, subscribers, new contact messages) via existing paginated endpoints' `total` field — no dedicated stats endpoint needed. |
| Trips | **Fully built** — list, create, edit (EN/EL tabs, categories), plus images and inclusions management. This is the pattern to copy for Race Categories/Content Pages. |
| Bookings | Built — list + inline status change. |
| Newsletter Subscribers | Built — list. |
| Contact Messages | Built — list + inline status change. |
| Race Categories | **Stub only** (backend CRUD exists) — same EN/EL form pattern as Trips, much smaller. |
| Content Pages | **Stub only** (backend CRUD exists) — needs a per-slug editor with an add/remove/reorder section list, each section type keyed to `components/site/sections/types.ts`'s shapes. |
| Site Settings | **Stub only** (backend CRUD exists) — a simple key/value editor would cover it. |
| Payments | **Stub only** — and blocked on the backend: no `GET /admin/payments` list endpoint exists yet (`payments/router.py` only has create-intent, get-by-id, and the webhook). |

Trip image management shipped as a **manual URL-paste field**, not the
originally-planned drag-reorderable gallery wired to the R2 presign flow —
`POST /admin/uploads/presign` works and is ready to call, but no
`<input type="file">` → presign → PUT-to-R2 → save-URL flow was wired up
in `TripImagesManager.tsx`. That's the next piece of work there.

## 9. Data fetching & caching (recap, ties to BACKEND_PLAN.md)

- Public content pages (Home, Services, Contact copy, Destinations listing,
  Trip detail): Next.js ISR, short revalidate window + on-demand
  revalidation triggered by the admin's save (backend calls a
  `/api/revalidate` route handler with a shared secret). The route handler
  itself is built (`POST /api/revalidate`, secret-checked, calls
  `revalidatePath`) — the backend side of this (calling out to it after a
  content save) was **not** wired up, so it's relying on the short ISR
  window alone for now. Low priority: `content/service.py`'s
  `update_page`/`update_site_settings` would need an HTTP call to
  `${FRONTEND_URL}/api/revalidate` with the shared secret.
- Identity/money/admin routes (login, My Trips, booking, payment, all of
  `/admin`): `force-dynamic`/`no-store`, always fresh, hit the API through
  the same-origin proxy with credentials.
- Newsletter/contact form submissions: client-side POST, no caching
  concerns either way.

## 10. i18n integration (recap, ties to BACKEND_PLAN.md §10)

- next-intl message catalogs (`messages/en.json`, `messages/el.json`) for
  all static UI strings (nav, buttons, labels, validation, error-code →
  message mapping).
- Admin-authored content (trip copy, service widgets, FAQ, etc.) comes
  pre-resolved from the API for the active locale — the frontend never
  needs its own copy of that text.
- `<html lang>` per route, `hreflang` alternates between `/en/x` and
  `/el/x`, locale-aware sitemap.

## 11. Decisions locked in

- **Brand**: ΑΛΛΟΥ (confirmed). Two logo assets incoming — full logo and a
  small mark, the small mark used in most placements (see §5 for exactly
  where each goes). Tagline/copy still TBD — not blocking, placeholder copy
  is fine until real copy is ready.
- **Color tokens**: hand-written brand prose is the source of truth
  (confirmed) — see `DESIGN_SYSTEM.md`'s callout for the full reasoning.
- **Season filter & route-elevation stats widget**: skipped for v1
  (confirmed) — neither was in your original spec; can be added later
  without any backend changes.

## 12. Next steps

Frontend is built — see `frontend/README.md` for setup, the auth-proxy
architecture, and verification notes (same network-sandbox caveat as the
backend: nothing here could be `npm install`ed or run live in this
environment; verified via TypeScript syntax parsing, an unused-import
sweep, and programmatic EN/EL message-key parity checks instead).

Remaining work, roughly in priority order: real Google/Stripe keys and a
live end-to-end run; the real logo assets; the admin upload-widget flow;
Race Categories/Content Pages/Site Settings admin screens; a
`GET /admin/payments` backend endpoint plus its admin screen; wiring the
backend's content-save path to call `/api/revalidate`.
