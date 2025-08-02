"""
CRUD operations for MCP servers.
"""
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import select, update, delete, exists
from sqlalchemy.orm import Session

from aci.common.db.sql_models import MCPServer
from aci.common.enums import MCPAuthType
from aci.common.logging_setup import get_logger
from aci.common.utils import to_snake_case, random_string
from aci.server import config

logger = get_logger(__name__)


def create_mcp_server(
        db_session: Session,
        name: str,
        app_config_id: UUID,
        auth_type: MCPAuthType,
        allowed_tools: list[str],
        mcp_link: str | None = None,
) -> MCPServer:
    """Create a new MCP server."""
    logger.debug(f"Creating MCP server: {name} for app_config_id: {app_config_id}")

    # Generate mcp server id from name
    new_id = generate_mcp_server_id(name, db_session)

    mcp_server = MCPServer(
        id=new_id,
        name=name,
        app_config_id=app_config_id,
        auth_type=auth_type,
        allowed_tools=allowed_tools,
        mcp_link=mcp_link or uuid4().hex,
    )

    db_session.add(mcp_server)
    db_session.flush()
    db_session.refresh(mcp_server)
    return mcp_server


def generate_mcp_server_id(name: str, db_session: Session) -> str:
    # Generate a unique MCP server ID based on the name by convert the name to snake_case
    # If the new id is already in use, append random characters until a unique id is found
    while True:
        new_id = f"{to_snake_case(name)}{random_string(4).lower()}"
        statement = select(exists().where(MCPServer.id == new_id))
        exists_result = db_session.execute(statement).scalar()
        if not exists_result:
            break
    return new_id


def update_mcp_server(
        db_session: Session,
        mcp_server: MCPServer,
        name: str | None = None,
        auth_type: MCPAuthType | None = None,
        allowed_tools: list[str] | None = None,
        mcp_link: str | None = None,
) -> MCPServer:
    """Update an existing MCP server."""
    logger.debug(f"Updating MCP server: {mcp_server.id}")

    if name is not None:
        mcp_server.name = name
    if auth_type is not None:
        mcp_server.auth_type = auth_type
    if allowed_tools is not None:
        mcp_server.allowed_tools = allowed_tools
    if mcp_link is not None:
        mcp_server.mcp_link = mcp_link

    db_session.flush()
    db_session.refresh(mcp_server)
    return mcp_server


def get_mcp_server_by_id(db_session: Session, mcp_server_id: str) -> MCPServer | None:
    """Get an MCP server by its ID."""
    statement = select(MCPServer).filter_by(id=mcp_server_id)
    mcp_server = db_session.execute(statement).scalar_one_or_none()
    return build_mcp_server_link(mcp_server)

def get_mcp_server_by_link(db_session: Session, mcp_link: str) -> MCPServer | None:
    """Get an MCP server by its link."""
    statement = select(MCPServer).filter_by(mcp_link=mcp_link)
    mcp_server = db_session.execute(statement).scalar_one_or_none()
    return build_mcp_server_link(mcp_server)

def build_mcp_server_link(mcp_server: MCPServer | None) -> MCPServer | None:
    if mcp_server and mcp_server.mcp_link and (
            not mcp_server.mcp_link.startswith("http://") or not mcp_server.mcp_link.startswith("https://")):
        mcp_server.mcp_link = f"{config.REDIRECT_URI_BASE}{config.ROUTER_PREFIX_MCP_SERVERS}/{mcp_server.mcp_link}/mcp"
    return mcp_server


def get_mcp_server_by_name_and_app_config(
        db_session: Session, name: str, app_config_id: UUID
) -> MCPServer | None:
    """Get an MCP server by name and app config ID."""
    statement = select(MCPServer).filter_by(name=name, app_config_id=app_config_id)
    mcp_server = db_session.execute(statement).scalar_one_or_none()
    return build_mcp_server_link(mcp_server)


def get_mcp_servers_by_app_config(
        db_session: Session,
        app_config_id: UUID,
        limit: int | None = None,
        offset: int | None = None,
) -> list[MCPServer]:
    """Get all MCP servers for a specific app configuration."""
    statement = select(MCPServer).filter_by(app_config_id=app_config_id)

    if offset is not None:
        statement = statement.offset(offset)
    if limit is not None:
        statement = statement.limit(limit)

    mcp_servers = list(db_session.execute(statement).scalars().all())
    for mcp_server in mcp_servers:
        build_mcp_server_link(mcp_server)
    return mcp_servers


def delete_mcp_server(db_session: Session, mcp_server_id: str) -> bool:
    """Delete an MCP server by ID. Returns True if deleted, False if not found."""
    statement = delete(MCPServer).filter_by(id=mcp_server_id)
    result = db_session.execute(statement)
    rows_affected = result.rowcount or 0
    return rows_affected > 0


def delete_mcp_servers_by_app_config(db_session: Session, app_config_id: UUID) -> int:
    """Delete all MCP servers for a specific app configuration. Returns the number of deleted servers."""
    statement = delete(MCPServer).filter_by(app_config_id=app_config_id)
    result = db_session.execute(statement)
    return result.rowcount or 0


def update_mcp_server_allowed_tools(
        db_session: Session,
        mcp_server_id: str,
        allowed_tools: list[str],
) -> None:
    """Update the allowed tools for an MCP server."""
    statement = update(MCPServer).filter_by(id=mcp_server_id).values(allowed_tools=allowed_tools)
    db_session.execute(statement)


def add_tool_to_mcp_server(
        db_session: Session,
        mcp_server: MCPServer,
        tool_function_id: str,
) -> MCPServer:
    """Add a tool to an MCP server's allowed tools list if not already present."""
    if tool_function_id not in mcp_server.allowed_tools:
        mcp_server.allowed_tools = mcp_server.allowed_tools + [tool_function_id]
        db_session.flush()
        db_session.refresh(mcp_server)
    return mcp_server


def remove_tool_from_mcp_server(
        db_session: Session,
        mcp_server: MCPServer,
        tool_function_id: str,
) -> MCPServer:
    """Remove a tool from an MCP server's allowed tools list."""
    if tool_function_id in mcp_server.allowed_tools:
        mcp_server.allowed_tools = [
            tool for tool in mcp_server.allowed_tools if tool != tool_function_id
        ]
        db_session.flush()
        db_session.refresh(mcp_server)
    return mcp_server


def update_mcp_server_last_used_at(
        db_session: Session,
        mcp_server_id: str,
        last_used_at: datetime,
) -> None:
    """Update the last used timestamp for an MCP server."""
    statement = update(MCPServer).filter_by(id=mcp_server_id).values(last_used_at=last_used_at)
    db_session.execute(statement)
    db_session.commit()
