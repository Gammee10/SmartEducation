// Notifications API.
import api from './client';
import { unwrapPage } from './envelope';
import type { AppNotification, Pagination } from '../types';

export async function listNotifications(
  params: { unreadOnly?: boolean; page?: number; pageSize?: number } = {},
  signal?: AbortSignal
): Promise<{ notifications: AppNotification[]; pagination?: Pagination }> {
  const res = await api.get('/notifications', {
    params: { unreadOnly: params.unreadOnly || undefined, page: params.page, pageSize: params.pageSize ?? 50 },
    signal,
  });
  const { items, pagination } = unwrapPage<AppNotification>(res);
  return { notifications: items, pagination };
}

export async function getUnreadCount(signal?: AbortSignal): Promise<number> {
  const res = await api.get('/notifications/unread-count', { signal });
  return res.data.data.count;
}

export async function markRead(id: string): Promise<void> {
  await api.put(`/notifications/${id}/read`);
}

export async function markAllRead(): Promise<void> {
  await api.put('/notifications/read-all');
}
