import { PagedResult, PaginationParams } from "@/lib/types/common";

export type Visibility = "public" | "private";

export type SecurityScheme = "api_key" | "oauth2" | "no_auth";

export type HttpLocation = "path" | "query" | "header" | "cookie" | "body";

export interface APIKeyScheme {
  location: HttpLocation;
  name: string;
  prefix?: string | null;
}

export interface OAuth2Scheme {
  location: HttpLocation;
  name: string;
  prefix: string;
  client_id: string;
  client_secret: string;
  scope: string;
  authorize_url: string;
  access_token_url: string;
  refresh_token_url: string;
  token_endpoint_auth_method?:
    | "client_secret_basic"
    | "client_secret_post"
    | null;
  redirect_url?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface NoAuthScheme {
  // Empty object for no authentication
}

export interface APIKeySchemeCredentials {
  api_key: string;
}

export interface OAuth2SchemeCredentials {
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface NoAuthSchemeCredentials {
  // No credentials needed
}

export interface BasicFunctionDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface FunctionDetails extends BasicFunctionDefinition {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface SecuritySchemesPublic {
  [key: string]: {
    scope?: string;
  };
}

export interface UserAppDetails {
  id: string;
  name: string;
  display_name: string;
  provider: string;
  version: string;
  description: string;
  logo: string;
  categories: string[];
  visibility: string;
  active: boolean;
  security_schemes: Record<string, APIKeyScheme | OAuth2Scheme | NoAuthScheme>;
  supported_security_schemes: Record<string, { scope?: string }>;
  created_at: string;
  updated_at: string;
}

export interface UserAppUpsert {
  name: string; // Auto-generated from display_name
  display_name: string;
  provider: string;
  version: string;
  description: string;
  logo: string;
  categories: string[];
  visibility: Visibility; // Always public
  active: boolean;
  security_schemes: Record<string, APIKeyScheme | OAuth2Scheme | NoAuthScheme>;
  default_security_credentials_by_scheme: Record<
    string,
    APIKeySchemeCredentials | OAuth2SchemeCredentials | NoAuthSchemeCredentials
  >;
  org_id?: string | null;
}

export interface UserAppSearchParams extends PaginationParams {
  search?: string | null;
  categories?: string[] | null;
}

export type PagedUserApps = PagedResult<UserAppDetails>;
