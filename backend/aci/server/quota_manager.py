"""
Quota and resource limitation control.

This module contains functions for enforcing various resource limits and quotas
across the platform, such as maximum projects per user, API rate limits, storage
quotas, and other resource constraints.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from aci.common.db import crud
from aci.common.exceptions import (
    MaxAgentSecretsReached,
    MaxProjectsReached,
    MaxUniqueLinkedAccountOwnerIdsReached,
    ProjectNotFound,
)
from aci.common.logging_setup import get_logger
from aci.server import billing, config

logger = get_logger(__name__)


async def enforce_project_creation_quota(db_session: AsyncSession, org_id: UUID) -> None:
    """
    Check and enforce that the user/organization hasn't exceeded their project creation quota
    based on their subscription plan.

    Args:
        db_session: Database session
        org_id: ID of the organization to check

    Raises:
        MaxProjectsReached: If the user has reached their maximum allowed projects
        SubscriptionPlanNotFound: If the organization's subscription plan cannot be found
    """
    active_plan = await billing.get_active_plan_by_org_id(db_session, org_id)

    # Get the projects quota from the plan's features
    max_projects = active_plan.features["projects"]

    projects = await crud.projects.get_projects_by_org(db_session, org_id)
    if len(projects) >= max_projects:
        logger.error(
            f"User/organization has reached maximum projects quota for their plan, "
            f"org_id={org_id}, "
            f"max_projects={max_projects} num_projects={len(projects)} plan={active_plan.name}"
        )
        raise MaxProjectsReached(
            message=f"Maximum number of projects ({max_projects}) reached for the {active_plan.name} plan"
        )


async def enforce_linked_accounts_creation_quota(
    db_session: AsyncSession, org_id: UUID, linked_account_owner_id: str
) -> None:
    """
    Check and enforce that the organization doesn't have a unique_account_owner_id exceeding the
    quota determined by the organization's current subscription plan.

    Args:
        db_session: Database session
        org_id: ID of the organization to check
        linked_account_owner_id: ID of the linked account owner to check

    Raises:
        MaxUniqueLinkedAccountOwnerIdsReached: If the organization has reached its maximum
        allowed unique linked account owner ids
        SubscriptionPlanNotFound: If the organization's subscription plan cannot be found
    """
    if await crud.linked_accounts.linked_account_owner_id_exists_in_org(
        db_session, org_id, linked_account_owner_id
    ):
        # If the linked account owner id already exists in the organization, linking this account
        # will not increase the total number of unique linked account owner ids or exceed the quota.
        return

    # Get the plan for the organization
    active_plan = await billing.get_active_plan_by_org_id(db_session, org_id)

    # Get the linked accounts quota from the plan's features
    max_unique_linked_account_owner_ids = active_plan.features["linked_accounts"]

    num_unique_linked_account_owner_ids = (
        await crud.linked_accounts.get_total_number_of_unique_linked_account_owner_ids(db_session, org_id)
    )
    if num_unique_linked_account_owner_ids >= max_unique_linked_account_owner_ids:
        logger.error(
            f"Organization has reached maximum unique linked account owner ids quota for the current plan, "
            f"org_id={org_id}, "
            f"num_unique_linked_account_owner_ids={num_unique_linked_account_owner_ids}, "
            f"max_unique_linked_account_owner_ids={max_unique_linked_account_owner_ids}, "
            f"plan={active_plan.name}"
        )
        raise MaxUniqueLinkedAccountOwnerIdsReached(
            message=f"Maximum number of unique linked account owner ids ({max_unique_linked_account_owner_ids}) reached for the {active_plan.name} plan"
        )


async def enforce_agent_secrets_quota(db_session: AsyncSession, project_id: UUID) -> None:
    """
    Check and enforce that the project hasn't exceeded its agent secrets quota.
    The quota is determined by the organization's current subscription plan.

    Args:
        db_session: Database session
        project_id: ID of the project to check

    Raises:
        MaxAgentSecretsReached: If the project has reached its maximum allowed agent secrets
        SubscriptionPlanNotFound: If the organization's subscription plan cannot be found
        ProjectNotFound: If the project cannot be found
    """
    # Get the project
    project = await crud.projects.get_project(db_session, project_id)
    if not project:
        logger.error(
            f"Project not found during agent secrets quota enforcement project_id={project_id}"
        )
        raise ProjectNotFound(f"Project {project_id} not found")

    # Get the plan for the organization
    active_plan = await billing.get_active_plan_by_org_id(db_session, project.org_id)

    # Get the agent secrets quota from the plan's features
    max_agent_secrets = active_plan.features["agent_credentials"]

    # Count the number of agent secrets for the project
    num_agent_secrets = await crud.secret.get_total_number_of_agent_secrets_for_org(
        db_session, project.org_id
    )
    if num_agent_secrets >= max_agent_secrets:
        logger.error(
            f"Project has reached maximum agent secrets quota, project_id={project_id}, "
            f"max_agent_secrets={max_agent_secrets} num_agent_secrets={num_agent_secrets}, "
            f"plan={active_plan.name}"
        )
        raise MaxAgentSecretsReached(
            message=f"Maximum number of agent secrets ({max_agent_secrets}) reached for the {active_plan.name} plan"
        )
