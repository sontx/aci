from typing import Annotated

from fastapi import APIRouter, Depends, status

from aci.common.enums import OrganizationRole
from aci.common.exceptions import OrgAccessDenied
from aci.common.logging_setup import get_logger
from aci.common.schemas.organizations import InviteMemberRequest
from aci.server import acl
from aci.server.dependencies import RequestContext, get_request_context

router = APIRouter()
logger = get_logger(__name__)

auth = acl.get_propelauth()


@router.post("/invite-user", status_code=status.HTTP_204_NO_CONTENT)
async def invite_user(
        context: Annotated[RequestContext, Depends(get_request_context)],
        body: InviteMemberRequest,
) -> None:
    """
    Invite a user to the organization.
    Only organization owners and admins can invite new users.
    Cannot invite users with the OWNER role.
    """
    logger.info(
        f"Inviting user with email={body.email} and role={body.role} "
        f"to organization with org_id={context.project.org_id}, "
        f"user_id={context.user.user_id}"
    )

    # Only owners and admins can invite users
    acl.require_org_member_with_minimum_role(context.user, context.project.org_id, OrganizationRole.ADMIN)

    # Prevent inviting users as owners
    if body.role == OrganizationRole.OWNER:
        raise OrgAccessDenied("Cannot invite users with the OWNER role")

    # Create the invitation
    # TODO: Currently we are inviting all members to the organization as admins.
    #       To be changed in the future to allow the MEMBER role aswell
    auth.invite_user_to_org(
        org_id=str(context.project.org_id),
        email=str(body.email),
        role=body.role,
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_user(
        context: Annotated[RequestContext, Depends(get_request_context)],
        user_id: str,
) -> None:
    """
    Remove a user from the organization.
    Only organization owners and admins can remove other users.
    Any user can remove themselves, except owners cannot remove themselves.
    """
    logger.info(
        f"Removing user with user_id={user_id} "
        f"from organization with org_id={context.project.org_id}, "
        f"user_id={context.user.user_id}"
    )

    # Allow users to remove themselves regardless of role, except owners
    if user_id == context.user.user_id:
        # Check if the user is an owner - owners cannot remove themselves
        org_member_info = context.user.org_id_to_org_member_info.get(str(context.project.org_id))
        if org_member_info and org_member_info.user_assigned_role == OrganizationRole.OWNER:
            raise OrgAccessDenied(
                "Organization owners cannot remove themselves from the organization"
            )

        auth.remove_user_from_org(
            org_id=str(context.project.org_id),
            user_id=user_id,
        )
        return

    # Only owners and admins can remove other users
    acl.require_org_member_with_minimum_role(context.user, context.project.org_id, OrganizationRole.ADMIN)

    # Remove the user
    auth.remove_user_from_org(
        org_id=str(context.project.org_id),
        user_id=user_id,
    )


@router.get("/users", response_model=list[dict], status_code=status.HTTP_200_OK)
async def list_users(
        context: Annotated[RequestContext, Depends(get_request_context)],
) -> list[dict]:
    """
    List all users of the organization.
    Any org user can view the list.
    """
    logger.info(f"Listing organization users with org_id={context.project.org_id}, user_id={context.user.user_id}")
    # Verify user is a member of the organization
    acl.require_org_member(context.user, context.project.org_id)

    users_paged = auth.fetch_users_in_org(
        org_id=str(context.project.org_id),
        include_orgs=True,
    )
    users = []
    for org_user in users_paged.users:
        # Get the role for this org from org_id_to_org_info
        org_info = org_user.org_id_to_org_info.get(str(context.project.org_id), {})
        role = org_info.get("user_role", None)
        users.append(
            {
                "user_id": org_user.user_id,
                "email": org_user.email,
                "role": role,
                "first_name": org_user.first_name,
                "last_name": org_user.last_name,
            }
        )
    return users
