from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status, Query

from aci.common.db import crud
from aci.common.enums import FunctionDefinitionFormat
from aci.common.exceptions import ConflictError, FunctionNotFound
from aci.common.logging_setup import get_logger
from aci.common.schemas.function import BasicFunctionDefinition, FunctionDetails
from aci.server.dependencies import OrgContext, get_org_context
from aci.server.utils import format_function_definition

logger = get_logger(__name__)
router = APIRouter()


@router.get("/{function_name}", response_model_exclude_none=True)
async def get_user_function(
        context: Annotated[OrgContext, Depends(get_org_context)],
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
        context.org_id,
    )

    if not function:
        logger.error(f"User function not found, function_name={function_name}, org_id={context.org_id}")
        raise FunctionNotFound(f"Function with name {function_name} not found")

    return format_function_definition(
        function,
        format=format
    )


@router.delete("/{function_name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_function(
        context: Annotated[OrgContext, Depends(get_org_context)],
        function_name: str,
) -> None:
    """
    Delete a user function by function name.
    """
    try:
        crud.functions.delete_user_function(
            context.db_session,
            function_name,
            context.org_id,
        )
        context.db_session.commit()
        logger.info(f"Deleted user function: {function_name} for org_id: {context.org_id}")
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
