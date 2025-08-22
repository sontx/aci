from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from aci.common.enums import MCPAuthType


# Pydantic models for request/response
class MCPServerCreate(BaseModel):
    name: str = Field(..., description="Name of the MCP server")
    app_config_id: UUID = Field(..., description="ID of the associated application configuration")
    auth_type: MCPAuthType = Field(..., description="Authentication type for the MCP server")
    allowed_tools: list[str] = Field(
        ...,
        description="List of tools allowed to access this MCP server",
    )


class MCPServerResponse(BaseModel):
    id: str
    name: str
    app_config_id: UUID
    app_name: str
    auth_type: MCPAuthType
    allowed_tools: list[str]
    mcp_link: str | None
    created_at: datetime
    updated_at: datetime
    last_used_at: datetime | None


class MCPServerListQuery(BaseModel):
    app_config_id: UUID | None = Field(default=None, description="ID of the associated application configuration")
    auth_type: MCPAuthType | None = Field(
        default=None, description="Filter by authentication type of the MCP server"
    )
    limit: int | None = Field(default=None, ge=1, le=1000, description="Maximum number of MCP servers to return")
    offset: int | None = Field(default=None, ge=0, description="Pagination offset for the list of MCP servers")
