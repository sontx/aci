from typing import Annotated

from fastapi import APIRouter, Depends, Query

from aci.common.db import crud
from aci.common.enums import Visibility, FunctionDefinitionFormat
from aci.common.exceptions import AppNotFound
from aci.common.logging_setup import get_logger
from aci.common.schemas.app import (
    AppDetails,
    AppsSearch, AppList,
)
from aci.common.schemas.common import Paged
from aci.common.schemas.function import BasicFunctionDefinition, FunctionDetails
from aci.common.schemas.security_scheme import SecuritySchemesPublic
from aci.server import dependencies as deps
from aci.server.caching import get_cache, PydanticCacheHelper
from aci.server.utils import format_function_definition

logger = get_logger(__name__)
router = APIRouter()


@router.get("", response_model_exclude_none=True)
async def list_apps(
        context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
        query_params: Annotated[AppList, Query()],
) -> list[AppDetails]:
    """
    Get a list of Apps and their details. Sorted by App name.
    """
    cache = PydanticCacheHelper(AppDetails, many=True)
    cache_key = "apps:list"
    cached = await cache.get(cache_key)
    if cached is not None:
        return filter_apps_by_names(cached, query_params.app_names)

    apps = crud.apps.get_apps(
        context.db_session,
        context.project.visibility_access == Visibility.PUBLIC,
        True,
        None,
        None,
        None,
    )

    response: list[AppDetails] = []
    for app in apps:
        app_details = to_app_details(app)
        response.append(app_details)

    await cache.set(cache_key, response)

    return filter_apps_by_names(response, query_params.app_names)


def filter_apps_by_names(
        all_apps: list[AppDetails],
        app_names: list[str] | None,
) -> list[AppDetails]:
    """
    Filter the list of AppDetails by a list of app names.
    """
    if not app_names:
        logger.info("No app names provided, returning all apps.")
        return all_apps

    logger.info(f"Filtering apps by names: {app_names}")
    filtered_apps = [app for app in all_apps if app.name in app_names]
    return filtered_apps


@router.get("/search", response_model_exclude_none=True)
async def search_apps(
        context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
        query_params: Annotated[AppsSearch, Query()],
) -> Paged[AppDetails]:
    all_apps = await list_apps(context, query_params=AppList(app_names=None))
    search = query_params.search
    categories = query_params.categories
    limit = query_params.limit
    offset = query_params.offset

    filtered_apps: list[AppDetails] = []
    for app in all_apps:
        if search and search.lower() not in app.name.lower() and search.lower() not in app.description.lower():
            continue
        if categories and not any(category in app.categories for category in categories):
            continue
        filtered_apps.append(app)

    total = len(filtered_apps)
    filtered_apps = filtered_apps[offset:offset + limit]
    return Paged[AppDetails](total=total, items=filtered_apps)


@router.get("/categories", response_model_exclude_none=True)
async def get_all_categories(
        context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
) -> list[str]:
    cache = get_cache()
    cache_key = "apps:categories"
    cached_categories = await cache.get(cache_key)
    if cached_categories is not None:
        return cached_categories

    all_apps = await list_apps(context, query_params=AppList(app_names=None))
    # Get unique categories from all apps
    categories = set()
    for app in all_apps:
        categories.update(app.categories)
    # Convert set to sorted list
    sorted_categories = sorted(categories)

    await cache.set(cache_key, sorted_categories)

    return sorted_categories


@router.get("/{app_name}", response_model_exclude_none=True)
async def get_app_details(
        context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
        app_name: str,
) -> AppDetails:
    """
    Returns an application (name, description, and functions).
    """

    cache = PydanticCacheHelper(AppDetails, many=False)
    cache_key = f"apps:details:{app_name}"
    cached_app = await cache.get(cache_key)
    if cached_app is not None:
        return cached_app

    app = crud.apps.get_app(
        context.db_session,
        app_name,
        context.project.visibility_access == Visibility.PUBLIC,
        True,
    )

    if not app:
        logger.error(f"App not found, app_name={app_name}")

        raise AppNotFound(f"App={app_name} not found")

    app_details = to_app_details(app)
    await cache.set(cache_key, app_details)
    return app_details


def to_app_details(app) -> AppDetails:
    """
    Convert an app object to AppDetails schema.
    """
    return AppDetails(
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
        security_schemes=list(app.security_schemes.keys()),
        supported_security_schemes=SecuritySchemesPublic.model_validate(app.security_schemes),
        created_at=app.created_at,
        updated_at=app.updated_at,
    )


@router.get("/{app_name}/functions", response_model_exclude_none=True)
async def get_app_functions(
        context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
        app_name: str,
        raw: bool = Query(False, description="Return raw functions without formatting"),
) -> list[BasicFunctionDefinition] | list[FunctionDetails]:
    """
    Get all functions of an application.
    """

    cache = PydanticCacheHelper(BasicFunctionDefinition if not raw else FunctionDetails, many=True)
    cache_key = f"apps:functions:{app_name}:{'raw' if raw else 'basic'}"
    cached_functions = await cache.get(cache_key)
    if cached_functions is not None:
        return cached_functions

    app = crud.apps.get_app(
        context.db_session,
        app_name,
        context.project.visibility_access == Visibility.PUBLIC,
        True,
    )

    if not app:
        logger.error(f"App not found, app_name={app_name}")
        raise AppNotFound(f"App={app_name} not found")

    app_functions = [
        format_function_definition(function,
                                   format=FunctionDefinitionFormat.BASIC if not raw else FunctionDefinitionFormat.RAW)
        for function in app.functions
    ]

    await cache.set(cache_key, app_functions)

    return app_functions
