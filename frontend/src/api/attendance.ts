// Attendance API.
import api from './client';
import { unwrap } from './envelope';
import type { ApiResponse, Attendance, CourseAttendanceView, StudentAttendanceView } from '../types';

export async function listCourseAttendance(
  courseId: string,
  params: {
    date?: string;
    page?: number;
    pageSize?: number;
    includeRoster?: boolean;
    rosterPage?: number;
    rosterPageSize?: number;
  } = {},
  signal?: AbortSignal
): Promise<CourseAttendanceView> {
  const res = await api.get<ApiResponse<CourseAttendanceView>>(`/courses/${courseId}/attendance`, {
    params: {
      date: params.date,
      page: params.page,
      pageSize: params.pageSize,
      includeRoster: params.includeRoster,
      rosterPage: params.rosterPage,
      rosterPageSize: params.rosterPageSize,
    },
    signal,
  });
  return unwrap(res);
}

export async function upsertAttendance(
  records: Array<{ studentId: string; courseId: string; date: string; status: string; comment?: string }>
): Promise<unknown> {
  const res = await api.post<ApiResponse<{ attendance: unknown }>>('/attendance/upsert', { records });
  return unwrap(res).attendance;
}

export async function correctAttendance(attendanceId: string, status: string): Promise<Attendance> {
  const res = await api.put<ApiResponse<{ attendance: Attendance }>>(`/attendance/${attendanceId}`, { status });
  return unwrap(res).attendance;
}

export async function listStudentAttendance(
  studentId: string,
  params: { courseId?: string; page?: number; pageSize?: number } = {},
  signal?: AbortSignal
): Promise<StudentAttendanceView> {
  const res = await api.get<ApiResponse<StudentAttendanceView>>(`/students/${studentId}/attendance`, {
    params: { courseId: params.courseId, page: params.page, pageSize: params.pageSize },
    signal,
  });
  return unwrap(res);
}
