from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from aci.common.db import crud
from aci.common.db.sql_models import Plan
from aci.common.exceptions import SubscriptionPlanNotFound
from aci.common.logging_setup import get_logger

logger = get_logger(__name__)


async def get_active_plan_by_org_id(db_session: AsyncSession, org_id: UUID) -> Plan:
    subscription = await crud.subscriptions.get_subscription_by_org_id(db_session, org_id)
    if not subscription:
        active_plan = await crud.plans.get_by_name(db_session, "free")
    else:
        active_plan = await crud.plans.get_by_id(db_session, subscription.plan_id)

    if not active_plan:
        raise SubscriptionPlanNotFound("Plan not found")
    return active_plan
