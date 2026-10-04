"""refresh token rotated_at (rotation grace window)

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-04

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Distinguishes "revoked because it was rotated" (eligible for a short reuse
# grace window — concurrent requests racing the same refresh) from "revoked
# by logout / password reset" (never reusable).
UPGRADE_SQL = """
ALTER TABLE refresh_tokens ADD COLUMN rotated_at TIMESTAMPTZ;
ALTER TABLE admin_refresh_tokens ADD COLUMN rotated_at TIMESTAMPTZ;
"""

DOWNGRADE_SQL = """
ALTER TABLE admin_refresh_tokens DROP COLUMN IF EXISTS rotated_at;
ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS rotated_at;
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
