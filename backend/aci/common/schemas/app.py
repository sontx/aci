import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from aci.common.enums import SecurityScheme, Visibility
from aci.common.schemas.security_scheme import (
    APIKeyScheme,
    APIKeySchemeCredentials,
    NoAuthScheme,
    NoAuthSchemeCredentials,
    OAuth2Scheme,
    OAuth2SchemeCredentials,
    SecuritySchemesPublic,
)


class AppUpsert(BaseModel, extra="forbid"):
    name: str
    display_name: str
    provider: str
    version: str
    description: str
    logo: str
    categories: list[str]
    visibility: Visibility
    active: bool
    # TODO: consider refactor and use discriminator for security_schemes/default_security_credentials_by_scheme
    security_schemes: dict[SecurityScheme, APIKeyScheme | OAuth2Scheme | NoAuthScheme]
    default_security_credentials_by_scheme: dict[
        SecurityScheme, APIKeySchemeCredentials | OAuth2SchemeCredentials | NoAuthSchemeCredentials
    ]
    org_id: UUID | None = None

    @field_validator("name")
    def validate_name(cls, v: str) -> str:
        if not re.match(r"^[A-Z0-9_]+$", v) or "__" in v:
            raise ValueError(
                "name must be uppercase, contain only letters, numbers and underscores, and not have consecutive underscores"
            )
        return v

    @field_validator("security_schemes")
    def validate_security_schemes(
            cls, v: dict[SecurityScheme, APIKeyScheme | OAuth2Scheme]
    ) -> dict[SecurityScheme, APIKeyScheme | OAuth2Scheme]:
        for scheme_type, scheme_config in v.items():
            if scheme_type == SecurityScheme.API_KEY and not isinstance(
                    scheme_config, APIKeyScheme
            ):
                raise ValueError(f"Invalid configuration for API_KEY scheme: {scheme_config}")
            elif scheme_type == SecurityScheme.OAUTH2 and not isinstance(
                    scheme_config, OAuth2Scheme
            ):
                raise ValueError(f"Invalid configuration for OAUTH2 scheme: {scheme_config}")
            elif scheme_type == SecurityScheme.NO_AUTH and not isinstance(
                    scheme_config, NoAuthScheme
            ):
                raise ValueError(f"Invalid configuration for NO_AUTH scheme: {scheme_config}")
        return v


class AppList(BaseModel):
    app_names: list[str] | None = Field(default=None, description="List of app names to filter by.")

    # Remove empty strings from the list
    @field_validator("app_names")
    def validate_app_names(cls, v: list[str] | None) -> list[str]:
        if v is not None:
            v = [app_name for app_name in v if app_name.strip()]
            if not v:
                return None
        return v


class AppsSearch(BaseModel):
    """
    Parameters for searching applications.
    """
    search: str | None = Field(
        default=None,
        description="Search query to filter Apps by name or description.",
    )
    categories: list[str] | None = Field(
        default=None, description="List of categories for filtering."
    )
    limit: int = Field(
        default=100, ge=1, le=1000, description="Maximum number of Apps per response."
    )
    offset: int = Field(default=0, ge=0, description="Pagination offset.")

    # need this in case user set {"categories": None} which will translate to [''] in the params
    @field_validator("categories")
    def validate_categories(cls, v: list[str] | None) -> list[str] | None:
        if v is not None:
            # Remove any empty strings from the list
            v = [category for category in v if category.strip()]
            # If after removing empty strings the list is empty, set it to None
            if not v:
                return None
        return v

    # empty search or string with spaces should be treated as None
    @field_validator("search")
    def validate_search(cls, v: str | None) -> str | None:
        if v is not None and v.strip() == "":
            return None
        return v


class AppDetails(BaseModel):
    id: UUID
    name: str
    display_name: str
    provider: str
    version: str
    description: str
    logo: str | None
    categories: list[str]
    visibility: Visibility
    active: bool
    # Note this field is different from security_schemes in the db model. Here it's just a list of supported SecurityScheme.
    # the security_schemes field in the db model is a dict of supported security schemes and their config,
    # which contains sensitive information like OAuth2 client secret.
    security_schemes: list[SecurityScheme]
    # TODO: added supported_security_schemes instead of chaning security_schemes for backward compatibility
    # consider merging the two fields in the future
    supported_security_schemes: SecuritySchemesPublic

    created_at: datetime
    updated_at: datetime

    project_id: UUID | None

class UserAppDetails(AppDetails):
    security_schemes: dict[SecurityScheme, APIKeyScheme | OAuth2Scheme | NoAuthScheme]