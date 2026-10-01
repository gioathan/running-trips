"""Development seed data.

Usage (inside the api container):
    python -m app.seed           # seed an empty database
    python -m app.seed --reset   # wipe all app data, then seed
"""

import argparse
import asyncio
import datetime
import sys

from sqlalchemy import select, text

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import AsyncSessionLocal, engine

# Register every model on Base.metadata so relationships resolve.
from app.modules.admin_auth import models as _admin_auth_models  # noqa: F401
from app.modules.audit import models as _audit_models  # noqa: F401
from app.modules.bookings.models import Booking, BookingParticipant, BookingStatus
from app.modules.contact.models import ContactMessage, InquiryType, MessageStatus
from app.modules.content.models import ContentSection, ContentSectionTranslation, Page
from app.modules.newsletter.models import NewsletterSubscriber
from app.modules.payments import models as _payments_models  # noqa: F401
from app.modules.race_categories.models import RaceCategory, RaceCategoryTranslation
from app.modules.trips.models import (
    Trip,
    TripCategory,
    TripImage,
    TripInclusion,
    TripInclusionTranslation,
    TripStatus,
    TripTranslation,
)
from app.modules.users.models import User, UserRole, UserTravelProfile

ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin12345"
USER_EMAIL = "runner@example.com"
USER_PASSWORD = "runner12345"


def img(seed: str, w: int = 1200, h: int = 800) -> str:
    return f"https://picsum.photos/seed/{seed}/{w}/{h}"


RACE_CATEGORIES = [
    ("5km", "5km", "5χλμ"),
    ("10km", "10km", "10χλμ"),
    ("half-marathon", "Half Marathon", "Ημιμαραθώνιος"),
    ("marathon", "Marathon", "Μαραθώνιος"),
]

INCLUSIONS = [
    ("hotel", "3 nights in a 4-star hotel near the start line", "3 διανυκτερεύσεις σε ξενοδοχείο 4 αστέρων κοντά στην αφετηρία"),
    ("bib", "Guaranteed race entry (bib)", "Εγγυημένη συμμετοχή στον αγώνα"),
    ("transfer", "Airport and race-day transfers", "Μεταφορές από/προς αεροδρόμιο και την ημέρα του αγώνα"),
    ("run", "Guided shake-out run the day before", "Χαλαρό προπονητικό τρέξιμο με οδηγό την προηγούμενη μέρα"),
    ("dinner", "Pasta party dinner with the group", "Δείπνο pasta party με την ομάδα"),
    ("kit", "Team running shirt", "Τεχνικό μπλουζάκι της ομάδας"),
]

# (slug, city_en, city_el, country_en, country_el, start_offset_days, nights, categories{slug: price}, featured, full)
TRIPS = [
    ("madrid-10k", "Madrid", "Μαδρίτη", "Spain", "Ισπανία", 30, 3, {"5km": 390, "10km": 420}, True, False),
    ("lisbon-half", "Lisbon", "Λισαβόνα", "Portugal", "Πορτογαλία", 55, 3, {"10km": 460, "half-marathon": 520}, True, False),
    ("berlin-marathon", "Berlin", "Βερολίνο", "Germany", "Γερμανία", 80, 4, {"marathon": 890}, True, True),
    ("rome-half", "Rome", "Ρώμη", "Italy", "Ιταλία", 110, 3, {"5km": 370, "half-marathon": 540}, False, False),
    ("paris-10k", "Paris", "Παρίσι", "France", "Γαλλία", 140, 2, {"10km": 480}, False, False),
    ("vienna-marathon", "Vienna", "Βιέννη", "Austria", "Αυστρία", 175, 4, {"half-marathon": 610, "marathon": 790}, True, False),
    ("athens-classic", "Athens", "Αθήνα", "Greece", "Ελλάδα", -45, 3, {"5km": 250, "10km": 280, "marathon": 450}, False, False),
    ("prague-half", "Prague", "Πράγα", "Czechia", "Τσεχία", -120, 3, {"half-marathon": 500}, False, False),
]


def trip_translations(city_en: str, city_el: str, nights: int) -> list[TripTranslation]:
    return [
        TripTranslation(
            locale="en",
            title=f"Run {city_en}",
            summary=f"Race through the streets of {city_en} with hotel, entry and transfers all sorted for you.",
            description=(
                f"Join our group for a race weekend in {city_en}. We handle the logistics — race entry, "
                f"accommodation and transfers — so you can focus on the run.\n\n"
                f"Expect a relaxed arrival day, a guided shake-out run, a pasta party with fellow runners, "
                f"and plenty of time to explore the city after you cross the finish line."
            ),
            meta_description=f"Organized running trip to {city_en}: race entry, hotel and transfers included.",
            duration_label=f"{nights + 1} days / {nights} nights",
        ),
        TripTranslation(
            locale="el",
            title=f"Δρομικό ταξίδι: {city_el}",
            summary=f"Τρέξε στους δρόμους της πόλης {city_el} με ξενοδοχείο, συμμετοχή και μεταφορές οργανωμένα για σένα.",
            description=(
                f"Έλα μαζί μας για ένα αγωνιστικό Σαββατοκύριακο στην πόλη {city_el}. Αναλαμβάνουμε όλη την "
                f"οργάνωση — συμμετοχή, διαμονή και μεταφορές — ώστε να επικεντρωθείς στο τρέξιμο.\n\n"
                f"Χαλαρή μέρα άφιξης, προπονητικό τρέξιμο με οδηγό, pasta party με άλλους δρομείς "
                f"και άφθονος χρόνος για να γνωρίσεις την πόλη μετά τον τερματισμό."
            ),
            meta_description=f"Οργανωμένο δρομικό ταξίδι: {city_el}. Συμμετοχή, ξενοδοχείο και μεταφορές.",
            duration_label=f"{nights + 1} ημέρες / {nights} νύχτες",
        ),
    ]


def section(type_: str, sort_order: int, en: dict, el: dict) -> ContentSection:
    return ContentSection(
        type=type_,
        sort_order=sort_order,
        translations=[
            ContentSectionTranslation(locale="en", data=en),
            ContentSectionTranslation(locale="el", data=el),
        ],
    )


def home_page() -> Page:
    return Page(
        slug="home",
        sections=[
            section(
                "hero",
                0,
                {
                    "eyebrow": "Running trips across Europe",
                    "headline": "Travel beyond the finish line",
                    "body": "Race weekends in Europe's best cities — entry, hotel and transfers handled. You just run.",
                    "primaryCta": {"label": "Browse trips", "href": "/trips"},
                    "secondaryCta": {"label": "How it works", "href": "/services"},
                    "stats": [
                        {"value": "40+", "label": "Races"},
                        {"value": "1,200", "label": "Runners"},
                        {"value": "15", "label": "Cities"},
                    ],
                    "statCards": [
                        {"title": "Races", "value": "40+", "badge": "Active"},
                        {"title": "Runners", "value": "1,200", "variant": "dark-highlight", "badge": "Total"},
                        {"title": "Cities", "value": "15", "sublabel": "across Europe"},
                    ],
                    "imageUrl": img("hero-run", 1600, 1000),
                },
                {
                    "eyebrow": "Δρομικά ταξίδια σε όλη την Ευρώπη",
                    "headline": "Ταξίδεψε πέρα από τον τερματισμό",
                    "body": "Αγωνιστικά Σαββατοκύριακα στις ωραιότερες πόλεις της Ευρώπης — συμμετοχή, ξενοδοχείο και μεταφορές. Εσύ απλώς τρέχεις.",
                    "primaryCta": {"label": "Δες τα ταξίδια", "href": "/trips"},
                    "secondaryCta": {"label": "Πώς λειτουργεί", "href": "/services"},
                    "stats": [
                        {"value": "40+", "label": "Αγώνες"},
                        {"value": "1.200", "label": "Δρομείς"},
                        {"value": "15", "label": "Πόλεις"},
                    ],
                    "statCards": [
                        {"title": "Αγώνες", "value": "40+", "badge": "Ενεργοί"},
                        {"title": "Δρομείς", "value": "1.200", "variant": "dark-highlight", "badge": "Σύνολο"},
                        {"title": "Πόλεις", "value": "15", "sublabel": "σε όλη την Ευρώπη"},
                    ],
                    "imageUrl": img("hero-run", 1600, 1000),
                },
            ),
            section(
                "widget_list",
                1,
                {
                    "eyebrow": "Our philosophy",
                    "headline": "Run the race. We'll handle the rest.",
                    "items": [
                        {
                            "icon": "route",
                            "numberLabel": "01",
                            "title": "Curated races",
                            "body": "Fast, scenic courses we've run ourselves.",
                            "mini": {"kind": "sparkline", "label": "Elevation feel", "seed": "curated-races"},
                        },
                        {"icon": "hotel", "numberLabel": "02", "title": "Stay close", "body": "Hotels within walking distance of the start."},
                        {
                            "icon": "group",
                            "numberLabel": "03",
                            "title": "Run together",
                            "body": "A small group of runners at every level.",
                            "mini": {"kind": "badgeRow", "badges": ["Beginner", "Intermediate", "Advanced"]},
                        },
                    ],
                },
                {
                    "eyebrow": "Η φιλοσοφία μας",
                    "headline": "Εσύ τρέχεις. Εμείς φροντίζουμε τα υπόλοιπα.",
                    "items": [
                        {
                            "icon": "route",
                            "numberLabel": "01",
                            "title": "Επιλεγμένοι αγώνες",
                            "body": "Γρήγορες, όμορφες διαδρομές που έχουμε τρέξει κι εμείς.",
                            "mini": {"kind": "sparkline", "label": "Αίσθηση υψομέτρου", "seed": "curated-races"},
                        },
                        {"icon": "hotel", "numberLabel": "02", "title": "Διαμονή κοντά", "body": "Ξενοδοχεία σε απόσταση περπατήματος από την αφετηρία."},
                        {
                            "icon": "group",
                            "numberLabel": "03",
                            "title": "Τρέχουμε μαζί",
                            "body": "Μικρή ομάδα δρομέων κάθε επιπέδου.",
                            "mini": {"kind": "badgeRow", "badges": ["Αρχάριος", "Μεσαίος", "Προχωρημένος"]},
                        },
                    ],
                },
            ),
            section(
                "testimonials",
                2,
                {
                    "eyebrow": "Runners say",
                    "headline": "From our last trips",
                    "items": [
                        {"quote": "I only had to show up and run. Everything else just worked.", "name": "Maria K.", "role": "Lisbon Half"},
                        {"quote": "Great group, perfect hotel, and a PB in Berlin.", "name": "Nikos P.", "role": "Berlin Marathon"},
                        {"quote": "My first race abroad and it felt effortless.", "name": "Eleni D.", "role": "Madrid 10K"},
                    ],
                },
                {
                    "eyebrow": "Οι δρομείς λένε",
                    "headline": "Από τα τελευταία μας ταξίδια",
                    "items": [
                        {"quote": "Το μόνο που έπρεπε να κάνω ήταν να τρέξω. Όλα τα άλλα απλώς λειτούργησαν.", "name": "Μαρία Κ.", "role": "Ημιμαραθώνιος Λισαβόνας"},
                        {"quote": "Υπέροχη ομάδα, τέλειο ξενοδοχείο και ατομικό ρεκόρ στο Βερολίνο.", "name": "Νίκος Π.", "role": "Μαραθώνιος Βερολίνου"},
                        {"quote": "Ο πρώτος μου αγώνας στο εξωτερικό και ήταν πανεύκολο.", "name": "Ελένη Δ.", "role": "10K Μαδρίτης"},
                    ],
                },
            ),
            section(
                "cta_banner",
                3,
                {
                    "headline": "Ready for your next race?",
                    "body": "Spots are limited on every trip.",
                    "primaryCta": {"label": "See upcoming trips", "href": "/trips"},
                },
                {
                    "headline": "Έτοιμος για τον επόμενο αγώνα;",
                    "body": "Οι θέσεις είναι περιορισμένες σε κάθε ταξίδι.",
                    "primaryCta": {"label": "Δες τα επόμενα ταξίδια", "href": "/trips"},
                },
            ),
        ],
    )


FAQ_EN = [
    {"question": "Is race entry included?", "answer": "Yes — every trip includes a guaranteed bib for the distance you book."},
    {"question": "Can I bring a non-running companion?", "answer": "Yes. Contact us and we'll arrange a companion package."},
    {"question": "What is the cancellation policy?", "answer": "Full refund up to 60 days before departure, 50% up to 30 days."},
]
FAQ_EL = [
    {"question": "Περιλαμβάνεται η συμμετοχή στον αγώνα;", "answer": "Ναι — κάθε ταξίδι περιλαμβάνει εγγυημένη συμμετοχή στην απόσταση που επιλέγεις."},
    {"question": "Μπορώ να φέρω συνοδό που δεν τρέχει;", "answer": "Ναι. Επικοινώνησε μαζί μας και θα οργανώσουμε πακέτο συνοδού."},
    {"question": "Ποια είναι η πολιτική ακύρωσης;", "answer": "Πλήρης επιστροφή έως 60 ημέρες πριν την αναχώρηση, 50% έως 30 ημέρες."},
]


def services_page() -> Page:
    return Page(
        slug="services",
        sections=[
            section(
                "widget_list",
                0,
                {
                    "eyebrow": "What we do",
                    "headline": "Everything a race trip needs",
                    "items": [
                        {"icon": "bib", "numberLabel": "01", "title": "Race entry", "body": "Guaranteed bibs, even for sold-out races."},
                        {"icon": "hotel", "numberLabel": "02", "title": "Accommodation", "body": "Hand-picked hotels near the start line."},
                        {"icon": "bus", "numberLabel": "03", "title": "Transfers", "body": "Airport and race-day transport included."},
                        {"icon": "coach", "numberLabel": "04", "title": "Coaching", "body": "Pre-race shake-out and pacing advice."},
                        {"icon": "group", "numberLabel": "05", "title": "Community", "body": "Meet runners who share your goals."},
                    ],
                },
                {
                    "eyebrow": "Τι κάνουμε",
                    "headline": "Ό,τι χρειάζεται ένα δρομικό ταξίδι",
                    "items": [
                        {"icon": "bib", "numberLabel": "01", "title": "Συμμετοχή", "body": "Εγγυημένη συμμετοχή, ακόμη και σε sold-out αγώνες."},
                        {"icon": "hotel", "numberLabel": "02", "title": "Διαμονή", "body": "Επιλεγμένα ξενοδοχεία κοντά στην αφετηρία."},
                        {"icon": "bus", "numberLabel": "03", "title": "Μεταφορές", "body": "Μεταφορές αεροδρομίου και ημέρας αγώνα."},
                        {"icon": "coach", "numberLabel": "04", "title": "Προπόνηση", "body": "Προπονητικό τρέξιμο και συμβουλές ρυθμού."},
                        {"icon": "group", "numberLabel": "05", "title": "Κοινότητα", "body": "Γνώρισε δρομείς με κοινούς στόχους."},
                    ],
                },
            ),
            section(
                "comparison_table",
                1,
                {
                    "headline": "Going alone vs. going with us",
                    "columnLabels": ["On your own", "With us"],
                    "rows": [
                        {"feature": "Race entry", "values": ["Lottery / sold out", "Guaranteed"]},
                        {"feature": "Hotel near start", "values": ["Hard to find", "Included"]},
                        {"feature": "Transfers", "values": ["DIY", "Included"]},
                        {"feature": "Group runs", "values": ["—", "Included"]},
                    ],
                },
                {
                    "headline": "Μόνος σου ή μαζί μας",
                    "columnLabels": ["Μόνος σου", "Μαζί μας"],
                    "rows": [
                        {"feature": "Συμμετοχή", "values": ["Κλήρωση / sold out", "Εγγυημένη"]},
                        {"feature": "Ξενοδοχείο κοντά στην αφετηρία", "values": ["Δύσκολο", "Περιλαμβάνεται"]},
                        {"feature": "Μεταφορές", "values": ["Μόνος σου", "Περιλαμβάνονται"]},
                        {"feature": "Ομαδικά τρεξίματα", "values": ["—", "Περιλαμβάνονται"]},
                    ],
                },
            ),
            section("faq", 2, {"headline": "FAQ", "items": FAQ_EN}, {"headline": "Συχνές ερωτήσεις", "items": FAQ_EL}),
            section(
                "cta_banner",
                3,
                {"headline": "Find your next race", "primaryCta": {"label": "Browse trips", "href": "/trips"}},
                {"headline": "Βρες τον επόμενο αγώνα σου", "primaryCta": {"label": "Δες τα ταξίδια", "href": "/trips"}},
            ),
        ],
    )


def contact_page() -> Page:
    return Page(
        slug="contact",
        sections=[
            section(
                "widget_list",
                0,
                {
                    "headline": "Get in touch",
                    "items": [
                        {"title": "Email", "body": "hello@example.com"},
                        {"title": "Phone", "body": "+30 210 000 0000"},
                        {"title": "Office", "body": "Athens, Greece — Mon–Fri, 10:00–18:00"},
                    ],
                },
                {
                    "headline": "Επικοινωνία",
                    "items": [
                        {"title": "Email", "body": "hello@example.com"},
                        {"title": "Τηλέφωνο", "body": "+30 210 000 0000"},
                        {"title": "Γραφείο", "body": "Αθήνα — Δευ–Παρ, 10:00–18:00"},
                    ],
                },
            ),
            section(
                "faq",
                1,
                {"headline": "FAQ", "items": FAQ_EN, "layout": "grid"},
                {"headline": "Συχνές ερωτήσεις", "items": FAQ_EL, "layout": "grid"},
            ),
        ],
    )


async def reset(db) -> None:
    await db.execute(
        text("TRUNCATE users, trips, race_categories, pages, site_settings, newsletter_subscribers RESTART IDENTITY CASCADE")
    )
    await db.commit()


async def seed(db) -> None:
    today = datetime.date.today()
    now = datetime.datetime.now(datetime.UTC)

    admin = User(
        email=ADMIN_EMAIL,
        password_hash=hash_password(ADMIN_PASSWORD),
        full_name="Dev Admin",
        role=UserRole.admin,
        email_verified=True,
    )
    runner = User(
        email=USER_EMAIL,
        password_hash=hash_password(USER_PASSWORD),
        full_name="Demo Runner",
        phone="+30 690 000 0000",
        role=UserRole.user,
        email_verified=True,
        travel_profile=UserTravelProfile(nationality="Greek", shirt_size="M", extra={}),
    )
    db.add_all([admin, runner])

    categories: dict[str, RaceCategory] = {}
    for slug, en, el in RACE_CATEGORIES:
        categories[slug] = RaceCategory(
            slug=slug,
            translations=[RaceCategoryTranslation(locale="en", name=en), RaceCategoryTranslation(locale="el", name=el)],
        )
    db.add_all(categories.values())

    trips: dict[str, Trip] = {}
    for slug, city_en, city_el, country_en, _country_el, offset, nights, cats, featured, full in TRIPS:
        start = today + datetime.timedelta(days=offset)
        trip = Trip(
            slug=slug,
            cover_image_url=img(slug),
            location_city=city_en,
            location_country=country_en,
            start_date=start,
            end_date=start + datetime.timedelta(days=nights),
            capacity=30,
            is_full_override=full,
            is_featured=featured,
            status=TripStatus.published,
            translations=trip_translations(city_en, city_el, nights),
            categories=[
                TripCategory(race_category=categories[c], price=price, capacity=20) for c, price in cats.items()
            ],
            images=[TripImage(url=img(f"{slug}-{i}"), sort_order=i, alt_text=f"{city_en} {i + 1}") for i in range(3)],
            inclusions=[
                TripInclusion(
                    icon=icon,
                    sort_order=i,
                    translations=[
                        TripInclusionTranslation(locale="en", label=en),
                        TripInclusionTranslation(locale="el", label=el),
                    ],
                )
                for i, (icon, en, el) in enumerate(INCLUSIONS)
            ],
        )
        trips[slug] = trip
    db.add_all(trips.values())

    db.add_all([home_page(), services_page(), contact_page()])
    await db.flush()

    def booking(trip_slug: str, status: BookingStatus, participants: list[str]) -> Booking:
        trip = trips[trip_slug]
        tc = trip.categories[0]
        return Booking(
            user_id=runner.id,
            trip_id=trip.id,
            trip_category_id=tc.id,
            status=status,
            participant_count=len(participants),
            total_amount_cents=int(tc.price * 100) * len(participants),
            participants=[BookingParticipant(full_name=n, nationality="Greek", shirt_size="M", extra={}) for n in participants],
        )

    db.add_all(
        [
            booking("madrid-10k", BookingStatus.confirmed, ["Demo Runner", "Anna Runner"]),
            booking("rome-half", BookingStatus.awaiting_payment, ["Demo Runner"]),
            booking("athens-classic", BookingStatus.confirmed, ["Demo Runner"]),
        ]
    )

    db.add_all(
        [
            ContactMessage(
                user_id=runner.id,
                inquiry_type=InquiryType.booking,
                trip_id=trips["madrid-10k"].id,
                message="Can I switch from the 5km to the 10km after booking?",
                status=MessageStatus.new,
                created_at=now - datetime.timedelta(days=1),
            ),
            ContactMessage(
                user_id=runner.id,
                inquiry_type=InquiryType.custom_trip,
                message="Do you organize trips for running clubs of ~15 people?",
                status=MessageStatus.replied,
                created_at=now - datetime.timedelta(days=6),
            ),
        ]
    )

    db.add_all(
        NewsletterSubscriber(email=f"subscriber{i}@example.com", subscribed_at=now - datetime.timedelta(days=i * 3), source="footer")
        for i in range(1, 9)
    )

    await db.commit()


async def main(do_reset: bool) -> None:
    if get_settings().environment != "local":
        sys.exit("Refusing to seed: ENVIRONMENT is not 'local'.")

    async with AsyncSessionLocal() as db:
        if do_reset:
            await reset(db)
        elif (await db.execute(select(RaceCategory.id).limit(1))).first() is not None:
            sys.exit("Database already has data. Re-run with --reset to wipe and reseed.")
        await seed(db)
    await engine.dispose()

    print("Seeded development data.")
    print(f"  Admin: {ADMIN_EMAIL} / {ADMIN_PASSWORD}  -> /admin/login")
    print(f"  User:  {USER_EMAIL} / {USER_PASSWORD}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed development data.")
    parser.add_argument("--reset", action="store_true", help="wipe all app data before seeding")
    asyncio.run(main(parser.parse_args().reset))
