from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aci.common.db.sql_models import ProcessedStripeEvent
from aci.common.logging_setup import get_logger

logger = get_logger(__name__)


async def record_processed_event(db_session: AsyncSession, event_id: str) -> ProcessedStripeEvent:
    """
    Create a new processed Stripe event record.

    Args:
        db_session: The database session.
        event_id: The Stripe event ID that was processed.

    Returns:
        The created ProcessedStripeEvent record.
    """
    processed_event = ProcessedStripeEvent(event_id=event_id)
    db_session.add(processed_event)
    await db_session.flush()
    await db_session.refresh(processed_event)
    return processed_event


async def is_event_processed(db_session: AsyncSession, event_id: str) -> bool:
    """
    Check if a Stripe event has already been processed.

    Args:
        db_session: The database session.
        event_id: The Stripe event ID to check.

    Returns:
        True if the event has already been processed, False otherwise.
    """
    statement = select(ProcessedStripeEvent).filter_by(event_id=event_id)
    result = await db_session.execute(statement)
    return result.scalar_one_or_none() is not None
