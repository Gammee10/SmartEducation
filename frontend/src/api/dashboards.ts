// Dashboards API.
import api from './client';
import { unwrap } from './envelope';
import type { AdminDashboardData, StudentDashboardData, StudentSummary, TeacherDashboardData } from '../types';

export async function getAdminDashboard(signal?: AbortSignal): Promise<AdminDashboardData> {
  const res = await api.get('/dashboard/admin', { signal });
  return unwrap(res);
}

export async function getTeacherDashboard(signal?: AbortSignal): Promise<TeacherDashboardData> {
  const res = await api.get('/dashboard/teacher', { signal });
  return unwrap(res);
}

export async function getStudentDashboard(signal?: AbortSignal): Promise<StudentDashboardData> {
  const res = await api.get('/dashboard/student', { signal });
  return unwrap(res);
}

export async function getStudentSummary(id: string, signal?: AbortSignal): Promise<StudentSummary> {
  const res = await api.get(`/students/${id}/summary`, { signal });
  return unwrap(res);
}
