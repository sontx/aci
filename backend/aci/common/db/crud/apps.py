"""
CRUD operations for apps. (not including app_configurations)
"""

from uuid import UUID

from sqlalchemy import select, update, or_, func
from sqlalchemy.orm import Session

from aci.common.config import APP_ORG_PREFIX
from aci.common.db.sql_models import App
from aci.common.enums import SecurityScheme, Visibility
from aci.common.exceptions import ConflictError
from aci.common.logging_setup import get_logger
from aci.common.schemas.app import AppUpsert, AppDetails
from aci.common.schemas.security_scheme import SecuritySchemesPublic
from aci.common.utils import format_to_screaming_snake_case

logger = get_logger(__name__)


def create_app(
        db_session: Session,
        app_upsert: AppUpsert,
) -> App:
    logger.debug(f"Creating app: {app_upsert}")

    app_data = app_upsert.model_dump(mode="json", exclude_none=True)
    app = App(
        **app_data,
    )

    db_session.add(app)
    db_session.flush()
    db_session.refresh(app)
    return app


def update_app(
        db_session: Session,
        app: App,
        app_upsert: AppUpsert,
) -> App:
    """
    Update an existing app.
    """
    new_app_data = app_upsert.model_dump(mode="json", exclude_unset=True)

    for field, value in new_app_data.items():
        setattr(app, field, value)

    db_session.flush()
    db_session.refresh(app)
    return app


def update_app_default_security_credentials(
        db_session: Session,
        app: App,
        security_scheme: SecurityScheme,
        security_credentials: dict,
) -> None:
    # Note: this update works because of the MutableDict.as_mutable(JSON) in the sql_models.py
    # TODO: check if this is the best practice and double confirm that nested dict update does NOT work
    app.default_security_credentials_by_scheme[security_scheme] = security_credentials


def get_app_by_name(
        db_session: Session,
        app_name: str,
        org_id: UUID | None = None,
) -> App | None:
    statement = select(App).filter_by(name=app_name)
    # Filter to show global apps (org_id is None) and user's org apps
    if org_id is not None:
        statement = statement.filter(or_(App.org_id.is_(None), App.org_id == org_id))
    app: App | None = db_session.execute(statement).scalar_one_or_none()
    return app


def get_app(
        db_session: Session,
        app_name: str,
        public_only: bool,
        active_only: bool,
        org_id: UUID | None = None
) -> App | None:
    statement = select(App).filter_by(name=app_name)

    if active_only:
        statement = statement.filter(App.active)
    if public_only:
        statement = statement.filter(App.visibility == Visibility.PUBLIC)

    # Filter to show global apps (org_id is None) and user's org apps
    if org_id is not None:
        statement = statement.filter(or_(App.org_id.is_(None), App.org_id == org_id))

    app: App | None = db_session.execute(statement).scalar_one_or_none()
    return app


def _build_filtered_app_query(
        public_only: bool,
        active_only: bool,
        app_names: list[str] | None,
        org_id: UUID | None,
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

    # Filter to show global apps (org_id is None) and user's org apps
    if org_id is not None:
        statement = statement.filter(or_(App.org_id.is_(None), App.org_id == org_id))

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


def get_apps(
        db_session: Session,
        public_only: bool,
        active_only: bool,
        app_names: list[str] | None,
        org_id: UUID | None = None,
        search: str | None = None,
        categories: list[str] | None = None,
        limit: int | None = None,
        offset: int | None = None,
) -> list[App]:
    statement = _build_filtered_app_query(
        public_only, active_only, app_names, org_id, search, categories
    )

    # Order by name for consistent results
    statement = statement.order_by(App.name)

    if offset is not None:
        statement = statement.offset(offset)
    if limit is not None:
        statement = statement.limit(limit)

    return list(db_session.execute(statement).scalars().all())


def count_apps(
        db_session: Session,
        public_only: bool,
        active_only: bool,
        app_names: list[str] | None,
        org_id: UUID | None = None,
        search: str | None = None,
        categories: list[str] | None = None,
) -> int:
    """Count apps matching the given criteria."""
    statement = _build_filtered_app_query(
        public_only, active_only, app_names, org_id, search, categories
    )

    # Replace the select with count
    statement = statement.with_only_columns(func.count(App.id))

    return db_session.execute(statement).scalar() or 0


def get_all_categories(
        db_session: Session,
        public_only: bool,
        active_only: bool,
        org_id: UUID | None = None,
) -> list[str]:
    """Get all unique categories from apps."""
    statement = _build_filtered_app_query(
        public_only, active_only, None, org_id, None, None
    )

    # Replace the select with unnest categories
    statement = statement.with_only_columns(
        func.unnest(App.categories).label('category')
    ).distinct().order_by('category')

    categories = db_session.execute(statement).scalars().all()
    return [cat for cat in categories if cat]  # Filter out None values


def set_app_active_status(db_session: Session, app_name: str, active: bool) -> None:
    statement = update(App).filter_by(name=app_name).values(active=active)
    db_session.execute(statement)


def set_app_visibility(db_session: Session, app_name: str, visibility: Visibility) -> None:
    statement = update(App).filter_by(name=app_name).values(visibility=visibility)
    db_session.execute(statement)


def _generate_org_app_name(user_display_name: str, org_id: UUID) -> str:
    """Generate the actual app name for organization apps with prefix."""
    # Convert to uppercase and add org prefix
    return f"{APP_ORG_PREFIX}{format_to_screaming_snake_case(user_display_name)}"


def _check_app_name_conflicts(
        db_session: Session,
        app_name: str,
        org_id: UUID | None = None,
        exclude_app_id: UUID | None = None
) -> None:
    """
    Check if the app name conflicts with existing apps.
    For org apps, check against both global apps and other org apps.
    """
    # Build base query
    statement = select(App).filter(App.name == app_name)

    # Exclude current app if updating
    if exclude_app_id:
        statement = statement.filter(App.id != exclude_app_id)

    # For org apps, check against global apps and same org apps
    if org_id is not None:
        statement = statement.filter(or_(App.org_id == org_id))
    else:
        # For global apps, check against all apps (global and org)
        pass  # No additional filter needed

    existing_app = db_session.execute(statement).scalar_one_or_none()
    if existing_app:
        if existing_app.org_id is None:
            raise ConflictError(f"App name '{app_name}' conflicts with existing global app")
        else:
            raise ConflictError(f"App name '{app_name}' already exists in your organization")


def create_user_app(
        db_session: Session,
        app_upsert: AppUpsert,
        org_id: UUID,
) -> App:
    """
    Create a user app with org prefix naming convention.
    """
    logger.debug(f"Creating user app: {app_upsert} for org_id: {org_id}")

    # Generate app name from display name

    # Generate the actual app name with org prefix
    actual_app_name = _generate_org_app_name(app_upsert.display_name, org_id)

    # Check for name conflicts
    _check_app_name_conflicts(db_session, actual_app_name, org_id)

    # Prepare app data
    app_data = app_upsert.model_dump(mode="json", exclude_none=True)
    app_data["name"] = actual_app_name
    app_data["org_id"] = org_id

    app = App(**app_data)

    db_session.add(app)
    db_session.flush()
    db_session.refresh(app)
    return app


def update_user_app(
        db_session: Session,
        app_name: str,
        app_upsert: AppUpsert,
        org_id: UUID,
) -> App:
    """
    Update an existing user app by name.
    Note: App name cannot be changed once created.
    """
    logger.debug(f"Updating user app: {app_name} for org_id: {org_id}")

    # Get the app and verify it belongs to the org
    app = get_user_app_by_name(db_session, app_name, org_id)
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

    db_session.flush()
    db_session.refresh(app)
    return app


def delete_user_app(
        db_session: Session,
        app_name: str,
        org_id: UUID,
) -> None:
    """
    Delete a user app by name and org_id.
    """
    logger.debug(f"Deleting user app: {app_name} for org_id: {org_id}")

    # Get the app and verify it belongs to the org
    app = get_user_app_by_name(db_session, app_name, org_id)
    if not app:
        raise ConflictError("App not found or does not belong to your organization")

    # Verify it's not a global app (additional safety check)
    if app.org_id is None:
        raise ConflictError("Cannot delete global app")

    db_session.delete(app)
    db_session.flush()


def get_user_app(
        db_session: Session,
        app_name: str,
        org_id: UUID,
        active_only: bool = True,
) -> App | None:
    """
    Get a user app by name (user-provided name, not the actual stored name).
    """
    statement = select(App).filter_by(name=app_name, org_id=org_id)

    if active_only:
        statement = statement.filter(App.active)

    return db_session.execute(statement).scalar_one_or_none()


def get_user_apps(
        db_session: Session,
        org_id: UUID,
        active_only: bool = True,
        search: str | None = None,
        categories: list[str] | None = None,
        limit: int | None = None,
        offset: int | None = None,
) -> list[App]:
    """
    Get all apps belonging to a specific organization.
    """
    statement = select(App).filter(App.org_id == org_id)

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

    return list(db_session.execute(statement).scalars().all())


def count_user_apps(
        db_session: Session,
        org_id: UUID,
        active_only: bool = True,
        search: str | None = None,
        categories: list[str] | None = None,
) -> int:
    """
    Count apps belonging to a specific organization.
    """
    statement = select(func.count(App.id)).filter(App.org_id == org_id)

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

    return db_session.execute(statement).scalar() or 0


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
        org_id=app.org_id,
    )


def get_user_app_by_name(
        db_session: Session,
        app_name: str,
        org_id: UUID,
) -> App | None:
    """
    Get a user app by name and org_id.
    This looks for the actual stored app name (with org prefix).
    """
    statement = select(App).filter_by(name=app_name, org_id=org_id)
    return db_session.execute(statement).scalar_one_or_none()
