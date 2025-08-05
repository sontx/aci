from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status, Request

from aci.common.db import crud
from aci.common.db.crud.mcp_servers import get_full_mcp_server_link
from aci.common.db.sql_models import MCPServer
from aci.common.logging_setup import get_logger
from aci.common.schemas.mcp_servers import MCPServerResponse, MCPServerCreate, MCPServerListQuery
from aci.server import dependencies as deps
from aci.server.mcp.mcp_handlers import handle_mcp_request

logger = get_logger(__name__)
router = APIRouter()


@router.post("")
async def create_mcp_server(
        context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
        mcp_server_data: MCPServerCreate,
) -> MCPServerResponse:
    """
    Create a new MCP server.
    """
    logger.debug(f"Creating MCP server: {mcp_server_data.name} for app_config_id: {mcp_server_data.app_config_id}")

    # Verify the app configuration exists
    from aci.common.db.sql_models import AppConfiguration
    from sqlalchemy import select

    app_config_statement = select(AppConfiguration).filter_by(id=mcp_server_data.app_config_id)
    app_config = context.db_session.execute(app_config_statement).scalar_one_or_none()

    if not app_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"App configuration with ID {mcp_server_data.app_config_id} not found"
        )

    # Check if MCP server with the same name already exists for this app config
    existing_server = crud.mcp_servers.get_mcp_server_by_name_and_app_config(
        context.db_session,
        mcp_server_data.name,
        mcp_server_data.app_config_id
    )

    if existing_server:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"MCP server with name '{mcp_server_data.name}' already exists for this app configuration"
        )

    # Create the MCP server
    mcp_server = crud.mcp_servers.create_mcp_server(
        context.db_session,
        name=mcp_server_data.name,
        app_config_id=mcp_server_data.app_config_id,
        auth_type=mcp_server_data.auth_type,
        allowed_tools=mcp_server_data.allowed_tools,
    )

    context.db_session.commit()

    return to_mcp_server_response(mcp_server)


def to_mcp_server_response(mcp_server: MCPServer) -> MCPServerResponse:
    return MCPServerResponse(
        id=mcp_server.id,
        name=mcp_server.name,
        app_config_id=mcp_server.app_config_id,
        app_name=mcp_server.app_name,
        auth_type=mcp_server.auth_type,
        allowed_tools=mcp_server.allowed_tools,
        mcp_link=get_full_mcp_server_link(mcp_server.mcp_link),
        created_at=mcp_server.created_at,
        updated_at=mcp_server.updated_at,
        last_used_at=mcp_server.last_used_at
    )


@router.get("")
async def list_mcp_servers(
        context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
        query_params: Annotated[MCPServerListQuery, Query()],
) -> list[MCPServerResponse]:
    """
    Get a list of MCP servers with optional filtering.
    """
    if query_params.app_config_id:
        mcp_servers = crud.mcp_servers.get_mcp_servers_by_app_config(
            context.db_session,
            query_params.app_config_id,
            query_params.limit,
            query_params.offset,
        )
    else:
        # If no app_config_id specified, we need a general list function
        from aci.common.db.sql_models import MCPServer
        from sqlalchemy import select

        statement = select(MCPServer)

        if query_params.auth_type:
            statement = statement.filter_by(auth_type=query_params.auth_type)
        if query_params.offset:
            statement = statement.offset(query_params.offset)
        if query_params.limit:
            statement = statement.limit(query_params.limit)

        mcp_servers = list(context.db_session.execute(statement).scalars().all())

    response = []
    for server in mcp_servers:
        response.append(to_mcp_server_response(server))

    return response


@router.get("/{mcp_server_id}")
async def get_mcp_server(
        context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
        mcp_server_id: str,
) -> MCPServerResponse:
    """
    Get a specific MCP server by ID.
    """
    mcp_server = crud.mcp_servers.get_mcp_server_by_id(context.db_session, mcp_server_id)

    if not mcp_server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCP server with ID {mcp_server_id} not found"
        )

    return to_mcp_server_response(mcp_server)


@router.put("/{mcp_server_id}/regenerate-link")
async def regenerate_mcp_link(
        context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
        mcp_server_id: str,
) -> MCPServerResponse:
    """
    Regenerate the MCP link for an existing MCP server.
    """
    mcp_server = crud.mcp_servers.get_mcp_server_by_id(context.db_session, mcp_server_id)

    if not mcp_server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCP server with ID {mcp_server_id} not found"
        )

    # Regenerate the MCP link
    new_mcp_link = crud.mcp_servers.regenerate_mcp_link(context.db_session, mcp_server)

    context.db_session.commit()

    return to_mcp_server_response(mcp_server)


@router.delete("/{mcp_server_id}")
async def delete_mcp_server(
        context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
        mcp_server_id: str,
) -> None:
    """
    Delete an MCP server by ID.
    """
    success = crud.mcp_servers.delete_mcp_server(context.db_session, mcp_server_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCP server with ID {mcp_server_id} not found"
        )

    context.db_session.commit()


@router.post("/{mcp_server_id}/tools/{tool_function_id}")
async def add_tool_to_mcp_server(
        context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
        mcp_server_id: str,
        tool_function_id: str,
) -> None:
    """
    Add a tool to an MCP server's allowed tools list.
    """
    mcp_server = crud.mcp_servers.get_mcp_server_by_id(context.db_session, mcp_server_id)

    if not mcp_server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCP server with ID {mcp_server_id} not found"
        )

    crud.mcp_servers.add_tool_to_mcp_server(
        context.db_session,
        mcp_server,
        tool_function_id,
    )

    context.db_session.commit()


@router.delete("/{mcp_server_id}/tools/{tool_function_id}")
async def remove_tool_from_mcp_server(
        context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
        mcp_server_id: str,
        tool_function_id: str,
) -> None:
    """
    Remove a tool from an MCP server's allowed tools list.
    """
    mcp_server = crud.mcp_servers.get_mcp_server_by_id(context.db_session, mcp_server_id)

    if not mcp_server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCP server with ID {mcp_server_id} not found"
        )

    crud.mcp_servers.remove_tool_from_mcp_server(
        context.db_session,
        mcp_server,
        tool_function_id,
    )

    context.db_session.commit()


@router.api_route("/{link}/mcp", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def mcp_handler(
        link: str,
        request: Request,
):
    return await handle_mcp_request(link, request)
