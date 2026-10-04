from arq import ArqRedis, create_pool
from arq.connections import RedisSettings

from app.core.config import get_settings

settings = get_settings()

_pool: ArqRedis | None = None


async def _get_pool() -> ArqRedis:
    global _pool
    if _pool is None:
        _pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    return _pool


async def enqueue_email(task_name: str, **kwargs) -> None:
    """Enqueue a background job (matching a function name in
    app.workers.tasks) instead of doing the work inline on the request path —
    despite the name, used for any task (emails, frontend revalidation).
    `_job_id`/`_defer_by` and other arq options pass straight through."""
    pool = await _get_pool()
    await pool.enqueue_job(task_name, **kwargs)
