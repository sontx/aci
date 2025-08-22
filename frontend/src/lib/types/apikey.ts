import { PagedResult, PaginationParams } from "@/lib/types/common";

export type APIKeyStatus = "active" | "disabled" | "deleted";

export interface APIKey {
  id: string;
  name: string;
  key: string; // This will be truncated (first 8 chars) when from list API
  project_id: string;
  status: APIKeyStatus;
  created_at: string;
  updated_at: string;
}

export interface APIKeyDetail extends APIKey {
  key: string; // This will be the full key when from detail API
}

export interface APIKeyCreate {
  name: string;
}

export interface APIKeyUpdate {
  status?: APIKeyStatus;
}

export interface APIKeySearchParams extends PaginationParams {
  limit?: number;
  offset?: number;
}

export interface APIKeysPagedResult extends PagedResult<APIKey> {
  items: APIKey[];
  total: number;
}
