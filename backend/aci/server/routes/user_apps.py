from typing import Annotated

from fastapi import APIRouter, Depends, Query, HTTPException, status

from aci.common.db import crud
from aci.common.db.crud.apps import to_app_details
from aci.common.enums import FunctionDefinitionFormat
from aci.common.exceptions import AppNotFound, ConflictError
from aci.common.logging_setup import get_logger
from aci.common.schemas.app import (
    AppDetails,
    AppUpsert, UserAppDetails,
)
from aci.common.schemas.common import Paged
from aci.common.schemas.function import BasicFunctionDefinition, FunctionDetails, FunctionUpsert
from aci.common.schemas.security_scheme import SecuritySchemesPublic
from aci.server import acl
from aci.server.dependencies import OrgContext, get_org_context
from aci.server.utils import format_function_definition

logger = get_logger(__name__)
router = APIRouter()
auth = acl.get_propelauth()


@router.post("", response_model_exclude_none=True, status_code=status.HTTP_201_CREATED)
async def create_user_app(
        app_upsert: AppUpsert,
        context: Annotated[OrgContext, Depends(get_org_context)],
) -> AppDetails:
    """
    Create a new user app for the organization.
    The app name will be automatically prefixed and converted to uppercase.
    """
    try:
        app = crud.apps.create_user_app(
            context.db_session,
            app_upsert,
            context.org_id,
        )
        context.db_session.commit()
        return to_app_details(app)
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.get("", response_model_exclude_none=True)
async def list_user_apps(
        context: Annotated[OrgContext, Depends(get_org_context)],
        search: str | None = Query(None, description="Search in app name, display name, or description"),
        categories: list[str] | None = Query(None, description="Filter by categories"),
        limit: int | None = Query(None, ge=1, le=100, description="Limit number of results"),
        offset: int | None = Query(None, ge=0, description="Offset for pagination"),
) -> list[AppDetails]:
    """
    Get a list of user's organization apps.
    """
    apps = crud.apps.get_user_apps(
        context.db_session,
        context.org_id,
        True,  # active_only
        search,
        categories,
        limit,
        offset,
    )

    response: list[AppDetails] = []
    for app in apps:
        app_details = to_app_details(app)
        response.append(app_details)

    return response


@router.get("/search", response_model_exclude_none=True)
async def search_user_apps(
        context: Annotated[OrgContext, Depends(get_org_context)],
        search: str | None = Query(None, description="Search in app name, display name, or description"),
        categories: list[str] | None = Query(None, description="Filter by categories"),
        limit: int | None = Query(20, ge=1, le=100, description="Limit number of results"),
        offset: int | None = Query(0, ge=0, description="Offset for pagination"),
) -> Paged[AppDetails]:
    """
    Search user's organization apps with pagination.
    """
    # Get total count for pagination
    total = crud.apps.count_user_apps(
        context.db_session,
        context.org_id,
        False,  # User can search inactive apps
        search,
        categories,
    )

    # Get filtered apps
    apps = crud.apps.get_user_apps(
        context.db_session,
        context.org_id,
        False,
        search,
        categories,
        limit,
        offset,
    )

    app_details_list: list[AppDetails] = []
    for app in apps:
        app_details = to_app_details(app)
        app_details_list.append(app_details)

    return Paged[AppDetails](total=total, items=app_details_list)


@router.get("/{app_name}", response_model_exclude_none=True)
async def get_user_app_details(
        context: Annotated[OrgContext, Depends(get_org_context)],
        app_name: str,
) -> UserAppDetails:
    """
    Get details of a specific user app by name.
    """
    app = crud.apps.get_user_app_by_name(
        context.db_session,
        app_name,
        context.org_id,
    )

    if not app:
        logger.error(f"User app not found, app_name={app_name}, org_id={context.org_id}")
        raise AppNotFound(f"App with name {app_name} not found")

    return UserAppDetails(
        id=app.id,
        name=app.name,
        display_name=app.display_name,
        provider=app.provider,
        version=app.version,
        description=app.description,
        logo=app.logo,
        categories=app.categories,
        visibility=app.visibility,
        active=app.active,
        security_schemes=app.security_schemes,
        supported_security_schemes=SecuritySchemesPublic.model_validate(app.security_schemes),
        created_at=app.created_at,
        updated_at=app.updated_at,
        org_id=app.org_id,
    )


@router.put("/{app_name}", response_model_exclude_none=True)
async def update_user_app(
        context: Annotated[OrgContext, Depends(get_org_context)],
        app_name: str,
        app_upsert: AppUpsert,
) -> AppDetails:
    """
    Update a user app by name
    Note: App name cannot be changed once created.
    """
    try:
        app = crud.apps.update_user_app(
            context.db_session,
            app_name,
            app_upsert,
            context.org_id,
        )
        context.db_session.commit()
        return to_app_details(app)
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.delete("/{app_name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_app(
        context: Annotated[OrgContext, Depends(get_org_context)],
        app_name: str,
) -> None:
    """
    Delete a user app by name.
    """
    try:
        crud.apps.delete_user_app(
            context.db_session,
            app_name,
            context.org_id,
        )
        context.db_session.commit()
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.get("/{app_name}/functions", response_model_exclude_none=True)
async def get_user_app_functions(
        context: Annotated[OrgContext, Depends(get_org_context)],
        app_name: str,
        raw: bool = Query(False, description="Return raw functions without formatting"),
) -> list[BasicFunctionDefinition] | list[FunctionDetails]:
    """
    Get all functions of a user app by name.
    """
    # Use the new CRUD method that properly filters by org_id
    app_functions_raw = crud.functions.get_user_functions_by_app_name(
        context.db_session,
        app_name,
        context.org_id,
    )

    app_functions = [
        format_function_definition(function,
                                   format=FunctionDefinitionFormat.BASIC if not raw else FunctionDefinitionFormat.RAW)
        for function in app_functions_raw
    ]

    return app_functions


@router.post("/{app_name}/functions", response_model_exclude_none=True, status_code=status.HTTP_201_CREATED)
async def create_user_app_functions(
        context: Annotated[OrgContext, Depends(get_org_context)],
        app_name: str,
        functions_upsert: list[FunctionUpsert],
        override_existing: bool = Query(False, description="Override existing functions with the same name"),
        remove_previous: bool = Query(False, description="Remove previous functions not in the upsert list"),
) -> list[BasicFunctionDefinition]:
    """
    Create multiple functions for a user app by name.
    """
    # Validate function names are not duplicated in the upsert list, and throw an error which contains the names of the duplicates
    function_names = [function.name for function in functions_upsert]
    duplicates = set(name for name in function_names if function_names.count(name) > 1)
    if duplicates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Function names must be unique. Duplicates found: {', '.join(duplicates)}"
        )

    try:
        functions = crud.functions.create_user_functions(
            context.db_session,
            app_name,
            functions_upsert,
            override_existing,
            remove_previous,
            context.org_id,
        )
        context.db_session.commit()
        return [format_function_definition(function, format=FunctionDefinitionFormat.BASIC) for function in functions]
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
