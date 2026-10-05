"""external payments (payment link instead of Stripe)

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-05

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# trips.external_payment_url: optional per-trip override of the default
# external payment link (the mode itself + default link live in
# site_settings['payments']). bookings.payment_method records which flow a
# booking was created under, so switching the mode later doesn't change how
# existing bookings are treated (expiry, create-intent).
UPGRADE_SQL = """
ALTER TABLE trips ADD COLUMN external_payment_url VARCHAR(1000);
ALTER TABLE bookings ADD COLUMN payment_method VARCHAR(20) NOT NULL DEFAULT 'stripe'
    CHECK (payment_method IN ('stripe', 'external'));
"""

DOWNGRADE_SQL = """
ALTER TABLE bookings DROP COLUMN IF EXISTS payment_method;
ALTER TABLE trips DROP COLUMN IF EXISTS external_payment_url;
"""


def _execute_statements(sql: str) -> None:
    # asyncpg rejects multiple statements in one prepared statement.
    for statement in sql.split(";"):
        lines = [ln for ln in statement.splitlines() if ln.strip() and not ln.strip().startswith("--")]
        if lines:
            op.execute("\n".join(lines))


def upgrade() -> None:
    _execute_statements(UPGRADE_SQL)


def downgrade() -> None:
    _execute_statements(DOWNGRADE_SQL)
