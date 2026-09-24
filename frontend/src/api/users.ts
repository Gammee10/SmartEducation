// User admin API.
import api from './client';
import { unwrap, unwrapPage } from './envelope';
import type { AdminUser, ApiResponse, ImportResult, Pagination, User } from '../types';

export async function listUsers(
  params: { role?: string; status?: string; search?: string; page?: number; pageSize?: number } = {},
  signal?: AbortSignal
): Promise<{ users: AdminUser[]; pagination?: Pagination }> {
  const res = await api.get<ApiResponse<AdminUser[]>>('/users', {
    params: {
      role: params.role || undefined,
      status: params.status || undefined,
      search: params.search || undefined,
      page: params.page,
      pageSize: params.pageSize ?? 100,
    },
    signal,
  });
  const { items, pagination } = unwrapPage<AdminUser>(res);
  return { users: items, pagination };
}

export async function createUser(data: object): Promise<User> {
  const res = await api.post<ApiResponse<{ user: User }>>('/users', data);
  return unwrap(res).user;
}

export async function updateUser(id: string, data: object): Promise<User> {
  const res = await api.put<ApiResponse<{ user: User }>>(`/users/${id}`, data);
  return unwrap(res).user;
}

export async function archiveUser(id: string): Promise<User> {
  const res = await api.post<ApiResponse<{ user: User }>>(`/users/${id}/archive`);
  return unwrap(res).user;
}

export async function resetUserPassword(id: string): Promise<{ userId: string; temporaryPassword: string }> {
  const res = await api.post<ApiResponse<{ userId: string; temporaryPassword: string }>>(
    `/users/${id}/reset-password`
  );
  return unwrap(res);
}

export async function importUsers(csv: string, filename = 'bulk-import.csv'): Promise<ImportResult> {
  const res = await api.post<ApiResponse<{ import: ImportResult }>>('/users/import', { csv, filename });
  return unwrap(res).import;
}
