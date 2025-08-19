from datetime import datetime
from uuid import UUID
from typing import Optional

from sqlalchemy import select, and_
from sqlalchemy.orm import Session

from aci.common.db.sql_models import ExecutionLog, ExecutionDetail
from aci.common.logging_setup import get_logger

logger = get_logger(__name__)


def get_execution_logs(
    db_session: Session,
    project_id: UUID,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    app_name: Optional[str] = None,
    function_name: Optional[str] = None,
    app_configuration_id: UUID | None = None,
    linked_account_owner_id: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[ExecutionLog]:
    """
    Get execution logs filtered by project_id and optional filters.
    """
    logger.debug(
        f"Getting execution logs for project_id={project_id}, "
        f"start_time={start_time}, end_time={end_time}, "
        f"app_name={app_name}, function_name={function_name}, "
        f"limit={limit}, offset={offset}"
    )

    statement = select(ExecutionLog).filter(ExecutionLog.project_id == project_id)

    # Apply optional filters
    if start_time:
        statement = statement.filter(ExecutionLog.created_at >= start_time)

    if end_time:
        statement = statement.filter(ExecutionLog.created_at <= end_time)

    if app_name:
        statement = statement.filter(ExecutionLog.app_name == app_name)

    if function_name:
        statement = statement.filter(ExecutionLog.function_name == function_name)

    if app_configuration_id:
        statement = statement.filter(ExecutionLog.app_configuration_id == app_configuration_id)

    if linked_account_owner_id:
        statement = statement.filter(ExecutionLog.linked_account_owner_id == linked_account_owner_id)

    # Order by created_at descending (most recent first)
    statement = statement.order_by(ExecutionLog.created_at.desc())

    # Apply pagination
    statement = statement.offset(offset).limit(limit)

    return list(db_session.execute(statement).scalars().all())


def count_execution_logs(
    db_session: Session,
    project_id: UUID,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    app_name: Optional[str] = None,
    function_name: Optional[str] = None,
) -> int:
    """
    Count execution logs filtered by project_id and optional filters.
    """
    from sqlalchemy import func

    statement = select(func.count(ExecutionLog.id)).filter(ExecutionLog.project_id == project_id)

    # Apply same filters as get_execution_logs
    if start_time:
        statement = statement.filter(ExecutionLog.created_at >= start_time)

    if end_time:
        statement = statement.filter(ExecutionLog.created_at <= end_time)

    if app_name:
        statement = statement.filter(ExecutionLog.app_name == app_name)

    if function_name:
        statement = statement.filter(ExecutionLog.function_name == function_name)

    return db_session.execute(statement).scalar() or 0


def get_execution_log_by_id(
    db_session: Session,
    log_id: UUID,
    project_id: UUID,
) -> ExecutionLog | None:
    """
    Get a specific execution log by ID, ensuring it belongs to the project.
    """
    logger.debug(f"Getting execution log by id={log_id}, project_id={project_id}")

    statement = select(ExecutionLog).filter(
        and_(
            ExecutionLog.id == log_id,
            ExecutionLog.project_id == project_id
        )
    )

    return db_session.execute(statement).scalar_one_or_none()


def get_execution_detail_by_id(
    db_session: Session,
    log_id: UUID,
) -> ExecutionDetail | None:
    """
    Get execution detail by log ID.
    """
    logger.debug(f"Getting execution detail by id={log_id}")

    statement = select(ExecutionDetail).filter(ExecutionDetail.id == log_id)

    return db_session.execute(statement).scalar_one_or_none()
