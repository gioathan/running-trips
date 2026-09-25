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
  role: "user" | "admin";
  locale: Locale;
  email_verified: boolean;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
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
  images: string[];
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

export interface ParticipantIn {
  full_name: string;
  date_of_birth?: string | null;
  nationality?: string | null;
  passport_number?: string | null;
  shirt_size?: string | null;
  extra?: Record<string, unknown>;
}

export interface BookingTripSummary {
  id: number;
  slug: string;
  title: string;
  cover_image_url: string | null;
  start_date: string;
  end_date: string;
}

export interface Booking {
  id: number;
  trip: BookingTripSummary;
  status: BookingStatus;
  participant_count: number;
  total_amount_cents: number;
  participants: (ParticipantIn & { id: number })[];
  created_at: string;
}

export interface BookingAdmin extends Booking {
  user_id: number;
  user_email: string;
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

export interface PageContent {
  slug: string;
  sections: ContentSection[];
}

export interface SiteSettings {
  [key: string]: Record<string, unknown>;
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
