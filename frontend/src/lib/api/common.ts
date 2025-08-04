export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface Paged<T> {
  total: number;
  items: T[];
}