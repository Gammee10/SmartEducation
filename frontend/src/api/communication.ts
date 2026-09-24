// Communication API - announcements and events.
import api from './client';
import { unwrapPage } from './envelope';
import type { Announcement, AudienceScope, Pagination, SchoolEvent } from '../types';

export async function listAnnouncements(
  params: { page?: number; pageSize?: number } = {},
  signal?: AbortSignal
): Promise<{ announcements: Announcement[]; pagination?: Pagination }> {
  const res = await api.get('/announcements', { params: { page: params.page, pageSize: params.pageSize ?? 50 }, signal });
  const { items, pagination } = unwrapPage<Announcement>(res);
  return { announcements: items, pagination };
}

export async function createAnnouncement(data: {
  title: string;
  body: string;
  audience: AudienceScope;
}): Promise<Announcement> {
  const res = await api.post('/announcements', data);
  return res.data.data.announcement;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await api.delete(`/announcements/${id}`);
}

export async function listEvents(
  params: { page?: number; pageSize?: number } = {},
  signal?: AbortSignal
): Promise<{ events: SchoolEvent[]; pagination?: Pagination }> {
  const res = await api.get('/events', { params: { page: params.page, pageSize: params.pageSize ?? 50 }, signal });
  const { items, pagination } = unwrapPage<SchoolEvent>(res);
  return { events: items, pagination };
}

export async function createEvent(data: {
  title: string;
  description?: string;
  location?: string;
  audience: AudienceScope;
  startsAt: string;
  endsAt?: string;
}): Promise<SchoolEvent> {
  const res = await api.post('/events', data);
  return res.data.data.event;
}

export async function deleteEvent(id: string): Promise<void> {
  await api.delete(`/events/${id}`);
}
