// Shapes of `content_sections.data` per `type` (BACKEND_PLAN.md §4's
// content_sections.type catalogue). The backend stores this as opaque
// JSONB — these interfaces are the frontend's documented contract for what
// the admin CMS form should produce and what these renderers expect.

export interface Cta {
  label: string;
  href: string;
}

export interface HeroStatCard {
  title: string;
  value: string;
  badge?: string;
  sublabel?: string;
  variant?: "light" | "dark-highlight";
}

export interface HeroData {
  eyebrow?: string;
  headline: string;
  body?: string;
  primaryCta?: Cta;
  secondaryCta?: Cta;
  stats?: { value: string; label: string }[];
  imageUrl?: string;
  // When present, renders the photo-less "stat card row" hero layout
  // instead of the photo hero — used on Home, per the redesign.
  statCards?: HeroStatCard[];
}

export type WidgetMini =
  | { kind: "sparkline"; label: string; seed: string }
  | { kind: "progress"; label: string; value: string; percent: number }
  | { kind: "statGrid"; items: { label: string; value: string }[] }
  | { kind: "badgeRow"; badges: string[] };

export interface WidgetListItem {
  icon?: string;
  title: string;
  body: string;
  // Optional enrichments for the redesigned pillar cards (Home philosophy,
  // Services). Absent on older content — renderer falls back to the plain
  // icon+title+body card.
  numberLabel?: string;
  mini?: WidgetMini;
}
export interface WidgetListData {
  eyebrow?: string;
  headline: string;
  body?: string;
  items: WidgetListItem[];
}

export interface StatsBandData {
  items: { label: string; value: string }[];
}

export interface TestimonialItem {
  quote: string;
  name: string;
  role?: string;
  avatarUrl?: string;
}
export interface TestimonialsData {
  eyebrow?: string;
  headline?: string;
  items: TestimonialItem[];
}

export interface FaqData {
  eyebrow?: string;
  headline?: string;
  items: { question: string; answer: string }[];
  // "grid" renders always-visible numbered cards (Contact); default
  // "accordion" keeps the expand/collapse list (Services).
  layout?: "accordion" | "grid";
}

export interface ComparisonTableData {
  headline?: string;
  columnLabels: [string, string];
  rows: { feature: string; values: [string, string] }[];
}

export interface StepsData {
  eyebrow?: string;
  headline?: string;
  items: { title: string; body: string }[];
}

export interface CtaBannerData {
  eyebrow?: string;
  headline: string;
  body?: string;
  primaryCta?: Cta;
  secondaryCta?: Cta;
}

export interface RichtextData {
  html: string;
}
