# Frontend Plan — Running Trips Platform

Status: planning draft, informed by the Figma templates (file
`KD9K5ul4JXrKAtijVk4xPj`) and `docs/DESIGN_SYSTEM.md`. Pairs with
`docs/BACKEND_PLAN.md`.

## 1. What the Figma file covers vs. what we design fresh

Provided (desktop + mobile): **Home**, **Destinations** (trip listing),
**Services** (two layout variants), **Contact**, a **Login/Signup modal**,
plus shared **Header**, **Footer**, and a 5-tab **mobile bottom nav**.

Not in the file — designed here, reusing the same tokens/components:
**Trip detail/booking page**, **My Trips** (user dashboard), **Admin
dashboard**, forgot/reset-password screens, verify-email screen.

All copy in the file is placeholder ("AALOY" / "Travel Beyond The Finish
Lines") — treated as structural reference, not real content.

## 2. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router, TypeScript) | SSR/ISR for content pages, matches backend plan's caching split |
| i18n | next-intl | locale-prefixed routing (`/en`, `/el`), confirmed approach |
| Styling | Tailwind CSS | maps 1:1 to the token table in `DESIGN_SYSTEM.md` |
| Component base | shadcn/ui (headless, copy-in) restyled to tokens | gets accessible primitives (dialog, select, tabs, dropdown) for free instead of hand-building the login modal, filter dropdown, etc. — visual layer is fully overridden by our tokens, so it doesn't fight the editorial look |
| Forms | react-hook-form + zod | matches the field-heavy contact/booking/admin forms |
| Server state | Next.js fetch cache (public content) + a thin fetch wrapper; no client cache library needed for a site this size (no React Query) | avoids a dependency the traffic level doesn't justify |
| Payments UI | Stripe.js + Elements | pairs with backend's PaymentIntent flow |
| Auth cookie handling | Next.js Route Handlers proxy `/api/*` → FastAPI, same-origin | per backend plan §6 — keeps refresh token `httpOnly` without cross-site cookie issues |

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

- **Header** (from Figma): logo, nav links (Home / Trips / Services /
  Contact), right side: locale switcher, "Log in" link + primary CTA button
  when signed out, profile avatar dropdown (My Trips / Profile / Log out)
  when signed in.
- **Footer** (dark, per your preference — see DESIGN_SYSTEM.md): brand
  blurb, contact info, 3 link columns (sourced from `site_settings`, not
  hardcoded — admin-editable), newsletter signup form (no auth, dedupes
  server-side), bottom bar with copyright + legal links.
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
"Featured" badge), Filter Bar (status tabs + search + distance multi-select
pills + optional season dropdown), Form Inputs (text/textarea/select/
checkbox/radio per DESIGN_SYSTEM.md), Pagination control, Empty state,
Toast/notification, Modal shell, Admin data table, Admin sidebar nav.

Every one of these maps to a `content_sections.type` on the backend (§4 of
BACKEND_PLAN.md) except the transactional ones (Trip Card, Filter Bar,
Pagination, admin components) which are driven by their own API resources.

## 7. Pages

**Home** — Hero (headline/CTA/stat strip, from Figma), Brand
Philosophy (3-pillar widget_list), Featured Trips (query
`GET /trips?featured=true`, uses `trips.is_featured` — new backend field),
Route/Telemetry Showcase (generic `stats_band` content section — not
tied to real per-trip data, purely a marketing widget), Testimonials,
two CTA banners. All non-trip-data sections driven by
`GET /content/pages/home`.

**Destinations (`/trips`)** — Status tabs (Upcoming/Past), live search
(`?q=`), distance multi-select pills (backed by `race_categories`), season
dropdown (**optional** — computed month-range filter, no schema change; can
ship without it and add later without any backend work), results count,
paginated card grid, empty state. Each card: image, date range or
`duration_label`, title, `summary`, race-category chips, first N
`trip_inclusions`, "Full" badge when `is_full_override`, link to detail.

**Trip detail (`/trips/[slug]`, new)** — Image gallery, title/dates/
location, category selector (chips, each showing its `trip_categories`
price), participant count stepper, sticky booking widget (desktop
sidebar / mobile bottom sheet) showing running total → "Book Now" (opens
login modal if signed out, else proceeds to booking form → travel-profile
completion if needed → Stripe Elements payment), full `description`,
complete `trip_inclusions` list, related trips (same primary race
category).

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
reusing the trip card component in a compact row layout, booking status
badge, link into booking detail.

**Login/Signup, Forgot/Reset password, Verify email** — modal + 2 minimal
standalone pages for the email-link flows (can't be modals since they're
opened from an email).

## 8. Admin dashboard (new — standard pattern, per your instruction)

Deliberately **not** editorial-styled — a dense, standard admin shell using
the same color tokens (ink for nav/active states, primary/accent reserved
for primary actions and status highlights) but utility layout:

- **Shell**: fixed left sidebar (logo mark, nav sections) + topbar (search,
  admin profile menu) + content area.
- **Sidebar sections**: Dashboard (stat tiles: bookings this month, revenue,
  active subscribers), Trips (+ Race Categories), Bookings, Payments,
  Content Pages, Site Settings, Newsletter Subscribers, Contact Messages.
- **List views**: data table, server-paginated, column filters/search,
  row actions.
- **Edit views**: form per entity; translatable entities (trips, race
  categories, trip inclusions, content sections) show an **EN/EL tab
  switcher** at the top of the form, editing both `*_translations` rows in
  one save (matches backend §10's "admin returns/accepts all locales at
  once"). Trip form includes a dynamic add/remove list for inclusion
  bullets and a drag-reorderable image gallery (uploads via the R2 presign
  flow — `POST /admin/uploads/presign` from BACKEND_PLAN.md).
- **Auth**: separate login at `/admin/login` (backend §5/§6's
  `/admin/auth/*`), no Google OAuth, own session — this route is excluded
  from the public sitemap/nav entirely.

## 9. Data fetching & caching (recap, ties to BACKEND_PLAN.md)

- Public content pages (Home, Services, Contact copy, Destinations listing,
  Trip detail): Next.js ISR, short revalidate window + on-demand
  revalidation triggered by the admin's save (backend calls a
  `/api/revalidate` route handler with a shared secret).
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

## 11. Open flags for you

1. **Brand name/domain** — placeholder "AALOY" throughout the Figma file;
   need the real name, wordmark asset, and tagline before final copy (not
   blocking the plan, just noting it).
2. **Color token reconciliation** — see the callout in `DESIGN_SYSTEM.md`;
   I used the hand-written brand prose as source of truth over the YAML
   Material export where they disagree. Say if you'd rather reconcile them
   differently.
3. **Season filter & the route-elevation "telemetry" widget** — both are
   nice-to-haves from the Figma file, not in your original spec. Flagged as
   optional in §7 — easy to drop without touching the backend either way.

## 12. Next steps

Once brand name/copy direction is settled (or you're fine proceeding with
placeholders): scaffold `frontend/` (Next.js app, Tailwind config from
DESIGN_SYSTEM.md, next-intl setup, shared layout components), in parallel
with or after the `backend/` scaffold from BACKEND_PLAN.md §12.
