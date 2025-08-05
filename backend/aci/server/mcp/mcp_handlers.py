import asyncio
import contextvars
import json
from dataclasses import dataclass
from datetime import datetime, UTC, timedelta
from typing import Any, Dict, List
from uuid import UUID

from fastapi import APIRouter, Request, HTTPException
from mcp import types
from mcp.server.lowlevel import Server
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from mcp.types import Tool as MCPTool
from sqlalchemy.orm import Session
from starlette.types import Receive, Scope, Send

from aci.common import processor, utils
from aci.common.db import crud
from aci.common.db.crud.apps import get_app
from aci.common.db.crud.functions import get_functions_by_app_id
from aci.common.db.crud.mcp_servers import get_mcp_server_by_id
from aci.common.db.sql_models import Function, MCPServer
from aci.common.exceptions import FunctionNotFound, AppConfigurationNotFound, AppConfigurationDisabled, \
    LinkedAccountNotFound, LinkedAccountDisabled
from aci.common.logging_setup import get_logger
from aci.common.schemas.function import FunctionExecutionResult
from aci.server import config
from aci.server import security_credentials_manager as scm
from aci.server.function_executors import get_executor
from aci.server.security_credentials_manager import SecurityCredentialsResponse

logger = get_logger(__name__)
router = APIRouter()


class MCPRequestContext:
    def __init__(self, db_session: Session, linked_account_id: str | None = None):
        self.db_session = db_session
        self.linked_account_id = linked_account_id


mcp_request_ctx_var = contextvars.ContextVar[MCPRequestContext | None]("mcp_request_ctx_var", default=None)


class MCPAppServer:
    """MCP Server for a specific app using StreamableHTTPSessionManager"""

    def __init__(self, mcp_server: MCPServer, db_session: Session):
        self.mcp_server_id = mcp_server.id
        self.session_manager = None
        self._session_manager_started = False
        self._initialize(db_session)
        self._setup_handlers()

    def _initialize(self, db_session: Session):
        def format_function_definition(function: Function) -> MCPTool:
            """Format function definition for MCP"""

            return MCPTool(
                name=function.name,
                description=function.description,
                inputSchema=processor.filter_visible_properties(function.parameters),
                outputSchema=processor.filter_visible_properties(function.response) if function.response else None,
            )

        mcp_server = get_mcp_server_by_id(db_session, self.mcp_server_id)
        if not mcp_server:
            raise HTTPException(
                status_code=404,
                detail=f"MCP server with ID {self.mcp_server_id} not found"
            )

        app = get_app(db_session, mcp_server.app_name, public_only=False, active_only=False)
        if not app:
            raise HTTPException(
                status_code=404,
                detail=f"App with name {mcp_server.app_name} not found"
            )

        self.app_name = app.name
        self.app_config_id = mcp_server.app_config_id

        allowed_function_names = mcp_server.allowed_tools
        allowed_functions: list[Function] = []
        if allowed_function_names:
            all_functions = get_functions_by_app_id(db_session, app.id)
            allowed_functions = [
                function for function in all_functions
                if function.name in allowed_function_names and function.active
            ]

        tools: List[types.Tool] = []
        for function in allowed_functions:
            # Convert function to MCP tool format
            function_def = format_function_definition(function)
            tool = types.Tool(
                name=function_def.name,
                description=function_def.description,
                inputSchema=function_def.inputSchema,
                outputSchema=function_def.outputSchema,
            )
            tools.append(tool)
        self.tools = tools

        self.server = Server(mcp_server.name)

    def _setup_handlers(self):
        """Setup MCP server handlers"""

        @self.server.list_tools()
        async def list_tools() -> List[types.Tool]:
            """List all available tools (functions) for this app"""
            return self.tools

        @self.server.call_tool()
        async def call_tool(name: str, arguments: Dict[str, Any]) -> Any:
            """Call a specific tool (function)"""
            logger.info(f"Calling tool {name} with arguments: {arguments}")

            context = mcp_request_ctx_var.get()
            function, result = await execute_function(
                db_session=context.db_session,
                function_name=name,
                function_input=arguments,
                app_config_id=self.app_config_id,
                mcp_server_id=self.mcp_server_id,
                linked_account_owner_id=context.linked_account_id or "default",
            )

            # Format the result for MCP
            if result.success:
                if function.response and isinstance(result.data, dict):
                    return result.data

                content = types.TextContent(
                    type="text",
                    text=json.dumps(result.data)
                )
                return [content]
            else:
                raise Exception(result.error)

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


async def execute_function(
        db_session: Session,
        function_name: str,
        function_input: dict,
        app_config_id: UUID,
        mcp_server_id: str,
        linked_account_owner_id: str,
) -> tuple[Function, FunctionExecutionResult]:
    # Get the function
    function = crud.functions.get_function(
        db_session,
        function_name,
        False,
        True,
    )
    if not function:
        logger.error(
            f"Failed to execute function, function not found, function_name={function_name}"
        )
        raise FunctionNotFound(f"function={function_name} not found")

    # Check if the App (that this function belongs to) is configured
    app_configuration = crud.app_configurations.get_app_configuration_by_id(db_session, app_config_id)
    if not app_configuration:
        logger.error(
            f"Failed to execute function, app configuration not found, "
            f"function_name={function_name} app_name={function.app.name}"
        )
        raise AppConfigurationNotFound(
            f"Configuration for app={function.app.name} not found, please configure the app first {config.DEV_PORTAL_URL}/apps/{function.app.name}"
        )
    # Check if user has disabled the app configuration
    if not app_configuration.enabled:
        logger.error(
            f"Failed to execute function, app configuration is disabled, "
            f"function_name={function_name} app_name={function.app.name} app_configuration_id={app_configuration.id}"
        )
        raise AppConfigurationDisabled(
            f"Configuration for app={function.app.name} is disabled, please enable the app first {config.DEV_PORTAL_URL}/appconfigs/{function.app.name}"
        )

    # Check if the linked account status (configured, enabled, etc.)
    linked_account = crud.linked_accounts.get_linked_account(
        db_session,
        app_configuration.project_id,
        function.app.name,
        linked_account_owner_id,
    )
    if not linked_account:
        logger.error(
            f"Failed to execute function, linked account not found, "
            f"function_name={function_name} app_name={function.app.name} linked_account_owner_id={linked_account_owner_id}"
        )
        raise LinkedAccountNotFound(
            f"Linked account with linked_account_owner_id={linked_account_owner_id} not found for app={function.app.name},"
            f"please link the account for this app here: {config.DEV_PORTAL_URL}/appconfigs/{function.app.name}"
        )

    if not linked_account.enabled:
        logger.error(
            f"Failed to execute function, linked account is disabled, "
            f"function_name={function_name} app_name={function.app.name} linked_account_owner_id={linked_account_owner_id} linked_account_id={linked_account.id}"
        )
        raise LinkedAccountDisabled(
            f"Linked account with linked_account_owner_id={linked_account_owner_id} is disabled for app={function.app.name},"
            f"please enable the account for this app here: {config.DEV_PORTAL_URL}/appconfigs/{function.app.name}"
        )

    security_credentials_response: SecurityCredentialsResponse = await scm.get_security_credentials(
        app_configuration.app, app_configuration, linked_account
    )

    scm.update_security_credentials(
        db_session, function.app, linked_account, security_credentials_response
    )

    logger.info(
        f"Fetched security credentials for function execution, function_name={function_name}, "
        f"app_name={function.app.name}, linked_account_owner_id={linked_account_owner_id}, "
        f"linked_account_id={linked_account.id}, is_updated={security_credentials_response.is_updated}, "
        f"is_app_default_credentials={security_credentials_response.is_app_default_credentials}"
    )
    db_session.commit()

    function_executor = get_executor(function.protocol, linked_account)
    logger.info(
        f"Instantiated function executor, function_executor={type(function_executor)}, "
        f"function={function_name}"
    )

    # Execute the function
    execution_result = function_executor.execute(
        function,
        function_input,
        security_credentials_response.scheme,
        security_credentials_response.credentials,
    )

    last_used_at: datetime = datetime.now(UTC)
    crud.linked_accounts.update_linked_account_last_used_at(
        db_session,
        last_used_at,
        linked_account,
    )
    crud.mcp_servers.update_mcp_server_last_used_at(
        db_session,
        mcp_server_id,
        last_used_at,
    )
    db_session.commit()

    if not execution_result.success:
        logger.error(
            f"Function execution result error, function_name={function_name}, "
            f"error={execution_result.error}"
        )

    return function, execution_result


@dataclass
class MCPCacheItem:
    """Cache item containing MCP server instance and metadata"""
    server: MCPAppServer
    last_used_at: datetime
    created_at: datetime
    ref_count: int = 0
    lock: asyncio.Lock = asyncio.Lock()


class MCPServerCache:
    """Cache for MCP server instances with automatic cleanup based on last used time"""

    def __init__(self, max_idle_minutes: int = 5):
        """
        Initialize the cache with configurable timeout

        Args:
            max_idle_minutes: Maximum idle time in minutes before cache item is removed
        """
        self.mcp_servers_cache: Dict[str, MCPCacheItem] = {}
        self.max_idle_time = timedelta(minutes=max_idle_minutes)
        self._cleanup_task = None
        self._cache_creation_lock = asyncio.Lock()  # Only for cache creation, not access
        self._start_background_cleanup()

    def _start_background_cleanup(self):
        """Start background task for periodic cleanup"""
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._periodic_cleanup())

    async def _periodic_cleanup(self):
        """Periodically cleanup stale cache items"""
        while True:
            try:
                await asyncio.sleep(60)  # Run cleanup every 1 minute
                await self._cleanup_expired_items()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error during periodic cache cleanup: {e}")

    async def _cleanup_expired_items(self):
        """Remove expired cache items and cleanup their resources"""
        current_time = datetime.now(UTC)
        expired_candidates = []

        # First pass: identify expired candidates without locking the entire cache
        for link, cache_item in list(self.mcp_servers_cache.items()):
            if current_time - cache_item.last_used_at > self.max_idle_time:
                expired_candidates.append((link, cache_item))

        # Second pass: try to cleanup expired items that are not in use
        for link, cache_item in expired_candidates:
            await self._try_remove_cache_item(link, cache_item)

    async def _try_remove_cache_item(self, link: str, cache_item: MCPCacheItem):
        """Try to remove a cache item - skip if in use"""
        async with cache_item.lock:
            # Skip if item is currently in use (ref_count > 0)
            if cache_item.ref_count > 0:
                logger.debug(
                    f"Skipping removal of in-use MCP server instance for link: {link} (ref_count: {cache_item.ref_count})")
                return False

            # Double-check the item still exists in cache (may have been removed by another cleanup)
            if link not in self.mcp_servers_cache:
                return False

            try:
                # Remove from cache first to prevent new references
                del self.mcp_servers_cache[link]

                # Cleanup the MCP server instance
                await cache_item.server.cleanup()
                logger.info(f"Cleaned up and removed expired MCP server instance from cache for link: {link}")
                return True
            except Exception as e:
                logger.error(f"Error cleaning up MCP server instance for link {link}: {e}")
                # Re-add to cache if cleanup failed
                if link not in self.mcp_servers_cache:
                    self.mcp_servers_cache[link] = cache_item
                return False

    async def get(self, link: str, db_session: Session) -> MCPAppServer:
        """Get or create MCP server instance for the given app"""
        current_time = datetime.now(UTC)

        # Fast path: try to get existing item without locking
        if link in self.mcp_servers_cache:
            cache_item = self.mcp_servers_cache[link]
            async with cache_item.lock:
                # Double-check item still exists after acquiring lock
                if link in self.mcp_servers_cache:
                    cache_item.last_used_at = current_time
                    cache_item.ref_count += 1
                    logger.debug(
                        f"Reusing cached MCP server instance for link: {link} (ref_count: {cache_item.ref_count})")
                    return cache_item.server

        # Slow path: create new instance with creation lock
        async with self._cache_creation_lock:
            # Double-check if another coroutine created it while we were waiting
            if link in self.mcp_servers_cache:
                cache_item = self.mcp_servers_cache[link]
                async with cache_item.lock:
                    cache_item.last_used_at = current_time
                    cache_item.ref_count += 1
                    logger.debug(
                        f"Reusing newly created cached MCP server instance for link: {link} (ref_count: {cache_item.ref_count})")
                    return cache_item.server

            # Create new instance
            logger.info(f"Creating new MCP server instance for link: {link}")
            mcp_server = crud.mcp_servers.get_mcp_server_by_link(db_session, link)
            if not mcp_server:
                raise HTTPException(
                    status_code=404,
                    detail=f"MCP server with link {link} not found"
                )

            mcp_app_server = MCPAppServer(mcp_server, db_session)
            cache_item = MCPCacheItem(
                server=mcp_app_server,
                last_used_at=current_time,
                created_at=current_time,
                ref_count=1  # Start with reference count 1
            )
            self.mcp_servers_cache[link] = cache_item
            logger.debug(f"Created new MCP server instance for link: {link} (ref_count: 1)")
            return mcp_app_server

    async def release(self, link: str):
        """Release a cache item after use"""
        if link in self.mcp_servers_cache:
            cache_item = self.mcp_servers_cache[link]
            async with cache_item.lock:
                cache_item.ref_count = max(0, cache_item.ref_count - 1)
                cache_item.last_used_at = datetime.now(UTC)  # Update last used time on release
                logger.debug(f"Released MCP server instance for link: {link} (ref_count: {cache_item.ref_count})")


mcp_server_cache = MCPServerCache()


async def handle_mcp_request(link: str, request: Request):
    db_session = utils.create_db_session(config.DB_FULL_URL)
    try:
        linked_account_id = request.headers.get(config.LINKED_ACCOUNT_ID_HEADER,
                                                request.query_params.get("linked_account_id"))
        mcp_request_ctx_var.set(MCPRequestContext(db_session=db_session, linked_account_id=linked_account_id))

        # Get MCP server for this app (marks as in use)
        mcp_server = await mcp_server_cache.get(link, db_session)

        # Determine response format based on Accept header
        accept_header = request.headers.get("accept", "")
        json_response = "application/json" in accept_header

        # Handle the request
        await mcp_server.handle_request(request.scope, request.receive, request._send, json_response)
    finally:
        # Always release the cache item after use, even if an exception occurs
        await mcp_server_cache.release(link)
        db_session.close()
