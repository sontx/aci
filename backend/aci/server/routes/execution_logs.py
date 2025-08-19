from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query

from aci.common.db import crud
from aci.common.exceptions import ExecutionLogNotFound
from aci.common.logging_setup import get_logger
from aci.common.schemas.common import Paged
from aci.common.schemas.execution_log import (
    ExecutionLogResponse,
    ExecutionDetailResponse,
    ExecutionLogWithDetailResponse,
)
from aci.server.dependencies import get_request_context, RequestContext

logger = get_logger(__name__)
router = APIRouter()


@router.get("", response_model=Paged[ExecutionLogResponse])
async def get_execution_logs(
    context: Annotated[RequestContext, Depends(get_request_context)],
    start_time: datetime | None = Query(
        default=None,
        description="Filter logs after this time (ISO format)"
    ),
    end_time: datetime | None = Query(
        default=None,
        description="Filter logs before this time (ISO format)"
    ),
    app_name: str | None = Query(
        default=None,
        description="Filter logs by app name"
    ),
    function_name: str | None = Query(
        default=None,
        description="Filter logs by function name"
    ),
    app_configuration_id: UUID | None = Query(
        default=None,
        description="Filter logs by app configuration ID"
    ),
    linked_account_owner_id: str | None = Query(
        default=None,
        description="Filter logs by linked account owner ID"
    ),
    limit: int = Query(
        default=100,
        ge=1,
        le=1000,
        description="Number of logs to return"
    ),
    offset: int = Query(
        default=0,
        ge=0,
        description="Number of logs to skip"
    ),
) -> Paged[ExecutionLogResponse]:
    """
    Get execution logs filtered by project and optional query parameters.
    """
    logger.debug(
        f"Getting execution logs for project_id={context.project.id}, "
        f"start_time={start_time}, end_time={end_time}, "
        f"app_name={app_name}, function_name={function_name}, "
        f"limit={limit}, offset={offset}"
    )

    # Get the logs
    execution_logs = crud.execution_logs.get_execution_logs(
        db_session=context.db_session,
        project_id=context.project.id,
        start_time=start_time,
        end_time=end_time,
        app_name=app_name,
        function_name=function_name,
        app_configuration_id=app_configuration_id,
        linked_account_owner_id=linked_account_owner_id,
        limit=limit,
        offset=offset,
    )

    # Get total count for pagination
    total_count = crud.execution_logs.count_execution_logs(
        db_session=context.db_session,
        project_id=context.project.id,
        start_time=start_time,
        end_time=end_time,
        app_name=app_name,
        function_name=function_name,
    )

    # Convert to response models
    log_responses = [
        ExecutionLogResponse(
            id=log.id,
            function_name=log.function_name,
            app_name=log.app_name,
            linked_account_owner_id=log.linked_account_owner_id,
            app_configuration_id=log.app_configuration_id,
            status=log.status,
            execution_time=log.execution_time,
            created_at=log.created_at,
            project_id=log.project_id,
        )
        for log in execution_logs
    ]

    return Paged(total=total_count, items=log_responses)


@router.get("/{log_id}", response_model=ExecutionLogWithDetailResponse)
async def get_execution_log_detail(
    context: Annotated[RequestContext, Depends(get_request_context)],
    log_id: UUID,
) -> ExecutionLogWithDetailResponse:
    """
    Get a specific execution log with its detail by ID.
    """
    logger.debug(f"Getting execution log detail for log_id={log_id}, project_id={context.project.id}")

    # Get the execution log
    execution_log = crud.execution_logs.get_execution_log_by_id(
        db_session=context.db_session,
        log_id=log_id,
        project_id=context.project.id,
    )

    if not execution_log:
        logger.error(f"Execution log not found, log_id={log_id}, project_id={context.project.id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Execution log with ID {log_id} not found"
        )

    # Get the execution detail
    execution_detail = crud.execution_logs.get_execution_detail_by_id(
        db_session=context.db_session,
        log_id=log_id,
    )

    # Build response with detail
    return ExecutionLogWithDetailResponse(
        id=execution_log.id,
        function_name=execution_log.function_name,
        app_name=execution_log.app_name,
        linked_account_owner_id=execution_log.linked_account_owner_id,
        app_configuration_id=execution_log.app_configuration_id,
        status=execution_log.status,
        execution_time=execution_log.execution_time,
        created_at=execution_log.created_at,
        project_id=execution_log.project_id,
        request=execution_detail.request if execution_detail else None,
        response=execution_detail.response if execution_detail else None,
    )
