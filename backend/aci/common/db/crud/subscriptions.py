from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from aci.common.db.sql_models import Subscription
from aci.common.logging_setup import get_logger
from aci.common.schemas.subscription import SubscriptionUpdate

logger = get_logger(__name__)


# TODO: no need to lock for most of the reads
async def get_subscription_by_org_id(db_session: AsyncSession, org_id: UUID) -> Subscription | None:
    """
    Get a subscription by organization ID.
    """
    statement = (
        select(Subscription)
        .filter_by(org_id=org_id)
        .with_for_update()  # lock the row for the duration of the transaction
    )
    result = await db_session.execute(statement)
    return result.scalar_one_or_none()


async def get_subscription_by_stripe_id(
    db_session: AsyncSession, stripe_subscription_id: str
) -> Subscription | None:
    """
    Get a subscription by Stripe subscription ID.
    """
    statement = (
        select(Subscription)
        .filter_by(stripe_subscription_id=stripe_subscription_id)
        .with_for_update()  # lock the row for the duration of the transaction
    )
    result = await db_session.execute(statement)
    return result.scalar_one_or_none()


async def update_subscription_by_stripe_id(
    db_session: AsyncSession, stripe_subscription_id: str, subscription_update: SubscriptionUpdate
) -> Subscription | None:
    """
    Update subscription status based on Stripe subscription ID.
    """
    update_data = subscription_update.model_dump(exclude_unset=True)
    if not update_data:
        logger.info(
            f"No fields to update for subscription, stripe_subscription_id={stripe_subscription_id}"
        )
        # Need to fetch the subscription to return it
        return await get_subscription_by_stripe_id(db_session, stripe_subscription_id)

    statement = (
        update(Subscription)
        .filter_by(stripe_subscription_id=stripe_subscription_id)
        .values(**update_data)
        .returning(Subscription)  # Return the updated object
    )
    result = await db_session.execute(statement)
    updated_subscription = result.scalar_one_or_none()
    await db_session.flush()  # Ensure changes are persisted before potential refresh

    if updated_subscription:
        # No need to refresh as returning() fetches the updated state
        logger.info(f"Updated subscription, stripe_subscription_id={stripe_subscription_id}")
    else:
        logger.warning(
            f"Subscription not found during update attempt. "
            f"stripe_subscription_id={stripe_subscription_id}"
        )
    return updated_subscription


async def delete_subscription_by_stripe_id(db_session: AsyncSession, stripe_subscription_id: str) -> None:
    """
    Mark a subscription as deleted by Stripe subscription ID. Returns True if marked, False otherwise.
    """
    subscription = await get_subscription_by_stripe_id(db_session, stripe_subscription_id)
    if not subscription:
        logger.warning(
            f"Subscription not found during delete attempt, "
            f"stripe_subscription_id={stripe_subscription_id}"
        )
        return

    await db_session.delete(subscription)
    await db_session.flush()
    logger.info(f"Deleted subscription, stripe_subscription_id={stripe_subscription_id}")
