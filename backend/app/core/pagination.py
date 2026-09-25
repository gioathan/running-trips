from typing import Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class PageParams(BaseModel):
    page: int = 1
    page_size: int = 20


def page_params(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)) -> PageParams:
    return PageParams(page=page, page_size=page_size)


async def paginate(db: AsyncSession, stmt: Select, params: PageParams) -> tuple[list, int]:
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = await db.scalar(count_stmt)
    stmt = stmt.offset((params.page - 1) * params.page_size).limit(params.page_size)
    result = await db.execute(stmt)
    items = result.scalars().unique().all()
    return list(items), total or 0
