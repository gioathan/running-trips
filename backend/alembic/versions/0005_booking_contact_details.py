"""booking contact details and participant gender

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-05

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# A booking carries its own contact details (may differ from the account's
# email) plus an optional emergency contact; participants gain gender, which
# race registrations need. All nullable: bookings made before this exist
# without them — the API requires them for new bookings.
UPGRADE_SQL = """
ALTER TABLE bookings ADD COLUMN contact_email VARCHAR(320);
ALTER TABLE bookings ADD COLUMN contact_phone VARCHAR(20);
ALTER TABLE bookings ADD COLUMN emergency_contact_name VARCHAR(255);
ALTER TABLE bookings ADD COLUMN emergency_contact_phone VARCHAR(20);
ALTER TABLE booking_participants ADD COLUMN gender VARCHAR(10)
    CHECK (gender IN ('male', 'female', 'other'));
"""

DOWNGRADE_SQL = """
ALTER TABLE booking_participants DROP COLUMN IF EXISTS gender;
ALTER TABLE bookings DROP COLUMN IF EXISTS emergency_contact_phone;
ALTER TABLE bookings DROP COLUMN IF EXISTS emergency_contact_name;
ALTER TABLE bookings DROP COLUMN IF EXISTS contact_phone;
ALTER TABLE bookings DROP COLUMN IF EXISTS contact_email;
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
