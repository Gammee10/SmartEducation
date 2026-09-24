// API envelope helpers. Backend responses are { success, message, data } with
// an optional sibling `pagination` for list endpoints (AGENTS.md contract).
import type { AxiosResponse } from 'axios';
import type { Pagination } from '../types';

/** Unwrap the `data` payload from a standard envelope response. */
export function unwrap<T>(res: AxiosResponse<{ data: T }>): T {
  return res.data.data;
}

/** Unwrap a paginated list response into items + pagination metadata. */
export function unwrapPage<T>(res: AxiosResponse<{ data: T[]; pagination?: Pagination }>): {
  items: T[];
  pagination?: Pagination;
} {
  return { items: res.data.data, pagination: res.data.pagination };
}
