"""
CRUD operations for projects, including direct entities under a project such as API keys.
TODO: function todelete project and all related data (app_configurations, api_keys, etc.)
"""

import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from aci.common import encryption
from aci.common.db.sql_models import APIKey, Project
from aci.common.enums import APIKeyStatus, Visibility
from aci.common.logging_setup import get_logger
from aci.common.schemas.project import ProjectUpdate

logger = get_logger(__name__)


def create_project(
        db_session: Session,
        org_id: UUID,
        name: str,
        visibility_access: Visibility = Visibility.PUBLIC,
) -> Project:
    project = Project(
        org_id=org_id,
        name=name,
        visibility_access=visibility_access,
    )
    db_session.add(project)
    db_session.flush()
    db_session.refresh(project)
    return project


def project_exists(db_session: Session, project_id: UUID) -> bool:
    return (
            db_session.execute(select(Project).filter_by(id=project_id)).scalar_one_or_none()
            is not None
    )


def get_project(db_session: Session, project_id: UUID) -> Project | None:
    """
    Get a project by primary key.
    """
    project: Project | None = db_session.execute(
        select(Project).filter_by(id=project_id)
    ).scalar_one_or_none()
    return project


def get_projects_by_org(db_session: Session, org_id: UUID) -> list[Project]:
    projects = list(db_session.execute(select(Project).filter_by(org_id=org_id)).scalars().all())
    return projects


def get_project_by_api_key_id(db_session: Session, api_key_id: UUID) -> Project | None:
    api_key = db_session.execute(select(APIKey).filter(APIKey.id == api_key_id)).scalar_one_or_none()
    return api_key.project if api_key else None


def delete_project(db_session: Session, project_id: UUID) -> None:
    # Get the project to delete
    project = get_project(db_session, project_id)

    if not project:
        return

    # Delete the project which will cascade delete all related records
    db_session.delete(project)
    db_session.flush()


def set_project_visibility_access(
        db_session: Session, project_id: UUID, visibility_access: Visibility
) -> None:
    statement = update(Project).filter_by(id=project_id).values(visibility_access=visibility_access)
    db_session.execute(statement)


# TODO: TBD by business model
def increase_project_quota_usage(db_session: Session, project: Project) -> None:
    now: datetime = datetime.now(UTC)
    need_reset = now >= project.daily_quota_reset_at.replace(tzinfo=UTC) + timedelta(days=1)

    if need_reset:
        # Reset the daily quota
        statement = (
            update(Project)
            .where(Project.id == project.id)
            .values(
                {
                    Project.daily_quota_used: 1,
                    Project.daily_quota_reset_at: now,
                    Project.total_quota_used: project.total_quota_used + 1,
                }
            )
        )
    else:
        # Increment the daily quota
        statement = (
            update(Project)
            .where(Project.id == project.id)
            .values(
                {
                    Project.daily_quota_used: project.daily_quota_used + 1,
                    Project.total_quota_used: project.total_quota_used + 1,
                }
            )
        )

    db_session.execute(statement)


def increment_api_monthly_quota_usage(
        db_session: Session, project: Project, monthly_quota_limit: int
) -> bool:
    """
    Atomically increment API monthly quota usage for a project only if the total org usage
    stays within the limit. This prevents race conditions.

    Args:
        db_session: Database session
        project: Project to increment usage for
        monthly_quota_limit: Maximum allowed monthly quota for the org

    Returns:
        bool: True if increment was successful, False if quota would be exceeded
    """
    # Use a subquery to get current total usage for the org
    current_total_subquery = (
        select(func.coalesce(func.sum(Project.api_quota_monthly_used), 0))
        .where(Project.org_id == project.org_id)
        .scalar_subquery()
    )

    # Atomically increment only if total usage + 1 <= limit
    statement = (
        update(Project)
        .where((Project.id == project.id) & (current_total_subquery < monthly_quota_limit))
        .values(
            {
                Project.api_quota_monthly_used: Project.api_quota_monthly_used + 1,
            }
        )
    )

    result = db_session.execute(statement)

    # If rowcount is 0, the update didn't happen (quota would be exceeded)
    if result.rowcount == 0:
        return False

    db_session.refresh(project)
    return True


def reset_api_monthly_quota_for_org(
        db_session: Session, org_id: UUID, reset_date: datetime
) -> None:
    """Reset api monthly quota for all projects in an organization"""
    statement = (
        update(Project)
        .where(Project.org_id == org_id)
        .values(
            {
                Project.api_quota_monthly_used: 0,
                Project.api_quota_last_reset: reset_date,
            }
        )
    )
    db_session.execute(statement)


def get_total_monthly_quota_usage_for_org(db_session: Session, org_id: UUID) -> int:
    """Get the total monthly quota usage across all projects in an organization"""
    result = db_session.execute(
        select(func.sum(Project.api_quota_monthly_used)).where(Project.org_id == org_id)
    ).scalar()

    # Return 0 if no projects exist or all have 0 usage
    return result or 0


def get_api_key(db_session: Session, key: str) -> APIKey | None:
    key_hmac = encryption.hmac_sha256(key)
    return db_session.execute(select(APIKey).filter_by(key_hmac=key_hmac)).scalar_one_or_none()


def get_all_api_key_ids_for_project(db_session: Session, project_id: UUID) -> list[UUID]:
    """
    Get all API key IDs for a project.
    """
    api_keys = db_session.execute(
        select(APIKey.id).filter_by(project_id=project_id)
    ).scalars().all()
    return list(api_keys)


def update_project(
        db_session: Session,
        project: Project,
        update: ProjectUpdate,
) -> Project:
    """
    Update Project record
    """
    if update.name is not None:
        project.name = update.name

    db_session.flush()
    db_session.refresh(project)

    return project
