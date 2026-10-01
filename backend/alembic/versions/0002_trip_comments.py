"""trip comments

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-01

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


UPGRADE_SQL = """
CREATE TABLE trip_comments (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trip_id BIGINT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE (user_id, trip_id)
);
CREATE INDEX ix_trip_comments_trip_id ON trip_comments (trip_id);
CREATE INDEX ix_trip_comments_user_id ON trip_comments (user_id);
"""

DOWNGRADE_SQL = """
DROP TABLE IF EXISTS trip_comments;
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
