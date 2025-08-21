from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from typing import Annotated
from typing import Callable
from uuid import UUID

from fastapi import Depends, Security
from fastapi import Request, HTTPException, status
from fastapi.security import APIKeyHeader, HTTPBearer
from propelauth_py import User
from sqlalchemy.orm import Session

from aci.common import utils
from aci.common.db import crud
from aci.common.db.sql_models import Project
from aci.common.enums import APIKeyStatus
from aci.common.exceptions import (
    DailyQuotaExceeded,
    InvalidAPIKey,
    ProjectNotFound,
)
from aci.common.logging_setup import get_logger
from aci.server import billing, config, acl
from aci.server.config import ACI_PROJECT_ID_HEADER, ACI_ORG_ID_HEADER
from aci.server.quota_service import consume_monthly_quota

logger = get_logger(__name__)
http_bearer = HTTPBearer(auto_error=True, description="login to receive a JWT token")
api_key_header = APIKeyHeader(
    name=config.ACI_API_KEY_HEADER,
    description="API key for authentication",
    auto_error=True,
)

auth = acl.get_propelauth()


def extract_org_id(user: User, prefer_org_id: str):
    org_id = None
    if prefer_org_id:
        # Check if the preferred org ID is existing in user.get_orgs() and belongs to the user
        orgs = user.get_orgs()
        if any(org.org_id == prefer_org_id for org in orgs):
            org_id = prefer_org_id
    elif user.active_org_id:
        org_id = user.active_org_id
    else:
        # If the user has multiple orgs, we can choose the first one
        first_org = user.get_orgs()[0]
        if first_org:
            org_id = first_org.org_id

    return UUID(org_id)


class RequestContext:
    def __init__(self, user: User, project: Project, db_session: Session):
        self.user = user
        self.db_session = db_session
        self.project = project


def yield_db_session() -> Generator[Session, None, None]:
    db_session = utils.create_db_session(config.DB_FULL_URL)
    try:
        yield db_session
    finally:
        db_session.close()


def validate_api_key(
        db_session: Annotated[Session, Depends(yield_db_session)],
        api_key_key: Annotated[str, Security(api_key_header)],
) -> UUID:
    """Validate API key and return the API key ID. (not the actual API key string)"""
    api_key = crud.projects.get_api_key(db_session, api_key_key)
    if api_key is None:
        logger.error(f"API key not found, partial_api_key={api_key_key[:4]}****{api_key_key[-4:]}")
        raise InvalidAPIKey("api key not found")

    elif api_key.status == APIKeyStatus.DISABLED:
        logger.error(f"API key is disabled, api_key_id={api_key.id}")
        raise InvalidAPIKey("API key is disabled")

    elif api_key.status == APIKeyStatus.DELETED:
        logger.error(f"API key is deleted, api_key_id={api_key.id}")
        raise InvalidAPIKey("API key is deleted")

    else:
        api_key_id: UUID = api_key.id
        logger.info(f"API key validation successful, api_key_id={api_key_id}")
        return api_key_id


def get_header(header_name: str) -> Callable:
    async def dependency(request: Request) -> str:
        value = request.headers.get(header_name)
        if value is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing header: {header_name}",
            )
        return value

    return dependency


def get_request_context(
        user: Annotated[User, Depends(auth.require_user)],
        db_session: Annotated[Session, Depends(yield_db_session)],
        prefer_org_id: UUID = Depends(get_header(ACI_ORG_ID_HEADER)),
        project_id: UUID = Depends(get_header(ACI_PROJECT_ID_HEADER)),
) -> RequestContext:
    """
    Returns a RequestContext object containing the DB session,
    the validated API key ID, and the project ID.
    """
    project = crud.projects.get_project(db_session, project_id)
    if not project:
        logger.error(f"Project not found, project_id={project_id}")
        raise ProjectNotFound(f"Project not found, project_id={project_id}")

    org_id = extract_org_id(user, str(prefer_org_id) if prefer_org_id else project.org_id)
    if not org_id:
        logger.error("No valid organization found for the user")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid organization found for the user",
        )

    if project.org_id != org_id:
        logger.error(f"Project {project.id} does not belong to organization {org_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Project {project.id} does not belong to organization {org_id}",
        )

    return RequestContext(
        db_session=db_session,
        project=project,
        user=user,
    )


async def validate_monthly_quota(
        context: RequestContext = Depends(get_request_context)
) -> RequestContext:
    """
    Use quota for a project operation.

    1. Only check and manage quota for certain endpoints
    2. Reset quota if it's a new month
    3. Increment usage or raise error if exceeded
    """

    await consume_monthly_quota(context.db_session, context.project.id, 1)
    return context
