from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from aci.common.enums import ExecutionStatus


class ExecutionLogResponse(BaseModel):
    """Response model for execution log"""
    id: UUID
    function_name: str
    app_name: str
    linked_account_owner_id: str | None
    app_configuration_id: UUID | None
    status: ExecutionStatus
    execution_time: int = Field(description="Execution time in milliseconds")
    created_at: datetime
    project_id: UUID


class ExecutionDetailResponse(BaseModel):
    """Response model for execution detail"""
    id: UUID
    request: dict | None
    response: Any | None


class ExecutionLogWithDetailResponse(ExecutionLogResponse):
    """Response model for execution log with detail"""
    request: dict | None = None
    response: Any | None = None


class ExecutionLogQueryParams(BaseModel):
    """Query parameters for execution log filtering"""
    start_time: datetime | None = Field(default=None, description="Filter logs after this time (ISO format)")
    end_time: datetime | None = Field(default=None, description="Filter logs before this time (ISO format)")
    app_name: str | None = Field(default=None, description="Filter logs by app name")
    function_name: str | None = Field(default=None, description="Filter logs by function name")
    limit: int = Field(default=100, ge=1, le=1000, description="Number of logs to return")
    offset: int = Field(default=0, ge=0, description="Number of logs to skip")
