"""trip deleted_at (delete a trip while keeping its booking records)

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-05

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Bookings and payments must outlive the trip they were made for (accounting,
# disputes), and bookings.trip_id is ON DELETE RESTRICT. So a trip that has
# bookings is never physically deleted: it is emptied and marked with
# deleted_at, which hides it everywhere except as a label on those bookings.
UPGRADE_SQL = """
ALTER TABLE trips ADD COLUMN deleted_at TIMESTAMPTZ;
"""

DOWNGRADE_SQL = """
ALTER TABLE trips DROP COLUMN IF EXISTS deleted_at;
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
