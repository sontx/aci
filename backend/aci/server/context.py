import contextvars

request_id_ctx_var = contextvars.ContextVar[str | None]("request_id", default="unknown")
api_key_id_ctx_var = contextvars.ContextVar[str | None]("api_key_id", default=None)
project_id_ctx_var = contextvars.ContextVar[str | None]("project_id", default=None)
org_id_ctx_var = contextvars.ContextVar[str | None]("org_id", default=None)
