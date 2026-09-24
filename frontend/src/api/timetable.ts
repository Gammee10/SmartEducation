// Timetable API.
import api from './client';
import { unwrap } from './envelope';
import type { ApiResponse, TimetableSlot } from '../types';

export async function listTimetable(
  params: { dayOfWeek?: string } = {},
  signal?: AbortSignal
): Promise<TimetableSlot[]> {
  const res = await api.get<ApiResponse<{ slots: TimetableSlot[] }>>('/timetable', {
    params: { dayOfWeek: params.dayOfWeek },
    signal,
  });
  return unwrap(res).slots;
}

export async function createSlot(data: object): Promise<TimetableSlot> {
  const res = await api.post<ApiResponse<{ slot: TimetableSlot }>>('/timetable', data);
  return unwrap(res).slot;
}

export async function deleteSlot(id: string): Promise<void> {
  await api.delete(`/timetable/${id}`);
}
