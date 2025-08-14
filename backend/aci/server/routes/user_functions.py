from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status, Query

from aci.common.db import crud
from aci.common.enums import FunctionDefinitionFormat
from aci.common.exceptions import ConflictError, FunctionNotFound
from aci.common.logging_setup import get_logger
from aci.common.schemas.function import BasicFunctionDefinition, FunctionDetails, FunctionUpsert, FunctionUpdate
from aci.server.dependencies import get_request_context, RequestContext
from aci.server.utils import format_function_definition

logger = get_logger(__name__)
router = APIRouter()


@router.get("/tags", response_model=list[str])
async def get_user_function_tags(
        context: Annotated[RequestContext, Depends(get_request_context)],
) -> list[str]:
    """
    Get all tags used in user functions for the current project functions and global functions.
    """
    tags = crud.functions.get_user_function_tags(context.db_session, context.project.id)
    return tags


@router.get("/{function_name}", response_model_exclude_none=True)
async def get_user_function(
        context: Annotated[RequestContext, Depends(get_request_context)],
        function_name: str,
        format: FunctionDefinitionFormat = Query(
            default=FunctionDefinitionFormat.OPENAI,
            description="The format to use for the function definition (e.g., 'openai' or 'anthropic'). "
                        "There is also a 'basic' format that only returns name and description.",
        ),
) -> BasicFunctionDefinition | FunctionDetails:
    """
    Get a specific user function definition by function name.
    """
    function = crud.functions.get_user_function_by_name(
        context.db_session,
        function_name,
        context.project.id,
    )

    if not function:
        logger.error(f"User function not found, function_name={function_name}, project_id={context.project.id}")
        raise FunctionNotFound(f"Function with name {function_name} not found")

    return format_function_definition(
        function,
        format=format
    )


@router.delete("/{function_name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_function(
        context: Annotated[RequestContext, Depends(get_request_context)],
        function_name: str,
) -> None:
    """
    Delete a user function by function name.
    """
    try:
        crud.functions.delete_user_function(
            context.db_session,
            function_name,
            context.project.id,
        )
        context.db_session.commit()
        logger.info(f"Deleted user function: {function_name} for org_id: {context.project.id}")
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.put("/{function_name}", status_code=status.HTTP_204_NO_CONTENT)
async def update_user_function(
        context: Annotated[RequestContext, Depends(get_request_context)],
        function_name: str,
        function_update: FunctionUpdate,
) -> None:
    """
    Update a user function by function name.
    """
    try:
        crud.functions.update_user_function(
            context.db_session,
            function_name,
            function_update,
            context.project.id,
        )
        context.db_session.commit()
        logger.info(f"Updated user function: {function_name} for project id: {context.project.id}")
    except FunctionNotFound as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
