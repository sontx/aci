"""
CRUD operations for projects, including direct entities under a project such as API keys.
TODO: function todelete project and all related data (app_configurations, api_keys, etc.)
"""
from datetime import date
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from aci.common import encryption
from aci.common.db.sql_models import APIKey, Project
from aci.common.enums import Visibility
from aci.common.logging_setup import get_logger
from aci.common.schemas.project import ProjectUpdate

logger = get_logger(__name__)


async def create_project(
        db_session: AsyncSession,
        org_id: UUID,
        name: str,
        visibility_access: Visibility = Visibility.PUBLIC,
) -> Project:
    this_start_month = date.today().replace(day=1)
    project = Project(
        org_id=org_id,
        name=name,
        visibility_access=visibility_access,
        monthly_quota_month=this_start_month,
    )
    db_session.add(project)
    await db_session.flush()
    await db_session.refresh(project)
    return project


async def project_exists(db_session: AsyncSession, project_id: UUID) -> bool:
    result = await db_session.execute(select(Project).filter_by(id=project_id))
    return result.scalar_one_or_none() is not None


async def get_project(db_session: AsyncSession, project_id: UUID) -> Project | None:
    """
    Get a project by primary key.
    """
    result = await db_session.execute(
        select(Project).filter_by(id=project_id)
    )
    return result.scalar_one_or_none()


async def get_projects_by_org(db_session: AsyncSession, org_id: UUID) -> list[Project]:
    result = await db_session.execute(select(Project).filter_by(org_id=org_id))
    return list(result.scalars().all())


async def get_project_by_api_key_id(db_session: AsyncSession, api_key_id: UUID) -> Project | None:
    result = await db_session.execute(select(APIKey).filter(APIKey.id == api_key_id))
    api_key = result.scalar_one_or_none()
    return api_key.project if api_key else None


async def delete_project(db_session: AsyncSession, project_id: UUID) -> None:
    # Get the project to delete
    project = await get_project(db_session, project_id)

    if not project:
        return

    # Delete the project which will cascade delete all related records
    await db_session.delete(project)
    await db_session.flush()


async def set_project_visibility_access(
        db_session: AsyncSession, project_id: UUID, visibility_access: Visibility
) -> None:
    statement = update(Project).filter_by(id=project_id).values(visibility_access=visibility_access)
    await db_session.execute(statement)


async def get_total_monthly_quota_usage_for_org(db_session: AsyncSession, org_id: UUID) -> int:
    """Get the total monthly quota usage across all projects in an organization"""
    result = await db_session.execute(
        select(func.sum(Project.monthly_quota_used)).where(Project.org_id == org_id)
    )
    quota_result = result.scalar()

    # Return 0 if no projects exist or all have 0 usage
    return quota_result or 0


async def get_api_key(db_session: AsyncSession, key: str) -> APIKey | None:
    key_hmac = encryption.hmac_sha256(key)
    result = await db_session.execute(select(APIKey).filter_by(key_hmac=key_hmac))
    return result.scalar_one_or_none()


async def get_all_api_key_ids_for_project(db_session: AsyncSession, project_id: UUID) -> list[UUID]:
    """
    Get all API key IDs for a project.
    """
    result = await db_session.execute(
        select(APIKey.id).filter_by(project_id=project_id)
    )
    return list(result.scalars().all())


async def update_project(
        db_session: AsyncSession,
        project: Project,
        update: ProjectUpdate,
) -> Project:
    """
    Update Project record
    """
    if update.name is not None:
        project.name = update.name

    await db_session.flush()
    await db_session.refresh(project)

    return project
