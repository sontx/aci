"""
CRUD operations for apps. (not including app_configurations)
"""

from uuid import UUID

from sqlalchemy import select, update, or_, func, exists
from sqlalchemy.ext.asyncio import AsyncSession

from aci.common.config import APP_ORG_PREFIX
from aci.common.db.sql_models import App
from aci.common.enums import SecurityScheme, Visibility
from aci.common.exceptions import ConflictError
from aci.common.logging_setup import get_logger
from aci.common.schemas.app import AppUpsert, AppDetails
from aci.common.schemas.security_scheme import SecuritySchemesPublic
from aci.common.utils import format_to_screaming_snake_case

logger = get_logger(__name__)


async def create_app(
        db_session: AsyncSession,
        app_upsert: AppUpsert,
) -> App:
    logger.debug(f"Creating app: {app_upsert}")

    app_data = app_upsert.model_dump(mode="json", exclude_none=True)
    app = App(
        **app_data,
    )

    db_session.add(app)
    await db_session.flush()
    await db_session.refresh(app)
    return app


async def update_app(
        db_session: AsyncSession,
        app: App,
        app_upsert: AppUpsert,
) -> App:
    """
    Update an existing app.
    """
    new_app_data = app_upsert.model_dump(mode="json", exclude_unset=True)

    for field, value in new_app_data.items():
        setattr(app, field, value)

    await db_session.flush()
    await db_session.refresh(app)
    return app


async def update_app_default_security_credentials(
        db_session: AsyncSession,
        app: App,
        security_scheme: SecurityScheme,
        security_credentials: dict,
) -> None:
    # Note: this update works because of the MutableDict.as_mutable(JSON) in the sql_models.py
    # TODO: check if this is the best practice and double confirm that nested dict update does NOT work
    app.default_security_credentials_by_scheme[security_scheme] = security_credentials


async def get_app_by_name(
        db_session: AsyncSession,
        app_name: str,
        project_id: UUID | None = None,
) -> App | None:
    statement = select(App).filter_by(name=app_name)
    # Filter to show global apps (project_id is None) and user's org apps
    if project_id is not None:
        statement = statement.filter(or_(App.project_id.is_(None), App.project_id == project_id))
    result = await db_session.execute(statement)
    app: App | None = result.scalar_one_or_none()
    return app


async def get_app(
        db_session: AsyncSession,
        app_name: str,
        public_only: bool,
        active_only: bool,
        project_id: UUID | None = None
) -> App | None:
    statement = select(App).filter_by(name=app_name)

    if active_only:
        statement = statement.filter(App.active)
    if public_only:
        statement = statement.filter(App.visibility == Visibility.PUBLIC)

    # Filter to show global apps (project_id is None) and user's org apps
    if project_id is not None:
        statement = statement.filter(or_(App.project_id.is_(None), App.project_id == project_id))

    result = await db_session.execute(statement)
    app: App | None = result.scalar_one_or_none()
    return app


def _build_filtered_app_query(
        public_only: bool,
        active_only: bool,
        app_names: list[str] | None,
        project_id: UUID | None,
        search: str | None = None,
        categories: list[str] | None = None,
):
    """Build a base query with all common filters applied."""
    statement = select(App)

    if public_only:
        statement = statement.filter(App.visibility == Visibility.PUBLIC)
    if active_only:
        statement = statement.filter(App.active)
    if app_names is not None:
        statement = statement.filter(App.name.in_(app_names))

    # Filter to show global apps (project_id is None) and user's org apps
    if project_id is not None:
        statement = statement.filter(or_(App.project_id.is_(None), App.project_id == project_id))

    # Add search functionality at database level
    if search:
        search_term = f"%{search.lower()}%"
        statement = statement.filter(
            or_(
                App.name.ilike(search_term),
                App.description.ilike(search_term),
                App.display_name.ilike(search_term)
            )
        )

    # Add category filtering at database level
    if categories:
        statement = statement.filter(App.categories.overlap(categories))

    return statement


async def get_apps(
        db_session: AsyncSession,
        public_only: bool,
        active_only: bool,
        app_names: list[str] | None,
        project_id: UUID | None = None,
        search: str | None = None,
        categories: list[str] | None = None,
        limit: int | None = None,
        offset: int | None = None,
) -> list[App]:
    statement = _build_filtered_app_query(
        public_only, active_only, app_names, project_id, search, categories
    )

    # Order by name for consistent results
    statement = statement.order_by(App.name)

    if offset is not None:
        statement = statement.offset(offset)
    if limit is not None:
        statement = statement.limit(limit)

    result = await db_session.execute(statement)
    return list(result.scalars().all())


async def get_apps_by_names(
        db_session: AsyncSession,
        app_names: list[str],
) -> list[App]:
    """
    Get a list of apps by their names.
    This is used for fetching multiple apps in one go.
    """
    if not app_names:
        return []

    statement = select(App).filter(App.name.in_(app_names))
    result = await db_session.execute(statement)
    return list(result.scalars().all())


async def count_apps(
        db_session: AsyncSession,
        public_only: bool,
        active_only: bool,
        app_names: list[str] | None,
        project_id: UUID | None = None,
        search: str | None = None,
        categories: list[str] | None = None,
) -> int:
    """Count apps matching the given criteria."""
    statement = _build_filtered_app_query(
        public_only, active_only, app_names, project_id, search, categories
    )

    # Replace the select with count
    statement = statement.with_only_columns(func.count(App.id))

    result = await db_session.execute(statement)
    return result.scalar() or 0


async def get_all_categories(
        db_session: AsyncSession,
        public_only: bool,
        active_only: bool,
        project_id: UUID | None = None,
) -> list[str]:
    """Get all unique categories from apps."""
    statement = _build_filtered_app_query(
        public_only, active_only, None, project_id, None, None
    )

    # Replace the select with unnest categories
    statement = statement.with_only_columns(
        func.unnest(App.categories).label('category')
    ).distinct().order_by('category')

    result = await db_session.execute(statement)
    categories = result.scalars().all()
    return [cat for cat in categories if cat]  # Filter out None values


async def set_app_active_status(db_session: AsyncSession, app_name: str, active: bool) -> None:
    statement = update(App).filter_by(name=app_name).values(active=active)
    await db_session.execute(statement)


async def set_app_visibility(db_session: AsyncSession, app_name: str, visibility: Visibility) -> None:
    statement = update(App).filter_by(name=app_name).values(visibility=visibility)
    await db_session.execute(statement)


async def _generate_org_app_name(db_session: AsyncSession, user_display_name: str) -> str:
    """Generate the actual app name for organization apps with prefix."""
    candidate_app_name = format_to_screaming_snake_case(user_display_name)

    # Check if the candidate name is not existing in the global apps by querying the database
    statement = select(
        exists().where(
            App.project_id.is_(None),  # Only check global apps
            App.name == candidate_app_name,
        )
    )
    result = await db_session.execute(statement)
    exists_global_app = result.scalar_one_or_none()
    if exists_global_app:
        # Use a unique name by appending a suffix
        return f"{APP_ORG_PREFIX}{format_to_screaming_snake_case(user_display_name)}"

    return candidate_app_name


async def create_user_app(
        db_session: AsyncSession,
        app_upsert: AppUpsert,
        project_id: UUID,
) -> App:
    """
    Create a user app with org prefix naming convention.
    """
    logger.debug(f"Creating user app: {app_upsert} for project_id: {project_id}")

    # Find the best candidate app name
    actual_app_name = await _generate_org_app_name(db_session, app_upsert.display_name)

    # Prepare app data
    app_data = app_upsert.model_dump(mode="json", exclude_none=True)
    app_data["name"] = actual_app_name
    app_data["project_id"] = project_id

    app = App(**app_data)

    db_session.add(app)
    await db_session.flush()
    await db_session.refresh(app)
    return app


async def update_user_app(
        db_session: AsyncSession,
        app_name: str,
        app_upsert: AppUpsert,
        project_id: UUID,
) -> App:
    """
    Update an existing user app by name.
    Note: App name cannot be changed once created.
    """
    logger.debug(f"Updating user app: {app_name} for project_id: {project_id}")

    # Get the app and verify it belongs to the org
    app = await get_user_app_by_name(db_session, app_name, project_id)
    if not app:
        raise ConflictError("App not found or does not belong to your organization")

    new_app_data = app_upsert.model_dump(mode="json", exclude_unset=True)

    # Prevent name changes
    if "name" in new_app_data:
        del new_app_data["name"]
        logger.warning(f"Attempted to change app name for app {app_name}, ignoring name field")

    # Update app fields
    for field, value in new_app_data.items():
        setattr(app, field, value)

    await db_session.flush()
    await db_session.refresh(app)
    return app


async def delete_user_app(
        db_session: AsyncSession,
        app_name: str,
        project_id: UUID,
) -> None:
    """
    Delete a user app by name and project_id.
    """
    logger.debug(f"Deleting user app: {app_name} for project_id: {project_id}")

    # Get the app and verify it belongs to the org
    app = await get_user_app_by_name(db_session, app_name, project_id)
    if not app:
        raise ConflictError("App not found or does not belong to your organization")

    # Verify it's not a global app (additional safety check)
    if app.project_id is None:
        raise ConflictError("Cannot delete global app")

    await db_session.delete(app)
    await db_session.flush()


async def get_user_app(
        db_session: AsyncSession,
        app_name: str,
        project_id: UUID,
        active_only: bool = True,
) -> App | None:
    """
    Get a user app by name (user-provided name, not the actual stored name).
    """
    statement = select(App).filter_by(name=app_name, project_id=project_id)

    if active_only:
        statement = statement.filter(App.active)

    result = await db_session.execute(statement)
    return result.scalar_one_or_none()


async def get_user_apps(
        db_session: AsyncSession,
        project_id: UUID,
        active_only: bool = True,
        search: str | None = None,
        categories: list[str] | None = None,
        limit: int | None = None,
        offset: int | None = None,
) -> list[App]:
    """
    Get all apps belonging to a specific organization.
    """
    statement = select(App).filter(App.project_id == project_id)

    if active_only:
        statement = statement.filter(App.active)

    # Add search functionality
    if search:
        search_term = f"%{search.lower()}%"
        statement = statement.filter(
            or_(
                App.name.ilike(search_term),
                App.description.ilike(search_term),
                App.display_name.ilike(search_term)
            )
        )

    # Add category filtering
    if categories:
        statement = statement.filter(App.categories.overlap(categories))

    # Order by name for consistent results
    statement = statement.order_by(App.name)

    if offset is not None:
        statement = statement.offset(offset)
    if limit is not None:
        statement = statement.limit(limit)

    result = await db_session.execute(statement)
    return list(result.scalars().all())


async def count_user_apps(
        db_session: AsyncSession,
        project_id: UUID,
        active_only: bool = True,
        search: str | None = None,
        categories: list[str] | None = None,
) -> int:
    """
    Count apps belonging to a specific organization.
    """
    statement = select(func.count(App.id)).filter(App.project_id == project_id)

    if active_only:
        statement = statement.filter(App.active)

    # Add search functionality
    if search:
        search_term = f"%{search.lower()}%"
        statement = statement.filter(
            or_(
                App.name.ilike(search_term),
                App.description.ilike(search_term),
                App.display_name.ilike(search_term)
            )
        )

    # Add category filtering
    if categories:
        statement = statement.filter(App.categories.overlap(categories))

    result = await db_session.execute(statement)
    return result.scalar() or 0


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
        project_id=app.project_id,
    )


async def get_user_app_by_name(
        db_session: AsyncSession,
        app_name: str,
        project_id: UUID,
) -> App | None:
    """
    Get a user app by name and project_id.
    This looks for the actual stored app name (with org prefix).
    """
    statement = select(App).filter_by(name=app_name, project_id=project_id)
    result = await db_session.execute(statement)
    return result.scalar_one_or_none()
