from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aci.common.db.sql_models import App, AppConfiguration
from aci.common.logging_setup import get_logger
from aci.common.schemas.app_configurations import (
    AppConfigurationCreate,
    AppConfigurationUpdate,
)

logger = get_logger(__name__)


async def create_app_configuration(
    db_session: AsyncSession,
    project_id: UUID,
    app_configuration_create: AppConfigurationCreate,
) -> AppConfiguration:
    """
    Create a new app configuration record
    """
    result = await db_session.execute(
        select(App.id).filter_by(name=app_configuration_create.app_name)
    )
    app_id = result.scalar_one()
    app_configuration = AppConfiguration(
        project_id=project_id,
        app_id=app_id,
        security_scheme=app_configuration_create.security_scheme,
        security_scheme_overrides=app_configuration_create.security_scheme_overrides.model_dump(
            exclude_none=True
        ),  # type: ignore
        enabled=True,
        all_functions_enabled=app_configuration_create.all_functions_enabled,
        enabled_functions=app_configuration_create.enabled_functions,
    )
    db_session.add(app_configuration)
    await db_session.flush()
    await db_session.refresh(app_configuration)

    return app_configuration


async def update_app_configuration(
    db_session: AsyncSession,
    app_configuration: AppConfiguration,
    update: AppConfigurationUpdate,
) -> AppConfiguration:
    """
    Update an app configuration by app id.
    If a field is None, it will not be changed.
    """
    # TODO: a better way to do update?
    if update.enabled is not None:
        app_configuration.enabled = update.enabled
    if update.all_functions_enabled is not None:
        app_configuration.all_functions_enabled = update.all_functions_enabled
    if update.enabled_functions is not None:
        app_configuration.enabled_functions = update.enabled_functions

    await db_session.flush()
    await db_session.refresh(app_configuration)

    return app_configuration


async def delete_app_configuration(db_session: AsyncSession, project_id: UUID, app_name: str) -> None:
    statement = (
        select(AppConfiguration)
        .join(App, AppConfiguration.app_id == App.id)
        .filter(AppConfiguration.project_id == project_id, App.name == app_name)
    )
    result = await db_session.execute(statement)
    app_to_delete = result.scalar_one()
    await db_session.delete(app_to_delete)
    await db_session.flush()


async def get_app_configurations(
    db_session: AsyncSession,
    project_id: UUID,
    app_names: list[str] | None,
    limit: int,
    offset: int,
) -> list[AppConfiguration]:
    """Get all app configurations for a project, optionally filtered by app names"""
    statement = select(AppConfiguration).filter_by(project_id=project_id)
    if app_names:
        statement = statement.join(App, AppConfiguration.app_id == App.id).filter(
            App.name.in_(app_names)
        )
    statement = statement.offset(offset).limit(limit)
    result = await db_session.execute(statement)
    app_configurations = list(result.scalars().all())
    return app_configurations


async def get_app_configuration(
    db_session: AsyncSession, project_id: UUID, app_name: str
) -> AppConfiguration | None:
    """Get an app configuration by project id and app name"""
    result = await db_session.execute(
        select(AppConfiguration)
        .join(App, AppConfiguration.app_id == App.id)
        .filter(AppConfiguration.project_id == project_id, App.name == app_name)
    )
    app_configuration: AppConfiguration | None = result.scalar_one_or_none()
    return app_configuration


async def get_app_configurations_by_app_id(db_session: AsyncSession, app_id: UUID) -> list[AppConfiguration]:
    statement = select(AppConfiguration).filter(AppConfiguration.app_id == app_id)
    result = await db_session.execute(statement)
    return list(result.scalars().all())

async def get_app_configuration_by_id(
    db_session: AsyncSession, app_configuration_id: UUID
) -> AppConfiguration | None:
    """Get an app configuration by its ID"""
    result = await db_session.execute(
        select(AppConfiguration).filter(AppConfiguration.id == app_configuration_id)
    )
    return result.scalar_one_or_none()


async def app_configuration_exists(db_session: AsyncSession, project_id: UUID, app_name: str) -> bool:
    stmt = (
        select(AppConfiguration)
        .join(App, AppConfiguration.app_id == App.id)
        .filter(
            AppConfiguration.project_id == project_id,
            App.name == app_name,
        )
    )
    result = await db_session.execute(stmt)
    return result.scalar_one_or_none() is not None
