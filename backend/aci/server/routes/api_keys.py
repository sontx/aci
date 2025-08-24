from typing import Annotated

from fastapi import APIRouter, Depends, status, Query, HTTPException

from aci.common.db import crud
from aci.common.db.sql_models import APIKey
from aci.common.logging_setup import get_logger
from aci.common.schemas.api_key import APIKeyCreate, APIKeyPublic, APIKeyUpdate
from aci.common.schemas.common import Paged
from aci.server import acl
from aci.server.dependencies import RequestContext, get_request_context

# Create router instance
router = APIRouter()
logger = get_logger(__name__)

auth = acl.get_propelauth()


@router.post("", response_model=APIKeyPublic, include_in_schema=True)
async def create_api_key(
        body: APIKeyCreate,
        context: Annotated[RequestContext, Depends(get_request_context)],
) -> APIKeyPublic:
    """
    Create a new API key for the project.
    """
    logger.info(f"Create API key, name={body.name}, user_id={context.user.user_id}, project_id={context.project.id}")

    # Check if API key name already exists in the project
    existing_api_key = await crud.api_keys.get_api_key_by_name(context.db_session, context.project.id, body.name)
    if existing_api_key:
        logger.error(f"API key name already exists, name={body.name}, project_id={context.project.id}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"API key with name '{body.name}' already exists in this project"
        )

    api_key, api_key_str = await crud.api_keys.create_api_key(context.db_session, context.project.id, body.name)

    logger.info(
        f"Created API key, api_key_id={api_key.id}, name={body.name}, user_id={context.user.user_id}, project_id={context.project.id}"
    )

    api_key_public = APIKeyPublic(
        id=api_key.id,
        name=api_key.name,
        key=api_key_str,
        project_id=api_key.project_id,
        status=api_key.status,
        created_at=api_key.created_at,
        updated_at=api_key.updated_at,
    )
    await context.db_session.commit()
    return api_key_public


@router.get("", response_model=Paged[APIKeyPublic], include_in_schema=True)
async def get_api_keys(
        context: Annotated[RequestContext, Depends(get_request_context)],
        limit: int = Query(default=100, ge=1, le=1000, description="Number of API keys to return"),
        offset: int = Query(default=0, ge=0, description="Number of API keys to skip"),
) -> Paged[APIKeyPublic]:
    """
    Get API keys for the project with pagination support.
    """
    logger.info(f"Get API keys, user_id={context.user.user_id}, project_id={context.project.id}")

    # Get the API keys
    api_keys = await crud.api_keys.get_api_keys_by_project(
        context.db_session,
        context.project.id,
        limit=limit,
        offset=offset
    )

    # Get total count for pagination
    total_count = await crud.api_keys.count_api_keys_by_project(context.db_session, context.project.id)

    # Convert to response models
    api_key_responses = [
        APIKeyPublic.model_validate(api_key)
        for api_key in api_keys
    ]

    return Paged(total=total_count, items=api_key_responses)


@router.get("/{api_key_name}", response_model=APIKeyPublic, include_in_schema=True)
async def get_api_key_by_name(
        api_key_name: str,
        context: Annotated[RequestContext, Depends(get_request_context)],
) -> APIKey:
    """
    Get an API key by its name.
    """
    logger.info(f"Get API key, api_key_name={api_key_name}, user_id={context.user.user_id}")

    api_key = await crud.api_keys.get_api_key_by_name(context.db_session, context.project.id, api_key_name)
    if not api_key:
        logger.error(f"API key not found, api_key_name={api_key_name}, project_id={context.project.id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"API key with name '{api_key_name}' not found"
        )

    return api_key


@router.patch("/{api_key_name}", response_model=APIKeyPublic, include_in_schema=True)
async def update_api_key(
        api_key_name: str,
        body: APIKeyUpdate,
        context: Annotated[RequestContext, Depends(get_request_context)],
) -> APIKeyPublic:
    """
    Update an API key by its name.
    Supports updating the API key name and status.
    """
    logger.info(f"Update API key, api_key_name={api_key_name}, user_id={context.user.user_id}")

    api_key = await crud.api_keys.get_api_key_by_name(context.db_session, context.project.id, api_key_name)
    if not api_key:
        logger.error(f"API key not found, api_key_name={api_key_name}, project_id={context.project.id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"API key with name '{api_key_name}' not found"
        )

    updated_api_key = await crud.api_keys.update_api_key(context.db_session, api_key, body)

    api_key_public = APIKeyPublic.model_validate(updated_api_key)
    await context.db_session.commit()
    return api_key_public


@router.delete("/{api_key_name}", status_code=status.HTTP_204_NO_CONTENT, include_in_schema=True)
async def delete_api_key(
        api_key_name: str,
        context: Annotated[RequestContext, Depends(get_request_context)],
) -> None:
    """
    Delete an API key by its name.
    This performs a soft delete by setting the status to DELETED.
    """
    logger.info(f"Delete API key, api_key_name={api_key_name}, user_id={context.user.user_id}")

    api_key = await crud.api_keys.get_api_key_by_name(context.db_session, context.project.id, api_key_name)
    if not api_key:
        logger.error(f"API key not found, api_key_name={api_key_name}, project_id={context.project.id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"API key with name '{api_key_name}' not found"
        )

    await crud.api_keys.delete_api_key_by_name(context.db_session, context.project.id, api_key_name)
    await context.db_session.commit()

    logger.info(f"Deleted API key, api_key_name={api_key_name}, user_id={context.user.user_id}")
