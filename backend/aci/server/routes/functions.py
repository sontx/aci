import json
import time
import uuid
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from aci.common.db import crud
from aci.common.db.sql_models import Function, Project
from aci.common.enums import FunctionDefinitionFormat, Visibility, ExecutionStatus
from aci.common.exceptions import (
    AppConfigurationDisabled,
    AppConfigurationNotFound,
    FunctionNotFound,
    LinkedAccountDisabled,
    LinkedAccountNotFound,
)
from aci.common.logging_setup import get_logger
from aci.common.schemas.function import (
    AnthropicFunctionDefinition,
    BasicFunctionDefinition,
    FunctionDetails,
    FunctionExecute,
    FunctionExecutionResult,
    FunctionsList,
    FunctionsSearch,
    OpenAIFunctionDefinition,
    OpenAIResponsesFunctionDefinition,
)
from aci.server import config, utils
from aci.server import dependencies as deps
from aci.server import security_credentials_manager as scm
from aci.server.context import request_id_ctx_var
from aci.server.execution_logs.execution_log_appender import log_appender
from aci.server.function_executors import get_executor
from aci.server.security_credentials_manager import SecurityCredentialsResponse
from aci.server.utils import format_function_definition

router = APIRouter()
logger = get_logger(__name__)


@router.get("", response_model=list[FunctionDetails])
async def list_functions(
        context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
        query_params: Annotated[FunctionsList, Query()],
) -> list[Function]:
    """Get a list of functions and their details. Sorted by function name."""
    return await crud.functions.get_functions(
        context.db_session,
        context.project.visibility_access == Visibility.PUBLIC,
        True,
        query_params.app_names,
        query_params.limit,
        query_params.offset,
    )


@router.get("/search", response_model_exclude_none=True)
async def search_functions(
        context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
        query_params: Annotated[FunctionsSearch, Query()],
) -> list[
    BasicFunctionDefinition
    | OpenAIFunctionDefinition
    | OpenAIResponsesFunctionDefinition
    | AnthropicFunctionDefinition
    ]:
    """
    Returns the basic information of a list of functions.
    """
    # TODO: currently the search is done across all apps, we might want to add flags to account for below scenarios:
    # - when clients search for functions, if the app of the functions is configured but disabled by client, should the functions be discoverable?

    if query_params.app_names is None:
        apps_to_filter = None
    else:
        apps_to_filter = query_params.app_names

    functions = await crud.functions.search_functions(
        context.db_session,
        context.project.visibility_access == Visibility.PUBLIC,
        True,
        apps_to_filter,
        query_params.limit,
        query_params.offset,
    )

    logger.info(
        "Search functions result",
        extra={
            "search_functions": {
                "query_params_json": query_params.model_dump_json(),
                "function_names": [function.name for function in functions],
            }
        },
    )
    function_definitions = [
        format_function_definition(function, query_params.format) for function in functions
    ]

    return function_definitions


# TODO: have "structured_outputs" flag ("structured_outputs_if_possible") to support openai's structured outputs function calling?
# which need "strict: true" and only support a subset of json schema and a bunch of other restrictions like "All fields must be required"
# If you turn on Structured Outputs by supplying strict: true and call the API with an unsupported JSON Schema, you will receive an error.
# TODO: client sdk can use pydantic to validate model output for parameters used for function execution
# TODO: "flatten" flag to make sure nested parameters are flattened?
@router.get(
    "/{function_name}/definition",
    response_model_exclude_none=True,
    # having this to exclude "strict" field in openai's function definition if not set
)
async def get_function_definition(
        context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
        function_name: str,
        format: FunctionDefinitionFormat = Query(  # noqa: B008 # TODO: need to fix this later
            default=FunctionDefinitionFormat.OPENAI,
            description="The format to use for the function definition (e.g., 'openai' or 'anthropic'). "
                        "There is also a 'basic' format that only returns name and description.",
        ),
) -> (
        BasicFunctionDefinition
        | OpenAIFunctionDefinition
        | OpenAIResponsesFunctionDefinition
        | AnthropicFunctionDefinition
        | FunctionDetails
):
    """
    Return the function definition that can be used directly by LLM.
    The actual content depends on the FunctionDefinitionFormat and the function itself.
    """
    function: Function | None = await crud.functions.get_function(
        context.db_session,
        function_name,
        context.project.visibility_access == Visibility.PUBLIC,
        True,
    )
    if not function:
        # Try to get the function by name from user apps
        function = await crud.functions.get_user_function_by_name(
            context.db_session,
            function_name,
            project_id=context.project.id,
        )

        if not function:
            logger.error(
                f"Failed to get function definition, function not found, function_name={function_name}"
            )
            raise FunctionNotFound(f"function={function_name} not found")

    function_definition = format_function_definition(function, format)

    logger.info(
        "function definition to return",
        extra={
            "get_function_definition": {
                "format": format,
                "function_name": function_name,
            },
        },
    )
    return function_definition


# TODO: is there any way to abstract and generalize the checks and validations
# (enabled, configured, accessible, etc.)?
@router.post(
    "/{function_name}/execute",
    response_model=FunctionExecutionResult,
    response_model_exclude_none=True,
)
async def execute(
        context: Annotated[deps.RequestContext2, Depends(deps.validate_monthly_quota)],
        function_name: str,
        body: FunctionExecute,
) -> FunctionExecutionResult:
    start_time = datetime.now(UTC)

    start = time.perf_counter()
    created_at = datetime.now(UTC)

    result, app_name, linked_account_owner_id, app_configuration_id = await execute_function(
        db_session=context.db_session,
        project=context.project,
        function_name=function_name,
        function_input=body.function_input,
        linked_account_owner_id=body.linked_account_owner_id,
        project_id=context.project.id,
    )

    end = time.perf_counter()
    execution_time = int((end - start) * 1000)
    execution_id = request_id_ctx_var.get(None)
    execution_id = UUID(execution_id) if execution_id else uuid.uuid4()

    await log_appender.enqueue(
        function_name=function_name,
        app_name=app_name,
        project_id=context.project.id,
        status=ExecutionStatus.SUCCESS if result.success else ExecutionStatus.FAILED,
        execution_time=execution_time,
        linked_account_owner_id=linked_account_owner_id,
        app_configuration_id=str(app_configuration_id),
        api_key_name=context.api_key_name,
        request=body.function_input,
        response=result.data if result.success else result.error,
        created_at=created_at,
        execution_id=execution_id,
    )

    end_time = datetime.now(UTC)

    # TODO: reconsider the implementation handling large log fields
    try:
        execute_result_data = utils.truncate_if_too_large(
            json.dumps(result.data, default=str), config.MAX_LOG_FIELD_SIZE
        )
    except Exception:
        logger.exception("Failed to dump execute_result_data")
        execute_result_data = "failed to dump execute_result_data"

    try:
        function_input_data = utils.truncate_if_too_large(
            json.dumps(body.function_input, default=str), config.MAX_LOG_FIELD_SIZE
        )
    except Exception:
        logger.exception("Failed to dump function_input_data")
        function_input_data = "failed to dump function_input_data"

    logger.info(
        "function execution result",
        extra={
            "function_execution": {
                "app_name": function_name.split("__")[0] if "__" in function_name else "unknown",
                "function_name": function_name,
                "linked_account_owner_id": body.linked_account_owner_id,
                "function_execution_start_time": start_time,
                "function_execution_end_time": end_time,
                "function_execution_duration": (end_time - start_time).total_seconds(),
                "function_input": function_input_data,
                "function_execution_result_success": result.success,
                "function_execution_result_error": result.error,
                "function_execution_result_data": execute_result_data,
                "function_execution_result_data_size": len(execute_result_data),
            }
        },
    )
    return result


async def execute_function(
        db_session: AsyncSession,
        project: Project,
        function_name: str,
        function_input: dict,
        linked_account_owner_id: str,
        project_id: UUID | None = None,
) -> tuple[FunctionExecutionResult, str, str, UUID]:
    """
    Execute a function with the given parameters.

    Args:
        db_session: Database session
        project: Project object
        function_name: Name of the function to execute
        function_input: Input parameters for the function
        linked_account_owner_id: ID of the linked account owner

    Returns:
        FunctionExecutionResult: Result of the function execution

    Raises:
        FunctionNotFound: If the function is not found
        AppConfigurationNotFound: If the app configuration is not found
        AppConfigurationDisabled: If the app configuration is disabled
        LinkedAccountNotFound: If the linked account is not found
        LinkedAccountDisabled: If the linked account is disabled
    """
    # Get the function
    function = await crud.functions.get_function(
        db_session,
        function_name,
        project.visibility_access == Visibility.PUBLIC,
        True,
    )
    if not function:
        # Try to get the function by name from user apps
        function = await crud.functions.get_user_function_by_name(
            db_session,
            function_name,
            project_id=project_id,
        )

        if not function:
            logger.error(
                f"Failed to execute function, function not found, function_name={function_name}"
            )
            raise FunctionNotFound(f"function={function_name} not found")

    # Check if the App (that this function belongs to) is configured
    app_configuration = await crud.app_configurations.get_app_configuration(
        db_session, project.id, function.app.name
    )
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
    linked_account = await crud.linked_accounts.get_linked_account(
        db_session,
        project.id,
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

    await scm.update_security_credentials(
        db_session, function.app, linked_account, security_credentials_response
    )

    logger.info(
        f"Fetched security credentials for function execution, function_name={function_name}, "
        f"app_name={function.app.name}, linked_account_owner_id={linked_account_owner_id}, "
        f"linked_account_id={linked_account.id}, is_updated={security_credentials_response.is_updated}, "
        f"is_app_default_credentials={security_credentials_response.is_app_default_credentials}"
    )
    await db_session.commit()

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
    await crud.linked_accounts.update_linked_account_last_used_at(
        db_session,
        last_used_at,
        linked_account,
    )
    await db_session.commit()

    if not execution_result.success:
        logger.error(
            f"Function execution result error, function_name={function_name}, "
            f"error={execution_result.error}"
        )

    return execution_result, function.app.name, linked_account_owner_id, app_configuration.id
