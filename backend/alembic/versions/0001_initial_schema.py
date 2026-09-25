"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-09-25

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


UPGRADE_SQL = """
-- === Identity ===

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(320) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    full_name VARCHAR(255),
    phone VARCHAR(50),
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    locale VARCHAR(2) NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'el')),
    email_verified BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_users_email ON users (email);

CREATE TABLE oauth_accounts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('google')),
    provider_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_oauth_accounts_user_id ON oauth_accounts (user_id);
CREATE UNIQUE INDEX uq_oauth_accounts_provider_provider_user_id ON oauth_accounts (provider, provider_user_id);

CREATE TABLE refresh_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    remember_me BOOLEAN NOT NULL DEFAULT false,
    user_agent VARCHAR(500),
    ip VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_refresh_tokens_token_hash ON refresh_tokens (token_hash);
CREATE INDEX ix_refresh_tokens_user_id ON refresh_tokens (user_id);

CREATE TABLE admin_refresh_tokens (
    id BIGSERIAL PRIMARY KEY,
    admin_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    user_agent VARCHAR(500),
    ip VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_admin_refresh_tokens_token_hash ON admin_refresh_tokens (token_hash);
CREATE INDEX ix_admin_refresh_tokens_admin_user_id ON admin_refresh_tokens (admin_user_id);

CREATE TABLE user_travel_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    date_of_birth DATE,
    nationality VARCHAR(100),
    passport_number VARCHAR(50),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(50),
    shirt_size VARCHAR(10),
    extra JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- === Catalog ===

CREATE TABLE race_categories (
    id BIGSERIAL PRIMARY KEY,
    slug VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_race_categories_slug ON race_categories (slug);

CREATE TABLE race_category_translations (
    id BIGSERIAL PRIMARY KEY,
    race_category_id BIGINT NOT NULL REFERENCES race_categories(id) ON DELETE CASCADE,
    locale VARCHAR(2) NOT NULL,
    name VARCHAR(100) NOT NULL,
    UNIQUE (race_category_id, locale)
);

CREATE TABLE trips (
    id BIGSERIAL PRIMARY KEY,
    slug VARCHAR(255) NOT NULL UNIQUE,
    cover_image_url VARCHAR(1000),
    location_city VARCHAR(255),
    location_country VARCHAR(255),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    capacity INTEGER,
    is_full_override BOOLEAN NOT NULL DEFAULT false,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_trips_slug ON trips (slug);
CREATE INDEX ix_trips_status ON trips (status);

CREATE TABLE trip_translations (
    id BIGSERIAL PRIMARY KEY,
    trip_id BIGINT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    locale VARCHAR(2) NOT NULL,
    title VARCHAR(255) NOT NULL,
    summary VARCHAR(300),
    description TEXT,
    meta_description VARCHAR(300),
    duration_label VARCHAR(100),
    UNIQUE (trip_id, locale)
);

CREATE TABLE trip_categories (
    id BIGSERIAL PRIMARY KEY,
    trip_id BIGINT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    race_category_id BIGINT NOT NULL REFERENCES race_categories(id) ON DELETE RESTRICT,
    price NUMERIC(10, 2) NOT NULL,
    capacity INTEGER
);
CREATE INDEX ix_trip_categories_trip_id ON trip_categories (trip_id);

CREATE TABLE trip_images (
    id BIGSERIAL PRIMARY KEY,
    trip_id BIGINT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    url VARCHAR(1000) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    alt_text VARCHAR(255)
);
CREATE INDEX ix_trip_images_trip_id ON trip_images (trip_id);

CREATE TABLE trip_inclusions (
    id BIGSERIAL PRIMARY KEY,
    trip_id BIGINT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    icon VARCHAR(100),
    sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX ix_trip_inclusions_trip_id ON trip_inclusions (trip_id);

CREATE TABLE trip_inclusion_translations (
    id BIGSERIAL PRIMARY KEY,
    inclusion_id BIGINT NOT NULL REFERENCES trip_inclusions(id) ON DELETE CASCADE,
    locale VARCHAR(2) NOT NULL,
    label VARCHAR(500) NOT NULL,
    UNIQUE (inclusion_id, locale)
);

-- === Booking & payment ===

CREATE TABLE bookings (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    trip_id BIGINT NOT NULL REFERENCES trips(id) ON DELETE RESTRICT,
    trip_category_id BIGINT NOT NULL REFERENCES trip_categories(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'awaiting_payment', 'confirmed', 'cancelled', 'refunded')),
    participant_count INTEGER NOT NULL,
    total_amount_cents INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_bookings_status ON bookings (status);
CREATE INDEX ix_bookings_user_id ON bookings (user_id);
CREATE INDEX ix_bookings_trip_id ON bookings (trip_id);
CREATE INDEX ix_bookings_trip_category_id ON bookings (trip_category_id);

CREATE TABLE booking_participants (
    id BIGSERIAL PRIMARY KEY,
    booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    date_of_birth DATE,
    nationality VARCHAR(100),
    passport_number VARCHAR(50),
    shirt_size VARCHAR(10),
    extra JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX ix_booking_participants_booking_id ON booking_participants (booking_id);

CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY,
    booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    provider VARCHAR(20) NOT NULL DEFAULT 'stripe' CHECK (provider IN ('stripe')),
    provider_ref VARCHAR(255) NOT NULL UNIQUE,
    amount_cents INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'requires_payment'
        CHECK (status IN ('requires_payment', 'succeeded', 'failed', 'refunded')),
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_payments_provider_ref ON payments (provider_ref);
CREATE INDEX ix_payments_booking_id ON payments (booking_id);

-- === Content / CMS ===

CREATE TABLE pages (
    id BIGSERIAL PRIMARY KEY,
    slug VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_pages_slug ON pages (slug);

CREATE TABLE content_sections (
    id BIGSERIAL PRIMARY KEY,
    page_id BIGINT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN (
        'hero', 'widget_list', 'stats_band', 'testimonials', 'faq',
        'comparison_table', 'steps', 'cta_banner', 'richtext'
    )),
    sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX ix_content_sections_page_id ON content_sections (page_id);

CREATE TABLE content_section_translations (
    id BIGSERIAL PRIMARY KEY,
    section_id BIGINT NOT NULL REFERENCES content_sections(id) ON DELETE CASCADE,
    locale VARCHAR(2) NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (section_id, locale)
);

CREATE TABLE site_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- === Engagement ===

CREATE TABLE newsletter_subscribers (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(320) NOT NULL UNIQUE,
    subscribed_at TIMESTAMPTZ NOT NULL,
    unsubscribed_at TIMESTAMPTZ,
    source VARCHAR(100)
);
CREATE INDEX ix_newsletter_subscribers_email ON newsletter_subscribers (email);

CREATE TABLE contact_messages (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    inquiry_type VARCHAR(20) NOT NULL DEFAULT 'general'
        CHECK (inquiry_type IN ('general', 'booking', 'custom_trip', 'press')),
    trip_id BIGINT REFERENCES trips(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'replied', 'archived')),
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_contact_messages_status ON contact_messages (status);

-- === Ops ===

CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    admin_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50) NOT NULL,
    diff JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL
);
"""

DOWNGRADE_SQL = """
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS contact_messages;
DROP TABLE IF EXISTS newsletter_subscribers;
DROP TABLE IF EXISTS site_settings;
DROP TABLE IF EXISTS content_section_translations;
DROP TABLE IF EXISTS content_sections;
DROP TABLE IF EXISTS pages;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS booking_participants;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS trip_inclusion_translations;
DROP TABLE IF EXISTS trip_inclusions;
DROP TABLE IF EXISTS trip_images;
DROP TABLE IF EXISTS trip_categories;
DROP TABLE IF EXISTS trip_translations;
DROP TABLE IF EXISTS trips;
DROP TABLE IF EXISTS race_category_translations;
DROP TABLE IF EXISTS race_categories;
DROP TABLE IF EXISTS user_travel_profiles;
DROP TABLE IF EXISTS admin_refresh_tokens;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS oauth_accounts;
DROP TABLE IF EXISTS users;
"""


def upgrade() -> None:
    op.execute(UPGRADE_SQL)


def downgrade() -> None:
    op.execute(DOWNGRADE_SQL)
