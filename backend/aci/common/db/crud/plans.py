from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aci.common.db.sql_models import Plan
from aci.common.schemas.plans import PlanFeatures, PlanUpdate


async def get_by_name(db: AsyncSession, name: str) -> Plan | None:
    """Get a plan by its name."""
    stmt = select(Plan).where(Plan.name == name)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_by_id(db: AsyncSession, id: UUID) -> Plan | None:
    """Get a plan by its id."""
    stmt = select(Plan).where(Plan.id == id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_by_stripe_price_id(db: AsyncSession, stripe_price_id: str) -> Plan | None:
    """Get a plan by its Stripe price id."""
    stmt = select(Plan).where(
        (Plan.stripe_monthly_price_id == stripe_price_id)
        | (Plan.stripe_yearly_price_id == stripe_price_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create(
    db: AsyncSession,
    name: str,
    stripe_product_id: str,
    stripe_monthly_price_id: str,
    stripe_yearly_price_id: str,
    features: PlanFeatures,
    is_public: bool,
) -> Plan:
    """Create a new plan."""
    plan = Plan(
        name=name,
        stripe_product_id=stripe_product_id,
        stripe_monthly_price_id=stripe_monthly_price_id,
        stripe_yearly_price_id=stripe_yearly_price_id,
        features=features.model_dump(),
        is_public=is_public,
    )
    db.add(plan)
    await db.flush()
    await db.refresh(plan)
    return plan


async def update_plan(db: AsyncSession, plan: Plan, plan_update: PlanUpdate) -> Plan:
    """Update an existing plan using a Pydantic model.

    Args:
        db: The database session.
        plan: The existing Plan ORM object to update.
        plan_update: Pydantic model containing the fields to update.

    Returns:
        The updated Plan ORM object.
    """
    update_data = plan_update.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(plan, field, value)

    await db.flush()
    await db.refresh(plan)
    return plan
