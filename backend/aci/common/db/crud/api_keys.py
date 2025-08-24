"""
CRUD operations for API keys.
"""

from uuid import UUID

from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from aci.common import encryption, utils
from aci.common.db.sql_models import APIKey
from aci.common.enums import APIKeyStatus
from aci.common.logging_setup import get_logger
from aci.common.schemas.api_key import APIKeyUpdate, APIKeyExtract

logger = get_logger(__name__)


async def create_api_key(
        db_session: AsyncSession,
        project_id: UUID,
        name: str,
) -> tuple[APIKey, str]:
    """
    Create a new API key for a project.
    """
    # Generate a new API key
    api_key_string = utils.generate_api_key()
    key_hmac = encryption.hmac_sha256(api_key_string)
    first_10_chars = api_key_string[:10]

    api_key = APIKey(
        name=name,
        key=first_10_chars,
        key_hmac=key_hmac,
        project_id=project_id,
        status=APIKeyStatus.ACTIVE,
    )

    db_session.add(api_key)
    await db_session.flush()
    await db_session.refresh(api_key)
    return api_key, api_key_string


async def get_api_key_by_id(db_session: AsyncSession, api_key_id: UUID) -> APIKey | None:
    """
    Get an API key by its ID.
    """
    result = await db_session.execute(
        select(APIKey).filter_by(id=api_key_id)
    )
    return result.scalar_one_or_none()


async def get_api_key_by_name(db_session: AsyncSession, project_id: UUID, name: str) -> APIKey | None:
    """
    Get an API key by its name within a project.
    """
    result = await db_session.execute(
        select(APIKey).filter_by(project_id=project_id, name=name)
    )
    return result.scalar_one_or_none()


async def get_api_keys_by_project(
        db_session: AsyncSession,
        project_id: UUID,
        limit: int = 100,
        offset: int = 0,
) -> list[APIKey]:
    """
    Get API keys for a project with pagination.
    """
    result = await db_session.execute(
        select(APIKey)
        .filter_by(project_id=project_id)
        .order_by(APIKey.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    api_keys = result.scalars().all()
    return list(api_keys)


async def count_api_keys_by_project(db_session: AsyncSession, project_id: UUID) -> int:
    """
    Count total API keys for a project.
    """
    result = await db_session.execute(
        select(func.count(APIKey.id)).filter_by(project_id=project_id)
    )
    return result.scalar() or 0


async def update_api_key(
        db_session: AsyncSession,
        api_key: APIKey,
        update: APIKeyUpdate,
) -> APIKey:
    """
    Update an API key.
    """
    if update.status is not None:
        api_key.status = update.status

    await db_session.flush()
    await db_session.refresh(api_key)
    return api_key


async def delete_api_key_by_name(db_session: AsyncSession, project_id: UUID, name: str) -> None:
    statement = (
        delete(APIKey)
        .filter_by(project_id=project_id, name=name)
    )
    await db_session.execute(statement)


async def hard_delete_api_key(db_session: AsyncSession, api_key_id: UUID) -> None:
    """
    Hard delete an API key from the database.
    """
    api_key = await get_api_key_by_id(db_session, api_key_id)
    if api_key:
        await db_session.delete(api_key)
        await db_session.flush()


async def extract_api_key(
        db_session: AsyncSession,
        api_key: str,
) -> APIKeyExtract | None:
    if not api_key:
        logger.error("API key is empty or None")
        return None

    # Ensure the API key is a valid string
    if not api_key.startswith("api_"):
        logger.error(f"Invalid API key format: {api_key}")
        return None

    key_hmac = encryption.hmac_sha256(api_key)
    result = await db_session.execute(
        select(APIKey).filter_by(key_hmac=key_hmac, status=APIKeyStatus.ACTIVE)
    )
    api_key_record = result.scalar_one_or_none()

    if not api_key_record:
        return None

    project = api_key_record.project
    if not project:
        logger.error(f"Project not found for API key with ID {api_key_record.id}")
        return None

    return APIKeyExtract(
        id=api_key_record.id,
        name=api_key_record.name,
        project=project,
    )
