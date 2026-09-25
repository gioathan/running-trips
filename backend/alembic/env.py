import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlalchemy import pool

from app.core.config import get_settings
from app.db.base import Base

# Import every module's models so they're registered on Base.metadata —
# required for `alembic revision --autogenerate` to see them.
from app.modules.admin_auth import models as admin_auth_models  # noqa: F401
from app.modules.audit import models as audit_models  # noqa: F401
from app.modules.bookings import models as bookings_models  # noqa: F401
from app.modules.contact import models as contact_models  # noqa: F401
from app.modules.content import models as content_models  # noqa: F401
from app.modules.newsletter import models as newsletter_models  # noqa: F401
from app.modules.payments import models as payments_models  # noqa: F401
from app.modules.race_categories import models as race_categories_models  # noqa: F401
from app.modules.trips import models as trips_models  # noqa: F401
from app.modules.users import models as users_models  # noqa: F401

config = context.config
settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def _do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(_do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
