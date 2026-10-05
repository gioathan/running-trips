// Mirrors backend/app/modules/*/schemas.py field-for-field (same JSON keys
// FastAPI actually returns — snake_case, no alias layer) so the shapes here
// stay a direct, checkable match against BACKEND_PLAN.md §5.

export type Locale = "en" | "el";

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// --- Auth / users ---

export interface UserPublic {
  id: number;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: "user" | "admin";
  locale: Locale;
  email_verified: boolean;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  /** Echoed by /auth/refresh so the refresh cookie keeps the lifetime chosen at login. */
  remember_me?: boolean;
}

export interface AuthResponse {
  user: UserPublic;
  tokens: TokenPair;
}

export interface TravelProfile {
  date_of_birth: string | null;
  nationality: string | null;
  passport_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  shirt_size: string | null;
  extra: Record<string, unknown>;
}

// --- Race categories ---

export interface RaceCategory {
  id: number;
  slug: string;
  name: string;
}

export interface RaceCategoryAdmin {
  id: number;
  slug: string;
  translations: Record<Locale, string>;
}

// --- Trips ---

export interface TripCategory {
  id: number;
  race_category: RaceCategory;
  price: number;
  capacity: number | null;
}

export interface TripListItem {
  id: number;
  slug: string;
  cover_image_url: string | null;
  location_city: string | null;
  location_country: string | null;
  start_date: string;
  end_date: string;
  title: string;
  summary: string | null;
  duration_label: string;
  categories: TripCategory[];
  inclusion_labels: string[];
  is_full: boolean;
  is_featured: boolean;
}

export interface TripDetail extends TripListItem {
  description: string | null;
  meta_description: string | null;
  images: string[];
}

export interface TripStats {
  races_organized: number;
  countries: number;
}

export interface TripTranslationIn {
  locale: Locale;
  title: string;
  summary?: string | null;
  description?: string | null;
  meta_description?: string | null;
  duration_label?: string | null;
}

export interface TripAdmin {
  id: number;
  slug: string;
  cover_image_url: string | null;
  external_payment_url: string | null;
  location_city: string | null;
  location_country: string | null;
  start_date: string;
  end_date: string;
  capacity: number | null;
  is_full_override: boolean;
  is_featured: boolean;
  status: "draft" | "published" | "archived";
  translations: Partial<Record<Locale, TripTranslationIn>>;
  categories: TripCategory[];
  images: { id: number; url: string; alt_text: string | null; sort_order: number }[];
  inclusions: { id: number; icon: string | null; sort_order: number; translations: Partial<Record<Locale, string>> }[];
}

// --- Bookings ---

export type BookingStatus = "pending" | "awaiting_payment" | "confirmed" | "cancelled" | "refunded";

export type Gender = "male" | "female" | "other";
export type ShirtSize = "XS" | "S" | "M" | "L" | "XL" | "XXL";

/** A participant as POST /bookings takes it. */
export interface ParticipantIn {
  /** Latin characters, first name + surname (goes on race bibs / rooming lists). */
  full_name: string;
  date_of_birth: string;
  gender: Gender;
  nationality: string | null;
  shirt_size: ShirtSize | null;
}

/** As returned — nullable where bookings older than these fields lack them. */
export interface ParticipantRead {
  id: number;
  full_name: string;
  date_of_birth: string | null;
  gender: Gender | null;
  nationality: string | null;
  shirt_size: string | null;
}

export interface BookingTripSummary {
  id: number;
  slug: string;
  title: string;
  cover_image_url: string | null;
  start_date: string;
  end_date: string;
  /** The trip was deleted by an admin: the booking remains, but there is no trip page to link to. */
  deleted: boolean;
}

/** What deleting a trip would do — shown to the admin before confirming. */
export interface TripDeletionPreview {
  bookings_kept: number;
  bookings_paid: number;
  bookings_to_cancel: number;
  photos: number;
}

export interface TripDeletionResult {
  outcome: "removed" | "hidden";
  bookings_kept: number;
  bookings_cancelled: number;
  photos_deleted: number;
}

export type PaymentMethod = "stripe" | "external";

export interface Booking {
  id: number;
  trip: BookingTripSummary;
  status: BookingStatus;
  payment_method: PaymentMethod;
  /** Only while an external-payment booking is unpaid: where to pay, and when the seat hold lapses. */
  payment_url: string | null;
  payment_due_at: string | null;
  participant_count: number;
  total_amount_cents: number;
  /** The booking's own contact details (may differ from the account's email). */
  contact_email: string | null;
  contact_phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  participants: ParticipantRead[];
  created_at: string;
}

export interface BookingAdmin extends Booking {
  user_id: number;
  user_email: string;
}

/** Admin-configured payment mode (backend payments/settings.py). */
export interface PaymentSettings {
  mode: PaymentMethod;
  external_url: string | null;
  external_hold_days: number;
}

export type PaymentStatus = "requires_payment" | "succeeded" | "failed" | "refunded";

export interface PaymentAdmin {
  id: number;
  booking_id: number;
  booking_status: BookingStatus;
  user_email: string;
  trip_title: string;
  provider: string;
  provider_ref: string;
  status: PaymentStatus;
  amount_cents: number;
  created_at: string;
}

// --- Trip comments ---

export interface TripCommentPublic {
  id: number;
  author_name: string;
  body: string;
  created_at: string;
}

export interface TripCommentAdmin {
  id: number;
  trip_id: number;
  trip_title: string;
  user_email: string;
  body: string;
  created_at: string;
}

export interface PendingTripComment {
  trip_id: number;
  slug: string;
  title: string;
  cover_image_url: string | null;
  start_date: string;
  end_date: string;
}

export interface TripComment {
  id: number;
  trip_id: number;
  body: string;
  created_at: string;
}

// --- Payments ---

export interface CreateIntentResponse {
  payment_id: number;
  client_secret: string;
  amount_cents: number;
}

// --- Content / CMS ---

export type SectionType =
  | "hero"
  | "widget_list"
  | "stats_band"
  | "testimonials"
  | "faq"
  | "comparison_table"
  | "steps"
  | "cta_banner"
  | "richtext";

export interface ContentSection {
  id: number;
  type: SectionType;
  sort_order: number;
  data: Record<string, unknown>;
}

export interface ContentSectionAdmin {
  id: number;
  type: SectionType;
  sort_order: number;
  translations: Partial<Record<Locale, Record<string, unknown>>>;
}

export interface ContentPageAdmin {
  slug: string;
  sections: ContentSectionAdmin[];
}

export interface PageContent {
  slug: string;
  sections: ContentSection[];
}

export interface SiteFooterCopy {
  tagline: string;
  newsletterHint: string;
  newsletterBody: string;
}

export interface SiteFooterSettings {
  localized: Partial<Record<Locale, Partial<SiteFooterCopy>>>;
  social_links: { label: string; url: string }[];
}

export interface SiteSettings {
  footer?: SiteFooterSettings;
  [key: string]: unknown;
}

// --- Newsletter / contact ---

export interface SubscriberAdmin {
  id: number;
  email: string;
  subscribed_at: string;
  unsubscribed_at: string | null;
  source: string | null;
}

export interface ContactMessageAdmin {
  id: number;
  user_id: number;
  user_email: string;
  inquiry_type: "general" | "booking" | "custom_trip" | "press";
  trip_id: number | null;
  message: string;
  status: "new" | "replied" | "archived";
  created_at: string;
}
