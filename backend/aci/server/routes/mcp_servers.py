import contextvars
import json
from typing import Annotated, Any, Dict, List

from fastapi import APIRouter, Depends, Request
from mcp import types
from mcp.server.lowlevel import Server
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from starlette.responses import StreamingResponse
from starlette.types import Receive, Scope, Send, Message

from aci.common import processor
from aci.common.db import crud
from aci.common.db.sql_models import Function
from aci.common.exceptions import AppNotFound
from aci.common.logging_setup import get_logger
from aci.common.schemas.function import AnthropicFunctionDefinition
from aci.server import config
from aci.server import dependencies as deps
from aci.server.routes.functions import execute_function

logger = get_logger(__name__)
router = APIRouter()

mcp_request_ctx_var = contextvars.ContextVar[Annotated[deps.RequestContext, Depends(deps.get_request_context)] | None](
    "mcp_request_ctx_var", default=None)
linked_account_id_ctx_var = contextvars.ContextVar[str | None]("linked_account_id", default=None)


class MCPAppServer:
    """MCP Server for a specific app using StreamableHTTPSessionManager"""

    def __init__(self, app_name: str):
        self.app_name = app_name
        self.server = Server(f"mcp-{app_name}")
        self.session_manager = None
        self._session_manager_started = False
        self._setup_handlers()

    def _setup_handlers(self):
        """Setup MCP server handlers"""

        @self.server.list_tools()
        async def list_tools() -> List[types.Tool]:
            """List all available tools (functions) for this app"""
            try:
                # Get the app and its functions
                context = mcp_request_ctx_var.get()
                if not context:
                    logger.warning(f"No context available for app {self.app_name}")
                    return []

                app = crud.apps.get_app(
                    context.db_session,
                    self.app_name,
                    False,
                    True,
                )

                if not app:
                    logger.warning(f"App {self.app_name} not found")
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
                    function_def = self._format_function_definition(function)
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

        @self.server.call_tool()
        async def call_tool(name: str, arguments: Dict[str, Any]) -> List[types.TextContent]:
            """Call a specific tool (function)"""
            try:
                logger.info(f"Calling tool {name} with arguments: {arguments}")

                # Execute the function
                context = mcp_request_ctx_var.get()
                if not context:
                    raise ValueError("No context available for tool execution")

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

    def _format_function_definition(self, function: Function) -> AnthropicFunctionDefinition:
        """Format function definition for MCP"""
        return AnthropicFunctionDefinition(
            name=function.name,
            description=function.description,
            input_schema=processor.filter_visible_properties(function.parameters),
        )

    async def get_session_manager(self, json_response: bool = False) -> StreamableHTTPSessionManager:
        """Get or create StreamableHTTPSessionManager for this app"""
        if self.session_manager is None:
            self.session_manager = StreamableHTTPSessionManager(
                app=self.server,
                event_store=None,  # No event store for stateless mode
                json_response=json_response,
                stateless=True,  # True stateless mode
            )

        # Start the session manager if not already started
        if not self._session_manager_started:
            # Start the session manager's run context once
            self._session_context = self.session_manager.run()
            await self._session_context.__aenter__()
            self._session_manager_started = True

        return self.session_manager

    async def handle_request(self, scope: Scope, receive: Receive, send: Send, json_response: bool = False) -> None:
        """Handle HTTP request for this app's MCP server"""
        session_manager = await self.get_session_manager(json_response=json_response)

        # Session manager is already running from get_session_manager, just handle the request
        await session_manager.handle_request(scope, receive, send)

    async def cleanup(self):
        """Clean up resources"""
        if self._session_manager_started and hasattr(self, '_session_context'):
            try:
                await self._session_context.__aexit__(None, None, None)
            except Exception as e:
                logger.warning(f"Error cleaning up session context for {self.app_name}: {e}")

        self.session_manager = None
        self._session_manager_started = False
        if hasattr(self, '_session_context'):
            delattr(self, '_session_context')


# Global dictionary to cache MCP server instances for reuse
mcp_servers_cache: Dict[str, MCPAppServer] = {}


def get_or_create_mcp_server(app_name: str) -> MCPAppServer:
    """Get or create MCP server instance for the given app"""
    if app_name not in mcp_servers_cache:
        logger.info(f"Creating new MCP server instance for app: {app_name}")
        mcp_servers_cache[app_name] = MCPAppServer(app_name)
    else:
        logger.debug(f"Reusing cached MCP server instance for app: {app_name}")

    return mcp_servers_cache[app_name]


async def verify_app_exists(app_name: str, context: deps.RequestContext) -> None:
    """Verify that the app exists and is accessible"""
    app = crud.apps.get_app(
        context.db_session,
        app_name,
        False,
        True,
    )

    if not app:
        raise AppNotFound(f"App={app_name} not found")


@router.api_route("/{app_name}", methods=["GET", "POST"])
async def mcp_handler(
    app_name: str,
    request: Request,
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
):
    """
    Main MCP handler that routes all MCP requests for a specific app.
    Supports both streaming (SSE) and JSON responses based on Accept header.
    """
    # Verify app exists
    await verify_app_exists(app_name, context)

    # Set context variables
    mcp_request_ctx_var.set(context)
    linked_account_id_ctx_var.set(request.headers.get(config.LINKED_ACCOUNT_ID_HEADER))

    # Get MCP server for this app
    mcp_server = get_or_create_mcp_server(app_name)

    # Determine response format based on Accept header
    accept_header = request.headers.get("accept", "")
    json_response = "application/json" in accept_header

    # Buffer to collect response body parts
    body_chunks: List[bytes] = []
    response_headers = {}
    status_code = 200

    async def send(message: Message):
        nonlocal status_code, response_headers
        if message["type"] == "http.response.start":
            status_code = message["status"]
            # Convert headers from list of tuples to dict with string keys
            headers_list = message.get("headers", [])
            response_headers = {}
            for header_tuple in headers_list:
                if len(header_tuple) == 2:
                    key, value = header_tuple
                    # Ensure both key and value are strings
                    if isinstance(key, bytes):
                        key = key.decode('utf-8', errors='replace')
                    if isinstance(value, bytes):
                        value = value.decode('utf-8', errors='replace')
                    response_headers[key] = value
        elif message["type"] == "http.response.body":
            body_chunks.append(message.get("body", b""))
            # If "more_body" is True, this may be called again

    # Handle the request
    await mcp_server.handle_request(request.scope, request.receive, send, json_response)

    return StreamingResponse(
        iter(body_chunks),
        status_code=status_code,
        headers=response_headers,
        media_type=response_headers.get("content-type", "application/octet-stream"),
    )