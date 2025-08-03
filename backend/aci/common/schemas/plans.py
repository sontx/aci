from enum import Enum

from pydantic import BaseModel, Field


class PlanType(Enum):
    FREE = "free"
    STARTER = "starter"
    TEAM = "team"


class PlanFeatures(BaseModel):
    linked_accounts: int
    api_calls_monthly: int
    developer_seats: int
    custom_oauth: bool
    log_retention_days: int
    projects: int


class PlanUpdate(BaseModel, extra="forbid"):
    stripe_product_id: str | None = Field(None)
    stripe_monthly_price_id: str | None = Field(None)
    stripe_yearly_price_id: str | None = Field(None)
    features: PlanFeatures | None = Field(None)
    is_public: bool | None = Field(None)
