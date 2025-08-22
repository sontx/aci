"""
Maintain 3 partitions for execution_logs using SQLAlchemy Session:

  Parent partition key: RANGE(created_at)  -- timestamp without time zone

  - execution_logs_today : [now-24h, MAXVALUE)      -- moving hot window
  - execution_logs_last3 : [now-3d,  now-24h)
  - execution_logs_rest  : DEFAULT (the rest)

Run once per day (or as needed). Safe rotation without data loss:
- Detach old 'today', create new bounds, move rows into parent (constraint-routed), drop old.
- Recreate 'last3' to match the new window.
"""
import datetime as dt
import logging

from apscheduler.schedulers.blocking import BlockingScheduler
from sqlalchemy import text
from sqlalchemy.orm import Session

from aci.common import utils
from aci.server.config import DB_FULL_URL

logger = logging.getLogger(__name__)

# ---- Configuration ----
PARENT_SCHEMA = "public"
PARENT_TABLE = "execution_logs"

PART_TODAY = f"{PARENT_TABLE}_today"
PART_LAST3 = f"{PARENT_TABLE}_last3"
PART_REST = f"{PARENT_TABLE}_rest"

# Index definitions to mirror your model
CHILD_INDEXES = [
    ("ix_execution_logs_project_id", ("project_id",)),
    ("ix_execution_logs_project_id_app_config_id", ("project_id", "app_configuration_id")),
    ("ix_execution_logs_project_id_api_key_name", ("project_id", "api_key_name")),
    ("ix_execution_logs_project_id_linked_account_id", ("project_id", "linked_account_owner_id")),
    ("ix_execution_logs_project_id_app_name", ("project_id", "app_name")),
    ("ix_execution_logs_project_id_function_name", ("project_id", "function_name")),
]


def ts_now_naive() -> dt.datetime:
    # Use naive timestamps to match your model (timezone=False)
    return dt.datetime.now().replace(microsecond=0, second=0, minute=0)


def fmt_ts(ts: dt.datetime) -> str:
    # ISO-like literal acceptable by Postgres for timestamp without time zone
    return ts.strftime("%Y-%m-%d %H:%M:%S")


def partition_exists(session: Session, schema: str, table: str) -> bool:
    return session.execute(
        text("""
             SELECT 1
             FROM pg_catalog.pg_class c
                      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = :schema
               AND c.relname = :table
             """),
        {"schema": schema, "table": table},
    ).scalar() is not None


def is_partitioned_parent(session: Session, schema: str, table: str) -> bool:
    return bool(session.execute(
        text("""
             SELECT relkind = 'p'
             FROM pg_catalog.pg_class c
                      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = :schema
               AND c.relname = :table
             """),
        {"schema": schema, "table": table},
    ).scalar())


def ensure_indexes(session: Session, schema: str, child_name: str):
    for idx_name, cols in CHILD_INDEXES:
        child_idx_name = f"{idx_name}__{child_name}"
        cols_sql = ", ".join(cols)
        session.execute(
            text(f'CREATE INDEX IF NOT EXISTS "{child_idx_name}" ON "{schema}"."{child_name}" ({cols_sql})')
        )


def detach_partition(session: Session, schema: str, child_name: str):
    session.execute(
        text(f'ALTER TABLE "{schema}"."{PARENT_TABLE}" DETACH PARTITION "{schema}"."{child_name}"')
    )


def drop_table(session: Session, schema: str, table_name: str):
    session.execute(text(f'DROP TABLE IF EXISTS "{schema}"."{table_name}"'))


def create_default_partition(session: Session):
    if not partition_exists(session, PARENT_SCHEMA, PART_REST):
        session.execute(
            text(
                f'CREATE TABLE "{PARENT_SCHEMA}"."{PART_REST}" PARTITION OF "{PARENT_SCHEMA}"."{PARENT_TABLE}" DEFAULT')
        )
        ensure_indexes(session, PARENT_SCHEMA, PART_REST)


def convert_table_to_partitioned(session: Session):
    """
    Convert a regular table to a partitioned table by RANGE on created_at.
    This is needed when the table exists but isn't partitioned yet.
    """
    # Check if table exists and is not already partitioned
    if not partition_exists(session, PARENT_SCHEMA, PARENT_TABLE):
        raise RuntimeError(f"Parent table {PARENT_SCHEMA}.{PARENT_TABLE} does not exist.")

    if is_partitioned_parent(session, PARENT_SCHEMA, PARENT_TABLE):
        return  # Already partitioned, nothing to do

    # Create a backup table name
    backup_table = f"{PARENT_TABLE}_backup_{dt.datetime.now().strftime('%Y%m%d_%H%M%S')}"

    # Step 1: Rename the existing table to backup
    session.execute(
        text(f'ALTER TABLE "{PARENT_SCHEMA}"."{PARENT_TABLE}" RENAME TO "{backup_table}"')
    )

    # Step 2: Create new partitioned table with same structure
    session.execute(
        text(f'''
            CREATE TABLE "{PARENT_SCHEMA}"."{PARENT_TABLE}" (
                LIKE "{PARENT_SCHEMA}"."{backup_table}" INCLUDING ALL
            ) PARTITION BY RANGE (created_at)
        ''')
    )

    # Step 3: Create the default partition first
    session.execute(
        text(f'''
            CREATE TABLE "{PARENT_SCHEMA}"."{PART_REST}"
            PARTITION OF "{PARENT_SCHEMA}"."{PARENT_TABLE}" DEFAULT
        ''')
    )
    ensure_indexes(session, PARENT_SCHEMA, PART_REST)

    # Step 4: Move data from backup to new partitioned table
    session.execute(
        text(f'''
            INSERT INTO "{PARENT_SCHEMA}"."{PARENT_TABLE}"
            SELECT * FROM "{PARENT_SCHEMA}"."{backup_table}"
        ''')
    )

    # Step 5: Drop the backup table
    session.execute(text(f'DROP TABLE "{PARENT_SCHEMA}"."{backup_table}"'))


def create_today_partition(session: Session, lower_ts: dt.datetime):
    # [lower_ts, MAXVALUE)
    # Use string formatting instead of parameterized query for partition bounds
    # as PostgreSQL needs to know the exact data type at parse time
    start_str = fmt_ts(lower_ts)
    session.execute(
        text(f'''
            CREATE TABLE "{PARENT_SCHEMA}"."{PART_TODAY}"
            PARTITION OF "{PARENT_SCHEMA}"."{PARENT_TABLE}"
            FOR VALUES FROM ('{start_str}'::timestamp) TO (MAXVALUE)
        ''')
    )
    ensure_indexes(session, PARENT_SCHEMA, PART_TODAY)


def create_last3_partition(session: Session, start_ts: dt.datetime, end_ts: dt.datetime):
    # [start_ts, end_ts)
    # Use string formatting instead of parameterized query for partition bounds
    # as PostgreSQL needs to know the exact data type at parse time
    start_str = fmt_ts(start_ts)
    end_str = fmt_ts(end_ts)
    session.execute(
        text(f'''
            CREATE TABLE "{PARENT_SCHEMA}"."{PART_LAST3}"
            PARTITION OF "{PARENT_SCHEMA}"."{PARENT_TABLE}"
            FOR VALUES FROM ('{start_str}'::timestamp) TO ('{end_str}'::timestamp)
        ''')
    )
    ensure_indexes(session, PARENT_SCHEMA, PART_LAST3)


def move_rows_from_detached_into_parent(session: Session, detached_table: str, where_clause: str | None = None):
    """
    Insert rows from a detached table back into the parent; constraint exclusion routes them to the right partitions.
    Optionally filter with a WHERE clause.
    """
    where_sql = f"WHERE {where_clause}" if where_clause else ""
    # Use column wildcard; the detached table has the same structure as parent.
    session.execute(
        text(f'''
            INSERT INTO "{PARENT_SCHEMA}"."{PARENT_TABLE}"
            SELECT * FROM "{PARENT_SCHEMA}"."{detached_table}"
            {where_sql}
        ''')
    )
    if where_clause:
        session.execute(
            text(f'DELETE FROM "{PARENT_SCHEMA}"."{detached_table}" WHERE {where_clause}')
        )


def cleanup_rest_partition(session: Session, older_than_days: int | None = None, batch_size: int = 10_000):
    """
    Deletes rows from the 'rest' partition.

    Args:
        session: SQLAlchemy Session
        older_than_days: if given, only delete rows with created_at < now() - interval 'X days'.
                         if None, delete all rows in the rest partition.
        batch_size: number of rows to delete per batch to avoid long locks.
    """
    target_table = PART_REST
    if not partition_exists(session, PARENT_SCHEMA, target_table):
        logger.info(f"No rest partition '{target_table}' exists — skipping cleanup.")
        return

    cond = ""
    params = {}
    if older_than_days is not None:
        cond = "WHERE created_at < :cutoff"
        cutoff = ts_now_naive() - dt.timedelta(days=older_than_days)
        params["cutoff"] = cutoff
        logger.info(f"Cleaning rows older than {older_than_days} days (cutoff={cutoff}) from {target_table}")
    else:
        logger.info(f"Cleaning ALL rows from {target_table}")

    total_deleted = 0
    while True:
        result = session.execute(
            text(f'''
                DELETE FROM "{PARENT_SCHEMA}"."{target_table}"
                {cond}
                LIMIT :limit
            '''),
            {**params, "limit": batch_size}
        )
        deleted_rows = result.rowcount or 0
        total_deleted += deleted_rows
        session.commit()
        if deleted_rows < batch_size:
            break

    logger.info(f"Deleted {total_deleted} rows from {target_table}")


def initialize_partitions():
    now = ts_now_naive()
    hot_lower = now - dt.timedelta(days=1)  # now - 24h
    warm_lower = now - dt.timedelta(days=3)  # now - 3d
    warm_upper = hot_lower  # now - 24h

    with utils.create_db_session(DB_FULL_URL) as session:
        # Preconditions
        if not partition_exists(session, PARENT_SCHEMA, PARENT_TABLE):
            raise RuntimeError(f"Parent table {PARENT_SCHEMA}.{PARENT_TABLE} does not exist.")

        # Convert table to partitioned if it isn't already
        convert_table_to_partitioned(session)

        # Ensure DEFAULT (rest) - this is already handled in convert_table_to_partitioned
        # but we call it here for safety in case the table was already partitioned
        create_default_partition(session)

        # Track whether we actually detached a partition
        detached_old_today = False

        # Rotate TODAY safely:
        if partition_exists(session, PARENT_SCHEMA, PART_TODAY):
            # 1) Detach the existing 'today' so we can re-partition without overlap.
            detach_partition(session, PARENT_SCHEMA, PART_TODAY)
            detached_old_today = True

            # 2) Create the new 'today' covering [now-24h, MAXVALUE)
            create_today_partition(session, hot_lower)

            # 3) Move rows from the detached old 'today' into the parent:
            #   - First: rows >= hot_lower go back to parent -> will land in the *new today*
            move_rows_from_detached_into_parent(
                session, PART_TODAY, where_clause=f'created_at >= \'{fmt_ts(hot_lower)}\''
            )
            #   - Remaining rows (< hot_lower) go back to parent -> will land in last3 or rest (after we create last3)
            #     We'll move them after we create last3 (below), to route into the correct window.
        else:
            # If no current 'today', just create it.
            create_today_partition(session, hot_lower)

        # Recreate LAST3 for [now-3d, now-24h)
        if partition_exists(session, PARENT_SCHEMA, PART_LAST3):
            drop_table(session, PARENT_SCHEMA, PART_LAST3)
        create_last3_partition(session, warm_lower, warm_upper)

        # If we detached an old 'today', finish moving the remaining rows (< hot_lower) then drop it.
        if detached_old_today:
            # The detached table still exists with the same name as PART_TODAY, but it's no longer a partition
            # Move any remaining rows and then drop the detached table
            move_rows_from_detached_into_parent(session, PART_TODAY, where_clause=None)
            drop_table(session, PARENT_SCHEMA, PART_TODAY)

        session.commit()


def maintain_execution_log_partitions():
    # --- Improved handling to avoid name conflict when detaching 'today' ---
    with utils.create_db_session(DB_FULL_URL) as session:
        # Quick probe: does PART_TODAY exist?
        def exists(name: str) -> bool:
            return session.execute(
                text("""
                     SELECT 1
                     FROM pg_catalog.pg_class c
                              JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                     WHERE n.nspname = :schema
                       AND c.relname = :table
                     """),
                {"schema": PARENT_SCHEMA, "table": name},
            ).scalar() is not None

        need_detach = exists(PART_TODAY)

    # If an old 'today' exists, run a special rotation path that RENAMES the detached table to avoid name clash.
    if need_detach:
        now = ts_now_naive()
        hot_lower = now - dt.timedelta(days=1)
        warm_lower = now - dt.timedelta(days=3)
        warm_upper = hot_lower

        with utils.create_db_session(DB_FULL_URL) as session:
            if not is_partitioned_parent(session, PARENT_SCHEMA, PARENT_TABLE):
                raise RuntimeError(f"Table {PARENT_SCHEMA}.{PARENT_TABLE} is not partitioned by RANGE.")

            create_default_partition(session)

            # Detach and RENAME the old 'today' to a temp name
            detach_partition(session, PARENT_SCHEMA, PART_TODAY)
            temp_old_today = f"{PART_TODAY}__detached_{now.strftime('%Y%m%d_%H%M%S')}"
            session.execute(
                text(f'ALTER TABLE "{PARENT_SCHEMA}"."{PART_TODAY}" RENAME TO "{temp_old_today.split(".", )[-1]}"')
            )

            # Create new TODAY, then LAST3
            create_today_partition(session, hot_lower)

            if partition_exists(session, PARENT_SCHEMA, PART_LAST3):
                drop_table(session, PARENT_SCHEMA, PART_LAST3)
            create_last3_partition(session, warm_lower, warm_upper)

            # Move rows from the renamed, detached old table:
            # 1) >= hot_lower -> new TODAY
            move_rows_from_detached_into_parent(
                session, temp_old_today, where_clause=f'created_at >= \'{fmt_ts(hot_lower)}\''
            )
            # 2) remaining (< hot_lower) -> LAST3 (or REST by constraints)
            move_rows_from_detached_into_parent(session, temp_old_today, where_clause=None)

            # Drop the detached temp table
            drop_table(session, PARENT_SCHEMA, temp_old_today)

            session.commit()

        logger.info(
            f"Rotated TODAY to [{fmt_ts(hot_lower)}, MAXVALUE). Rebuilt LAST3 [{fmt_ts(warm_lower)}, {fmt_ts(warm_upper)}).")
        logger.info(f"DEFAULT partition '{PART_REST}' ensured.")
    else:
        # No existing TODAY; do a fresh create path
        initialize_partitions()
        logger.info(
            f"Initialized partitions with TODAY as [now-24h, MAXVALUE) and LAST3 as [now-3d, now-24h). DEFAULT ensured.")


sched = BlockingScheduler()


# Run at midnight every day
@sched.scheduled_job('cron', hour=0, minute=0)
def daily_partition_job():
    logger.info("Running daily partition maintenance...")
    maintain_execution_log_partitions()

    # Cleanup old rows in the 'rest' partition that data is older than 7 days
    with utils.create_db_session(DB_FULL_URL) as session:
        cleanup_rest_partition(session, older_than_days=7, batch_size=1000)


# Run immediately on script start
maintain_execution_log_partitions()
