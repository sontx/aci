from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from aci.common.db import crud
from aci.common.db.crud.apps import to_app_details
from aci.common.enums import FunctionDefinitionFormat
from aci.common.exceptions import AppNotFound
from aci.common.logging_setup import get_logger
from aci.common.schemas.app import (
    AppDetails,
    AppsSearch, AppList,
)
from aci.common.schemas.common import Paged
from aci.common.schemas.function import BasicFunctionDefinition, FunctionDetails
from aci.server.dependencies import RequestContext, get_request_context, yield_db_async_session
from aci.server.utils import format_function_definition

logger = get_logger(__name__)
router = APIRouter()


@router.get("", response_model_exclude_none=True)
async def list_apps(
        context: Annotated[RequestContext, Depends(get_request_context)],
        db_session: Annotated[AsyncSession, Depends(yield_db_async_session)],
        query_params: Annotated[AppList, Query()],
) -> list[AppDetails]:
    """
    Get a list of Apps and their details. Sorted by App name.
    """
    apps = await crud.apps.get_apps(
        db_session,
        True,
        True,
        query_params.app_names,
        context.project.id,
        None,  # search
        None,  # categories
        None,  # limit
        None,  # offset
    )

    response: list[AppDetails] = []
    for app in apps:
        app_details = to_app_details(app)
        response.append(app_details)

    return response


@router.get("/search", response_model_exclude_none=True)
async def search_apps(
        context: Annotated[RequestContext, Depends(get_request_context)],
        db_session: Annotated[AsyncSession, Depends(yield_db_async_session)],
        query_params: Annotated[AppsSearch, Query()],
) -> Paged[AppDetails]:
    """
    Search apps with filtering by name, description, and categories.
    """
    # Get total count for pagination
    total = await crud.apps.count_apps(
        db_session,
        True,
        True,
        None,  # app_names
        context.project.id,
        query_params.search,
        query_params.categories,
    )

    # Get filtered apps
    apps = await crud.apps.get_apps(
        db_session,
        True,
        True,
        None,  # app_names
        context.project.id,
        query_params.search,
        query_params.categories,
        query_params.limit,
        query_params.offset,
    )

    app_details_list: list[AppDetails] = []
    for app in apps:
        app_details = to_app_details(app)
        app_details_list.append(app_details)

    return Paged[AppDetails](total=total, items=app_details_list)


@router.get("/categories", response_model_exclude_none=True)
async def get_all_categories(
        context: Annotated[RequestContext, Depends(get_request_context)],
        db_session: Annotated[AsyncSession, Depends(yield_db_async_session)],
) -> list[str]:
    """
    Get all unique categories from available apps.
    """
    categories = await crud.apps.get_all_categories(
        db_session,
        True,
        True,
        context.project.id,
    )
    return categories


@router.get("/{app_name}", response_model_exclude_none=True)
async def get_app_details(
        context: Annotated[RequestContext, Depends(get_request_context)],
        db_session: Annotated[AsyncSession, Depends(yield_db_async_session)],
        app_name: str,
) -> AppDetails:
    """
    Returns an application (name, description, and functions).
    """
    app = await crud.apps.get_app(
        db_session,
        app_name,
        True,
        True,
        context.project.id,
    )

    if not app:
        logger.error(f"App not found, app_name={app_name}, project_id={context.project.id}")
        raise AppNotFound(f"App={app_name} not found")

    return to_app_details(app)


@router.get("/{app_name}/functions", response_model_exclude_none=True)
async def get_app_functions(
        context: Annotated[RequestContext, Depends(get_request_context)],
        db_session: Annotated[AsyncSession, Depends(yield_db_async_session)],
        app_name: str,
) -> list[BasicFunctionDefinition] | list[FunctionDetails]:
    """
    Get all functions of an application.
    """
    app = await crud.apps.get_app(
        db_session,
        app_name,
        True,
        True,
        context.project.id,
    )

    if not app:
        logger.error(f"App not found, app_name={app_name}, project_id={context.project.id}")
        raise AppNotFound(f"App={app_name} not found")

    functions = await app.awaitable_attrs.functions
    app_functions = [
        format_function_definition(function, format=FunctionDefinitionFormat.BASIC)
        for function in functions
    ]

    return app_functions
