from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from aci.common.db.sql_models import LinkedAccount, Project, Secret
from aci.common.logging_setup import get_logger
from aci.common.schemas.secret import SecretCreate, SecretUpdate

logger = get_logger(__name__)


async def create_secret(
    db_session: AsyncSession,
    linked_account_id: UUID,
    secret_create: SecretCreate,
) -> Secret:
    """
    Create a new secret.
    """
    secret = Secret(
        linked_account_id=linked_account_id,
        key=secret_create.key,
        value=secret_create.value,
    )
    db_session.add(secret)
    await db_session.flush()
    await db_session.refresh(secret)

    return secret


async def get_secret(db_session: AsyncSession, linked_account_id: UUID, key: str) -> Secret | None:
    """
    Get a secret by linked_account_id and key.
    """
    statement = select(Secret).filter_by(linked_account_id=linked_account_id, key=key)
    result = await db_session.execute(statement)
    return result.scalar_one_or_none()


async def list_secrets(db_session: AsyncSession, linked_account_id: UUID) -> list[Secret]:
    """
    List all secrets for a linked account.
    """
    statement = select(Secret).filter_by(linked_account_id=linked_account_id)
    result = await db_session.execute(statement)
    secrets = result.scalars().all()

    return list(secrets)


async def update_secret(
    db_session: AsyncSession,
    secret: Secret,
    update: SecretUpdate,
) -> Secret:
    """
    Update a secret's value.
    """
    secret.value = update.value
    await db_session.flush()
    await db_session.refresh(secret)
    return secret


async def delete_secret(db_session: AsyncSession, secret: Secret) -> None:
    """
    Delete a secret.
    """
    await db_session.delete(secret)
    await db_session.flush()


async def get_total_number_of_agent_secrets_for_org(db_session: AsyncSession, org_id: UUID) -> int:
    """
    Get the total number of agent secrets for an organization across all its projects.
    Uses JOINs for better performance compared to nested subqueries.
    """
    statement = (
        select(func.count(Secret.id))
        .join(LinkedAccount, Secret.linked_account_id == LinkedAccount.id)
        .join(Project, LinkedAccount.project_id == Project.id)
        .where(Project.org_id == org_id)
    )
    result = await db_session.execute(statement)
    return result.scalar_one()
