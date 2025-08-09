export interface PaginationParams {
  limit?: number | null;
  offset?: number | null;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
}
