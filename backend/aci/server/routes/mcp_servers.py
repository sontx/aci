import asyncio
import contextvars
import io
import json
from typing import Annotated, Any, Dict, List
from uuid import uuid4

from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import StreamingResponse
from mcp import types, ServerCapabilities, ToolsCapability
from mcp.server import Server, InitializationOptions
from mcp.server.stdio import stdio_server
from starlette.responses import JSONResponse

from aci.common import processor
from aci.common.db import crud
from aci.common.db.sql_models import Function
from aci.common.exceptions import AppNotFound
from aci.common.logging_setup import get_logger
from aci.common.schemas.function import AnthropicFunctionDefinition
from aci.server import config
from aci.server import dependencies as deps
from aci.server.routes.functions import execute_function

from typing import Iterable, AsyncIterator
from anyio import create_memory_object_stream
import anyio
import mcp.types as types
from mcp.shared.message import SessionMessage

logger = get_logger(__name__)
router = APIRouter()

mcp_request_ctx_var = contextvars.ContextVar[Annotated[deps.RequestContext, Depends(deps.get_request_context)] | None](
    "mcp_request_ctx_var", default=None)
linked_account_id_ctx_var = contextvars.ContextVar[str | None]("linked_account_id", default=None)


class MCPAppServer:
    """MCP Server for a specific app"""

    def __init__(self, app_name: str):
        self.app_name = app_name
        self.server = Server(f"mcp-{app_name}")
        self.list_tools_handler = None
        self.call_tool_handler = None
        self._setup_handlers()

    def _setup_handlers(self):
        """Setup MCP server handlers"""

        @self.server.list_tools()
        async def list_tools() -> List[types.Tool]:
            """List all available tools (functions) for this app"""
            try:
                # Get the app and its functions
                context = mcp_request_ctx_var.get()
                app = crud.apps.get_app(
                    context.db_session,
                    self.app_name,
                    False,
                    True,
                )

                if not app:
                    return []

                # Filter functions by visibility and active status
                functions = [
                    function
                    for function in app.functions
                    if function.active
                ]

                tools = []
                for function in functions:
                    # Convert function to MCP tool format
                    function_def = _format_function_definition(function)
                    tool = types.Tool(
                        name=function_def.name,
                        description=function_def.description,
                        inputSchema=function_def.input_schema
                    )
                    tools.append(tool)

                logger.info(f"Listed {len(tools)} tools for app {self.app_name}")
                return tools

            except Exception as e:
                logger.error(f"Error listing tools for app {self.app_name}: {str(e)}")
                return []

        def _format_function_definition(
                function: Function
        ) -> AnthropicFunctionDefinition:
            return AnthropicFunctionDefinition(
                name=function.name,
                description=function.description,
                input_schema=processor.filter_visible_properties(function.parameters),
            )

        @self.server.call_tool()
        async def call_tool(name: str, arguments: Dict[str, Any]) -> List[types.TextContent]:
            """Call a specific tool (function)"""
            try:
                logger.info(f"Calling tool {name} with arguments: {arguments}")

                # Execute the function
                context = mcp_request_ctx_var.get()
                result = await execute_function(
                    db_session=context.db_session,
                    project=context.project,
                    function_name=name,
                    function_input=arguments,
                    linked_account_owner_id=linked_account_id_ctx_var.get(),
                )

                # Format the result for MCP
                if result.success:
                    content = types.TextContent(
                        type="text",
                        text=json.dumps(result.data, indent=2, default=str)
                    )
                else:
                    content = types.TextContent(
                        type="text",
                        text=f"Error: {result.error}"
                    )

                return [content]

            except Exception as e:
                logger.error(f"Error calling tool {name}: {str(e)}")
                error_content = types.TextContent(
                    type="text",
                    text=f"Error executing tool {name}: {str(e)}"
                )
                return [error_content]

        # Store handlers for later use
        self.list_tools_handler = list_tools
        self.call_tool_handler = call_tool


# Global dictionary to cache MCP server instances for reuse
mcp_servers_cache: Dict[str, MCPAppServer] = {}

async def _run_single_mcp_request(
    server: Server,
    request_msg: types.JSONRPCMessage,
) -> list[types.JSONRPCMessage]:
    """
    Feed one JSON‑RPC message into an MCP Server and collect all outbound
    messages.  We use `stateless=True`, so every HTTP call is independent.
    """
    in_send,  in_recv  = create_memory_object_stream(max_buffer_size=0)
    out_send, out_recv = create_memory_object_stream(max_buffer_size=0)

    async def _srv():
        await server.run(
            read_stream=in_recv,
            write_stream=out_send,
            initialization_options=server.create_initialization_options(),
            stateless=True,
        )

    async def _cli():
        await in_send.send(SessionMessage(request_msg))
        await in_send.aclose()

    async with anyio.create_task_group() as tg:
        tg.start_soon(_srv)
        tg.start_soon(_cli)

    messages: list[types.JSONRPCMessage] = []
    async with out_recv:
        async for sm in out_recv:
            messages.append(sm.message)

    return messages

async def create_mcp_stream(app_name: str, context: deps.RequestContext) -> StreamingResponse:
    """Create a streaming MCP server for a specific app"""

    # Verify the app exists
    app = crud.apps.get_app(
        context.db_session,
        app_name,
        False,
        True,
    )

    if not app:
        raise AppNotFound(f"App={app_name} not found")

    # Get or create MCP server instance from cache
    if app_name not in mcp_servers_cache:
        logger.info(f"Creating new MCP server instance for app: {app_name}")
        mcp_servers_cache[app_name] = MCPAppServer(app_name)
    else:
        logger.info(f"Reusing cached MCP server instance for app: {app_name}")

    mcp_server = mcp_servers_cache[app_name]

    async def generate_mcp_stream():
        """Generate MCP protocol stream"""
        try:
            # Create in-memory streams for MCP communication
            reader_stream = asyncio.StreamReader()
            writer_stream = io.StringIO()

            # Run the MCP server
            capabilities = ServerCapabilities()
            capabilities.tools = ToolsCapability()

            # Use proper JSON-RPC transport instead of stdio
            async with stdio_server() as (read_stream, write_stream):
                await mcp_server.server.run(
                    read_stream=read_stream,
                    write_stream=write_stream,
                    initialization_options=InitializationOptions(
                        server_name=f"mcp-{app_name}",
                        server_version=config.APP_VERSION,
                        capabilities=capabilities
                    )
                )
        except Exception as e:
            print(e)
            logger.error(f"Error in MCP stream for app {app_name}: {str(e)}")
            yield json.dumps({"error": str(e)})

    return StreamingResponse(
        generate_mcp_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        }
    )

@router.get("/{app_name}/tools", response_model=None)
async def list_tools_json(
    app_name: str,
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
):
    mcp_request_ctx_var.set(context)

    # Look‑up / cache the Server
    srv = mcp_servers_cache.setdefault(app_name, MCPAppServer(app_name)).server

    # Build a ListToolsRequest – no params object in MCP 1.12
    list_req = types.ListToolsRequest()
    msg = types.JSONRPCRequest(
        jsonrpc="2.0",
        id=str(uuid4()),
        method=list_req.method,
        params=list_req.params,  # this is `None`
    )

    responses = await _run_single_mcp_request(srv, msg)

    # Return the first proper response
    for m in responses:
        if isinstance(m.root, types.JSONRPCResponse):
            result = m.root.result  # -> ListToolsResult
            return JSONResponse(result.model_dump(mode="json"))

    # If only errors returned:
    err = next(
        (m.root for m in responses if isinstance(m.root, types.JSONRPCError)), None
    )
    raise HTTPException(status_code=500, detail=str(err or "Unknown error"))

@router.post("/{app_name}/tools/{tool_name}/invoke")
async def call_tool_json(
    app_name: str,
    tool_name: str,
    request: Request,
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
):

    mcp_request_ctx_var.set(context)
    linked_account_id_ctx_var.set(request.headers.get(config.LINKED_ACCOUNT_ID_HEADER))

    srv = mcp_servers_cache.setdefault(app_name, MCPAppServer(app_name)).server

    # Arguments come from JSON body like  {"args": {...}}
    body = await request.json()
    arguments = body.get("args", {})

    call_req = types.CallToolRequest(
        params=types.CallToolParams(name=tool_name, arguments=arguments)
    )
    msg = types.JSONRPCRequest(
        jsonrpc="2.0",
        id=str(uuid4()),
        method=call_req.method(),
        params=call_req.params,
    )

    responses = await _run_single_mcp_request(srv, msg)

    for m in responses:
        if isinstance(m.root, types.JSONRPCResponse):
            return JSONResponse(m.root.result.model_dump(mode="json"))

    err = next(
        (m.root for m in responses if isinstance(m.root, types.JSONRPCError)), None
    )
    raise HTTPException(status_code=500, detail=str(err or "Unknown error"))

@router.post("/{app_name}")
async def mcp_root_single_message(
    app_name: str,
    request: Request,
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
):
    """
    Accept **any** single JSON‑RPC message for the given app and return the
    first MCP response/error as `application/json`.

    Suitable for `initialize`, `ping`, custom admin calls, etc.
    """
    # Parse inbound JSON
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {exc}")

    try:
        inbound_msg = types.JSONRPCMessage.model_validate(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON‑RPC: {exc}")

    # Look‑up / cache Server
    srv = mcp_servers_cache.setdefault(app_name, MCPAppServer(app_name)).server

    # Run exactly one MCP request (stateless)
    responses = await _run_single_mcp_request(srv, inbound_msg)

    # Return the first response / error
    for m in responses:
        if isinstance(m.root, (types.JSONRPCResponse, types.JSONRPCError)):
            return JSONResponse(
                m.root.model_dump(mode="json", by_alias=True, exclude_none=True)
            )

    # No response produced – shouldn’t happen, but handle gracefully
    raise HTTPException(status_code=500, detail="No response generated")