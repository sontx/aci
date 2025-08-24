from collections.abc import Generator
from typing import Annotated, Optional, Any, AsyncGenerator
from typing import Callable
from uuid import UUID

from fastapi import Depends, Security
from fastapi import Request, HTTPException, status
from fastapi.security import APIKeyHeader, HTTPBearer, HTTPAuthorizationCredentials
from propelauth_py import User, UnknownLoginMethod
from propelauth_py.user import OrgMemberInfo
from sqlalchemy.ext.asyncio import AsyncSession

from aci.common import utils
from aci.common.db import crud
from aci.common.db.sql_models import Project
from aci.common.enums import APIKeyStatus
from aci.common.exceptions import (
    InvalidAPIKey,
    ProjectNotFound,
)
from aci.common.logging_setup import get_logger
from aci.server import config, acl
from aci.server.config import ACI_PROJECT_ID_HEADER, ACI_ORG_ID_HEADER
from aci.server.quota_service import consume_monthly_quota

logger = get_logger(__name__)
http_bearer = HTTPBearer(auto_error=False, description="login to receive a JWT token")
api_key_header = APIKeyHeader(
    name=config.ACI_API_KEY_HEADER,
    description="API key for authentication",
    auto_error=False,
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
    def __init__(self, user: User, project: Project, db_session: AsyncSession):
        self.user = user
        self.db_session = db_session
        self.project = project


class RequestContext2(RequestContext):
    def __init__(self, user: User, project: Project, db_session: AsyncSession, api_key_name: Optional[str] = None):
        super().__init__(user, project, db_session)
        self.api_key_name = api_key_name


class APIKeyContext:
    def __init__(
            self, db_session: AsyncSession,
            project: Project | None = None,
            api_key_name: str | None = None,
            api_key_id: UUID | None = None
    ):
        self.project = project
        self.db_session = db_session
        self.api_key_name = api_key_name
        self.api_key_id = api_key_id


async def yield_db_async_session() -> AsyncGenerator[AsyncSession, None]:
    db_session = utils.create_db_async_session(config.DB_FULL_URL)
    try:
        yield db_session
    finally:
        await db_session.close()


async def yield_db_async_session2() -> AsyncGenerator[AsyncSession, None]:
    db_session = utils.create_db_async_session(config.DB_FULL_URL,
                                               expire_on_commit=False)  # expire_on_commit is false for multiple commits
    try:
        yield db_session
    finally:
        await db_session.close()


async def validate_api_key(
        db_session: Annotated[AsyncSession, Depends(yield_db_async_session)],
        api_key_key: Annotated[str, Security(api_key_header)],
) -> UUID:
    """Validate API key and return the API key ID. (not the actual API key string)"""
    api_key = await crud.projects.get_api_key(db_session, api_key_key)
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


def get_header(header_name: str, optional=False) -> Callable:
    async def dependency(request: Request) -> str:
        value = request.headers.get(header_name)
        if value is None and not optional:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing header: {header_name}",
            )
        return value

    return dependency


async def get_request_context(
        user: Annotated[User, Depends(auth.require_user)],
        db_session: Annotated[AsyncSession, Depends(yield_db_async_session)],
        prefer_org_id: UUID = Depends(get_header(ACI_ORG_ID_HEADER)),
        project_id: UUID = Depends(get_header(ACI_PROJECT_ID_HEADER)),
) -> RequestContext:
    """
    Returns a RequestContext object containing the DB session,
    the validated API key ID, and the project ID.
    """
    project = await crud.projects.get_project(db_session, project_id)
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


async def get_request_context2(
        db_session: Annotated[AsyncSession, Depends(yield_db_async_session)],
        jwt_token: Annotated[Optional[HTTPAuthorizationCredentials], Security(http_bearer)] = None,
        api_key: Annotated[Optional[str], Security(api_key_header)] = None,
        prefer_org_id: UUID | None = Depends(get_header(ACI_ORG_ID_HEADER, optional=True)),
        project_id: UUID | None = Depends(get_header(ACI_PROJECT_ID_HEADER, optional=True)),
) -> RequestContext2:
    """
    Returns a RequestContext2 object that supports both user JWT authentication and API key authentication.
    Either a valid JWT token or a valid API key must be provided.
    """

    # Try API key authentication first
    if api_key:
        api_key_context = await get_api_key_context(
            db_session=db_session,
            api_key=api_key,
        )

        project = api_key_context.project

        org_id = str(project.org_id)
        return RequestContext2(
            # An api key user which is not a real user but a placeholder for API key authentication
            user=User(
                user_id=str(api_key_context.api_key_id),
                email="",
                login_method=UnknownLoginMethod(),
                org_id_to_org_member_info={
                    org_id: OrgMemberInfo(
                        org_id=org_id,
                        org_name="",
                        user_assigned_role="",
                        org_metadata={},
                        user_permissions=[],
                        user_inherited_roles_plus_current_role=[],
                    )
                }
            ),
            project=project,
            db_session=db_session,
            api_key_name=api_key_context.api_key_name,
        )
    # Try JWT authentication if no API key provided
    elif jwt_token:
        if not project_id:
            logger.error("Project ID must be provided when using JWT authentication")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing project ID in header '{ACI_PROJECT_ID_HEADER}'"
            )
        if not prefer_org_id:
            logger.error("Organization ID must be provided when using JWT authentication")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing organization ID in header '{ACI_ORG_ID_HEADER}'"
            )

        user = auth.require_user(jwt_token)
        context = await get_request_context(user, db_session, prefer_org_id, project_id)
        return RequestContext2(
            user=context.user,
            project=context.project,
            db_session=context.db_session,
        )
    else:
        logger.error("No authentication method provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Either JWT token or API key must be provided for authentication"
        )


async def get_api_key_context(
        db_session: Annotated[AsyncSession, Depends(yield_db_async_session2)],
        api_key: Annotated[Optional[str], Security(api_key_header)] = None,
) -> APIKeyContext:
    """
    Returns an APIKeyContext object containing the project and API key name.
    This is used for API key authenticated requests.
    """
    if not api_key:
        return APIKeyContext(
            db_session=db_session,
        )

    # Verify API key and extract information
    api_key_extract = await crud.api_keys.extract_api_key(
        db_session, api_key,
    )

    if not api_key_extract:
        logger.error(f"API key verification failed, partial_api_key={api_key[:4]}****{api_key[-4:]}")
        raise InvalidAPIKey("Invalid or inactive API key")

    # Get the project
    project = api_key_extract.project

    return APIKeyContext(
        project=project,
        db_session=db_session,
        api_key_name=api_key_extract.name,
        api_key_id=api_key_extract.id,
    )


async def validate_monthly_quota(
        db_session: Annotated[AsyncSession, Depends(yield_db_async_session2)],
        jwt_token: Annotated[Optional[HTTPAuthorizationCredentials], Security(http_bearer)] = None,
        api_key: Annotated[Optional[str], Security(api_key_header)] = None,
        prefer_org_id: UUID = Depends(get_header(ACI_ORG_ID_HEADER, optional=True)),
        project_id: UUID = Depends(get_header(ACI_PROJECT_ID_HEADER, optional=True)),
) -> RequestContext2:
    """
    Use quota for a project operation.

    1. Only check and manage quota for certain endpoints
    2. Reset quota if it's a new month
    3. Increment usage or raise error if exceeded
    """

    context = await get_request_context2(
        db_session=db_session,
        jwt_token=jwt_token,
        api_key=api_key,
        prefer_org_id=prefer_org_id,
        project_id=project_id,
    )
    await consume_monthly_quota(context.db_session, context.project.id, 1)
    return context
