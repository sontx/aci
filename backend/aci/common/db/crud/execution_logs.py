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


def get_execution_logs_statistics(
        db_session: Session,
        project_id: UUID,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        app_name: Optional[str] = None,
        function_name: Optional[str] = None,
        app_configuration_id: UUID | None = None,
        linked_account_owner_id: str | None = None):
    """
    Get execution logs statistics with a single optimized PostgreSQL query.
    Returns statistics including total count, success/failure counts, and execution time metrics.
    """
    from sqlalchemy import func, case, cast, Numeric
    from aci.common.enums import ExecutionStatus
    from aci.common.schemas.execution_log import ExecutionLogsStatistics

    logger.debug(
        f"Getting execution logs statistics for project_id={project_id}, "
        f"start_time={start_time}, end_time={end_time}, "
        f"app_name={app_name}, function_name={function_name}"
    )

    # Build optimized direct aggregation query (no subquery needed)
    query = select(
        func.count().label('total_count'),
        func.sum(
            case((ExecutionLog.status == ExecutionStatus.SUCCESS, 1), else_=0)
        ).label('success_count'),
        func.sum(
            case((ExecutionLog.status == ExecutionStatus.FAILED, 1), else_=0)
        ).label('failure_count'),
        # Cast to numeric for better PostgreSQL performance with averages
        func.avg(cast(ExecutionLog.execution_time, Numeric)).label('avg_execution_time'),
        func.min(ExecutionLog.execution_time).label('min_execution_time'),
        func.max(ExecutionLog.execution_time).label('max_execution_time')
    ).filter(ExecutionLog.project_id == project_id)

    # Apply optional filters directly to the main query
    if start_time:
        query = query.filter(ExecutionLog.created_at >= start_time)

    if end_time:
        query = query.filter(ExecutionLog.created_at <= end_time)

    if app_name:
        query = query.filter(ExecutionLog.app_name == app_name)

    if function_name:
        query = query.filter(ExecutionLog.function_name == function_name)

    if app_configuration_id:
        query = query.filter(ExecutionLog.app_configuration_id == app_configuration_id)

    if linked_account_owner_id:
        query = query.filter(ExecutionLog.linked_account_owner_id == linked_account_owner_id)

    # Execute the optimized query
    result = db_session.execute(query).one()

    # Handle case where no records are found
    if result.total_count == 0:
        return ExecutionLogsStatistics(
            total_count=0,
            success_count=0,
            failure_count=0,
            average_execution_time=0.0,
            min_execution_time=0.0,
            max_execution_time=0.0
        )

    return ExecutionLogsStatistics(
        total_count=result.total_count,
        success_count=result.success_count or 0,
        failure_count=result.failure_count or 0,
        average_execution_time=float(result.avg_execution_time or 0),
        min_execution_time=float(result.min_execution_time or 0),
        max_execution_time=float(result.max_execution_time or 0)
    )
