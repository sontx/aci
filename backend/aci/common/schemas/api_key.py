from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from aci.common.db.sql_models import Project
from aci.common.enums import APIKeyStatus


class APIKeyCreate(BaseModel):
    """Schema for creating a new API key"""
    name: str


class APIKeyPublic(BaseModel):
    """Public representation of an API key"""
    id: UUID
    name: str
    key: str
    project_id: UUID
    status: APIKeyStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class APIKeyUpdate(BaseModel):
    """Schema for updating an API key"""
    status: APIKeyStatus | None = None


class APIKeyExtract(BaseModel):
    id: UUID
    name: str
    project: Project
