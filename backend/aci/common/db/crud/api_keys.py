"""
CRUD operations for API keys.
"""

from uuid import UUID

from sqlalchemy import select, func, delete
from sqlalchemy.orm import Session

from aci.common import encryption, utils
from aci.common.db.sql_models import APIKey
from aci.common.enums import APIKeyStatus
from aci.common.logging_setup import get_logger
from aci.common.schemas.api_key import APIKeyUpdate, APIKeyExtract

logger = get_logger(__name__)


def create_api_key(
        db_session: Session,
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
    db_session.flush()
    db_session.refresh(api_key)
    return api_key, api_key_string


def get_api_key_by_id(db_session: Session, api_key_id: UUID) -> APIKey | None:
    """
    Get an API key by its ID.
    """
    return db_session.execute(
        select(APIKey).filter_by(id=api_key_id)
    ).scalar_one_or_none()


def get_api_key_by_name(db_session: Session, project_id: UUID, name: str) -> APIKey | None:
    """
    Get an API key by its name within a project.
    """
    return db_session.execute(
        select(APIKey).filter_by(project_id=project_id, name=name)
    ).scalar_one_or_none()


def get_api_keys_by_project(
        db_session: Session,
        project_id: UUID,
        limit: int = 100,
        offset: int = 0,
) -> list[APIKey]:
    """
    Get API keys for a project with pagination.
    """
    api_keys = db_session.execute(
        select(APIKey)
        .filter_by(project_id=project_id)
        .order_by(APIKey.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).scalars().all()

    return list(api_keys)


def count_api_keys_by_project(db_session: Session, project_id: UUID) -> int:
    """
    Count total API keys for a project.
    """
    return db_session.execute(
        select(func.count(APIKey.id)).filter_by(project_id=project_id)
    ).scalar() or 0


def update_api_key(
        db_session: Session,
        api_key: APIKey,
        update: APIKeyUpdate,
) -> APIKey:
    """
    Update an API key.
    """
    if update.status is not None:
        api_key.status = update.status

    db_session.flush()
    db_session.refresh(api_key)
    return api_key


def delete_api_key_by_name(db_session: Session, project_id: UUID, name: str) -> None:
    statement = (
        delete(APIKey)
        .filter_by(project_id=project_id, name=name)
    )
    db_session.execute(statement)


def hard_delete_api_key(db_session: Session, api_key_id: UUID) -> None:
    """
    Hard delete an API key from the database.
    """
    api_key = get_api_key_by_id(db_session, api_key_id)
    if api_key:
        db_session.delete(api_key)
        db_session.flush()


def extract_api_key(
        db_session: Session,
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
    result = db_session.execute(
        select(APIKey).filter_by(key_hmac=key_hmac, status=APIKeyStatus.ACTIVE)
    ).scalar_one_or_none()

    if not result:
        return None

    project = result.project
    if not project:
        logger.error(f"Project not found for API key with ID {result.id}")
        return None

    return APIKeyExtract(
        id=result.id,
        name=result.name,
        project=project,
    )
