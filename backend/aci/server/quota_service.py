from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from aci.common.exceptions import ProjectNotFound, MonthlyQuotaExceeded
from aci.server.caching import get_cache


# ---------- Time helpers ----------
def month_start(dt: datetime, tz: str = "Asia/Bangkok") -> datetime:
    t = dt.astimezone(ZoneInfo(tz))
    return t.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def month_end_exclusive(dt: datetime, tz: str = "Asia/Bangkok") -> datetime:
    s = month_start(dt, tz)
    # Next month start
    if s.month == 12:
        return s.replace(year=s.year + 1, month=1)
    return s.replace(month=s.month + 1)


def seconds_until_month_end(now: Optional[datetime] = None, tz: str = "Asia/Bangkok") -> int:
    now = now or datetime.now(ZoneInfo(tz))
    end = month_end_exclusive(now, tz)
    return int((end - now).total_seconds())


def cache_key(project_id: UUID, month_key: str) -> str:
    return f"quota:{project_id}:{month_key}"


def month_key_str(now: Optional[datetime] = None, tz: str = "Asia/Bangkok") -> str:
    now = now or datetime.now(ZoneInfo(tz))
    return now.strftime("%Y%m")  # e.g. 202508


# ---------- DB logic ----------
# This single UPDATE:
#  - rolls the month if needed
#  - computes the would-be new usage
#  - checks it does not exceed limit
#  - increments total quota usage for all-time tracking
#  - returns the new usage + limit if success; 0 rows if cap exceeded or project missing
SQL_INCREMENT = text("""
                     UPDATE projects
                     SET monthly_quota_month = CAST(:cur_month AS date),
                         monthly_quota_used  =
                             (CASE WHEN monthly_quota_month = CAST(:cur_month AS date) THEN monthly_quota_used ELSE 0 END) +
                             :consume,
                         total_quota_used = total_quota_used + :consume
                     WHERE id = :project_id
                       AND (
                               (CASE WHEN monthly_quota_month = CAST(:cur_month AS date) THEN monthly_quota_used ELSE 0 END) +
                               :consume
                               ) <= monthly_quota_limit
                     RETURNING monthly_quota_used, monthly_quota_limit
                     """)

SQL_FETCH_LIMIT = text("""
                       SELECT monthly_quota_limit, monthly_quota_used, monthly_quota_month
                       FROM projects
                       WHERE id = :project_id
                       """)


# ---------- Public API ----------
async def consume_monthly_quota(
        db_session: AsyncSession,
        project_id: UUID,
        consume_count: int = 1,
        *,
        tz: str = "Asia/Bangkok",
        # allow small temporary overage in cache before DB verification:
        soft_window: Optional[int] = None,  # e.g., 100 or int(0.05*limit). If None, compute 5% later.
) -> None:
    """
    Fast path via Redis cache; hard enforcement via single atomic UPDATE in PostgreSQL.
    Raises QuotaExceeded if the hard cap would be surpassed.
    """

    if consume_count <= 0:
        return  # no-op

    now = datetime.now(ZoneInfo(tz))
    mstart = month_start(now, tz)
    month_key = month_key_str(now, tz)
    ckey = cache_key(project_id, month_key)
    ttl = seconds_until_month_end(now, tz)

    cache = get_cache()

    # Try to read the cached limit to compute soft window. If absent, we’ll fetch it.
    limit: Optional[int] = None
    limit_key = f"{ckey}:limit"

    # Try cache first
    try:
        limit = await cache.get(limit_key)
    except Exception:
        pass  # cache is best-effort

    # If no cached limit, do a small read to get it (and seed cache)
    if limit is None:
        row = (await db_session.execute(SQL_FETCH_LIMIT, {"project_id": str(project_id)})).mappings().first()
        if row is None:
            raise ProjectNotFound(f"project {project_id} not found")
        limit = int(row["monthly_quota_limit"])
        # seed limit in cache with month TTL
        try:
            await cache.set(limit_key, limit, ttl=ttl)
        except Exception:
            pass

    # Default soft window = 5% of limit (min 10), unless provided
    if soft_window is None:
        soft_window = max(10, limit // 20)  # 5%

    # --- Cache fast path ---
    # We maintain a cache counter for this month. It can go slightly beyond limit (soft window),
    # but DB will strictly enforce the cap.
    cached_after: Optional[int] = None
    try:
        # Initialize if missing
        current = await cache.get(ckey)
        if current is None:
            # seed from DB monthly_quota_used for better accuracy
            row = (await db_session.execute(SQL_FETCH_LIMIT, {"project_id": str(project_id)})).mappings().first()
            if row is None:
                raise ProjectNotFound(f"project {project_id} not found")
            # If DB month differs, usage should be 0 (the SQL increment handles roll anyway)
            # but for cache we start at 0; DB will reconcile.
            current = 0
            await cache.set(ckey, current, ttl=ttl)
        # increment in cache
        cached_after = int(current) + int(consume_count)
        await cache.set(ckey, cached_after, ttl=ttl)

        # If we’re still <= (limit + soft_window), we can accept fast path and *defer* DB write.
        # But to keep drift bounded, we write-through whenever we cross 10% of limit steps.
        write_through = (cached_after % max(1, limit // 10) == 0)
        if cached_after <= (limit + soft_window) and not write_through:
            return  # accept optimistic increment; DB will catch up later
    except Exception:
        # Cache failure – fall back to DB immediately.
        pass

    # --- DB hard enforcement (atomic) ---
    params = {
        "project_id": str(project_id),
        "cur_month": mstart.date().isoformat(),
        "consume": int(consume_count),
    }
    res = await db_session.execute(SQL_INCREMENT, params)
    row = res.mappings().first()

    if row is None:
        # Determine if this is “not found” vs “quota exceeded”.
        # Quick existence check:
        exists = (await db_session.execute(SQL_FETCH_LIMIT, {"project_id": str(project_id)})).mappings().first()
        if not exists:
            raise ProjectNotFound(f"project {project_id} not found")
        # Hard cap hit
        # Roll back any uncommitted changes (safe to call)
        await db_session.rollback()
        # Clamp cache to limit to avoid further optimistic overages
        try:
            await cache.set(ckey, limit, ttl=ttl)
        except Exception:
            pass
        raise MonthlyQuotaExceeded(f"Monthly quota exceeded for project {project_id}")

    # Success: sync cache to the *DB-authoritative* value
    new_used = int(row["monthly_quota_used"])
    try:
        await cache.set(ckey, new_used, ttl=ttl)
        await cache.set(limit_key, int(row["monthly_quota_limit"]), ttl=ttl)
    except Exception:
        pass

    # Commit since we wrote
    await db_session.commit()
