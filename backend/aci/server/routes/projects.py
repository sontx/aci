from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from aci.common.db import crud
from aci.common.db.sql_models import Project
from aci.common.exceptions import (
    ProjectIsLastInOrgError,
    ProjectNotFound,
)
from aci.common.logging_setup import get_logger
from aci.common.schemas.project import ProjectCreate, ProjectPublic, ProjectUpdate
from aci.server import acl, quota_manager
from aci.server.dependencies import RequestContext, get_request_context

# Create router instance
router = APIRouter()
logger = get_logger(__name__)

auth = acl.get_propelauth()


# TODO: Once member has been introduced change the ACL to require_org_member_with_minimum_role
@router.post("", response_model=ProjectPublic, include_in_schema=True)
async def create_project(
        body: ProjectCreate,
        context: Annotated[RequestContext, Depends(get_request_context)],
) -> ProjectPublic:
    logger.info(f"Create project, user_id={context.user.user_id}, org_id={body.org_id}")

    acl.validate_user_access_to_org(context.user, body.org_id)
    await quota_manager.enforce_project_creation_quota(context.db_session, body.org_id)

    project = await crud.projects.create_project(context.db_session, body.org_id, body.name)

    project_public = ProjectPublic.model_validate(project)
    await context.db_session.commit()
    return project_public


@router.get("", response_model=list[ProjectPublic], include_in_schema=True)
async def get_projects(
        context: Annotated[RequestContext, Depends(get_request_context)],
) -> list[Project]:
    """
    Get all projects for the organization if the user is a member of the organization.
    """
    acl.validate_user_access_to_org(context.user, context.project.org_id)

    logger.info(f"Get projects, user_id={context.user.user_id}, org_id={context.project.org_id}")

    projects = await crud.projects.get_projects_by_org(context.db_session, context.project.org_id)

    return projects


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT, include_in_schema=True)
async def delete_project(
        project_id: UUID,
        context: Annotated[RequestContext, Depends(get_request_context)],
) -> None:
    """
    Delete a project by project id.

    This operation will cascade delete all related data:
    - API keys
    - App configurations
    - Linked accounts

    All associations to the project will be removed from the database.
    """
    logger.info(f"Delete project, project_id={project_id}, user_id={context.user.user_id}")

    await acl.validate_user_access_to_project(context.db_session, context.user, project_id)

    # Get the project to check its organization
    project = await crud.projects.get_project(context.db_session, project_id)
    if not project:
        logger.error(f"Project not found, project_id={project_id}")
        raise ProjectNotFound(f"project={project_id} not found")

    # Check if this is the last project in the organization
    org_projects = await crud.projects.get_projects_by_org(context.db_session, project.org_id)
    if len(org_projects) <= 1:
        logger.error(
            f"Cannot delete last project, project_id={project_id}, org_id={project.org_id}"
        )
        raise ProjectIsLastInOrgError()

    await crud.projects.delete_project(context.db_session, project_id)
    await context.db_session.commit()


@router.patch("/{project_id}", response_model=ProjectPublic, include_in_schema=True)
async def update_project(
        project_id: UUID,
        body: ProjectUpdate,
        context: Annotated[RequestContext, Depends(get_request_context)],
) -> ProjectPublic:
    """
    Update a project by project id.
    Currently, supports updating the project name.
    """
    logger.info(f"Update project, project_id={project_id}, user_id={context.user.user_id}")

    await acl.validate_user_access_to_project(context.db_session, context.user, project_id)

    project = await crud.projects.get_project(context.db_session, project_id)
    if not project:
        logger.error(f"Project not found, project_id={project_id}")
        raise ProjectNotFound(f"project={project_id} not found")

    updated_project = await crud.projects.update_project(context.db_session, project, body)

    project_public = ProjectPublic.model_validate(updated_project)
    await context.db_session.commit()
    return project_public
