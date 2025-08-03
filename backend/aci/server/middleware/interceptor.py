import logging
import uuid
from datetime import UTC, datetime

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from aci.common.logging_setup import get_logger
from aci.server import config
from aci.server.context import (
    api_key_id_ctx_var,
    org_id_ctx_var,
    project_id_ctx_var,
    request_id_ctx_var,
)

logger = get_logger(__name__)


class InterceptorMiddleware(BaseHTTPMiddleware):
    """
    Middleware for logging structured analytics data for every request/response.
    It generates a unique request ID and logs some baseline details.
    It also extracts and sets request context from the API key.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        start_time = datetime.now(UTC)
        request_id = str(uuid.uuid4())
        request_id_ctx_var.set(request_id)
        # TODO: Get request context from bearer token(propelauth)

        # Get request context from x-api-key header
        api_key = request.headers.get(config.ACI_API_KEY_HEADER)
        project_id = request.headers.get(config.ACI_PROJECT_ID_HEADER)
        org_id = request.headers.get(config.ACI_ORG_ID_HEADER)

        context_vars = {
            api_key_id_ctx_var: api_key,
            project_id_ctx_var: project_id,
            org_id_ctx_var: org_id,
        }
        for var, value in context_vars.items():
            var.set(str(value) if value else None)

        # Skip logging for health check endpoints
        is_health_check = request.url.path == config.ROUTER_PREFIX_HEALTH

        if not is_health_check or config.ENVIRONMENT != "local":
            request_log_data = {
                "http_version": request.scope.get("http_version", "unknown"),
                "http_method": request.method,
                "http_path": request.url.path,
                "url": str(request.url),
                "url_scheme": request.url.scheme,
                "query_params": dict(request.query_params),
                "client_ip": self._get_client_ip(
                    request
                ),  # TODO: get from request.client.host if request.client else "unknown"
                "user_agent": request.headers.get("User-Agent", "unknown"),
                "x_forwarded_proto": request.headers.get("X-Forwarded-Proto", "unknown"),
            }
            request_body = await self._get_request_body(request)
            if request_body:
                request_log_data["request_body"] = request_body
            logger.info("Received request", extra=request_log_data)

        try:
            response = await call_next(request)
        except Exception as e:
            logger.exception(
                f"Error processing request, error={e}",
                extra={"duration": (datetime.now(UTC) - start_time).total_seconds()},
            )
            return JSONResponse(
                status_code=500,
                content={"error": "Internal server error"},
            )

        if not is_health_check or config.ENVIRONMENT != "local":
            response_log_data = {
                "http_method": request.method,
                "http_path": request.url.path,
                "url": str(request.url),
                "status_code": response.status_code,
                "duration": (datetime.now(UTC) - start_time).total_seconds(),
                "content_length": response.headers.get("content-length"),  # type is str
            }
            logger.info("Response sent", extra=response_log_data)

        response.headers["X-Request-ID"] = request_id

        return response

    def _get_client_ip(self, request: Request) -> str:
        """
        Get the actual client IP if the server is running behind a proxy.
        """

        x_forwarded_for = request.headers.get("X-Forwarded-For")
        if x_forwarded_for is not None:
            # X-Forwarded-For is a list of IPs, the first one is the actual client IP
            return x_forwarded_for.split(",")[0].strip()

        else:
            return request.client.host if request.client else "unknown"

    # TODO: move to a separate file and refactor in more elegant/reliable way
    async def _get_request_body(self, request: Request) -> str | None:
        if request.method != "POST":
            return None
        try:
            request_body_bytes = await request.body()
            # TODO: reconsider size limit
            if len(request_body_bytes) > config.MAX_LOG_FIELD_SIZE:
                return (
                    request_body_bytes[: config.MAX_LOG_FIELD_SIZE - 100].decode(
                        "utf-8", errors="replace"
                    )
                    + f"... [truncated, size={len(request_body_bytes)}]"
                )
            return request_body_bytes.decode("utf-8", errors="replace")
        except Exception:
            logger.exception("Error decoding request body")
            return "error decoding request body"


class RequestContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # Only add attributes when values are not None
        request_id = request_id_ctx_var.get()
        record.__dict__["request_id"] = request_id

        project_id = project_id_ctx_var.get()
        record.__dict__["project_id"] = project_id

        org_id = org_id_ctx_var.get()
        record.__dict__["org_id"] = org_id

        return True
