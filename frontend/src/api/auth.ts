// Auth API - login, current user, and password change.
import api from './client';
import { unwrap } from './envelope';
import type { ApiResponse, User } from '../types';

export interface LoginResult {
  token: string;
  user: User;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await api.post<ApiResponse<LoginResult>>('/auth/login', { email, password });
  return unwrap(res);
}

export async function getCurrentUser(): Promise<User> {
  const res = await api.get<ApiResponse<{ user: User }>>('/auth/me');
  return unwrap(res).user;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.put('/auth/password', { currentPassword, newPassword });
}
