// Courses API - course CRUD, enrollment, and content.
import api from './client';
import { unwrap, unwrapPage } from './envelope';
import type { ApiResponse, ContentItem, Course, CourseEnrollment, Pagination } from '../types';

export async function listCourses(
  params: { status?: string; page?: number; pageSize?: number } = {},
  signal?: AbortSignal
): Promise<{ courses: Course[]; pagination?: Pagination }> {
  const res = await api.get<ApiResponse<Course[]>>('/courses', {
    params: { status: params.status, page: params.page, pageSize: params.pageSize ?? 100 },
    signal,
  });
  const { items, pagination } = unwrapPage<Course>(res);
  return { courses: items, pagination };
}

export async function getCourse(id: string): Promise<Course> {
  const res = await api.get<ApiResponse<{ course: Course }>>(`/courses/${id}`);
  return unwrap(res).course;
}

export async function createCourse(data: {
  title: string;
  description?: string;
  subject: string;
  gradeLevel: string;
  coverUrl?: string;
  status?: string;
}): Promise<Course> {
  const res = await api.post<ApiResponse<{ course: Course }>>('/courses', data);
  return unwrap(res).course;
}

export async function updateCourse(id: string, data: object): Promise<Course> {
  const res = await api.put<ApiResponse<{ course: Course }>>(`/courses/${id}`, data);
  return unwrap(res).course;
}

export async function enrollStudent(courseId: string, studentId: string): Promise<CourseEnrollment> {
  const res = await api.post<ApiResponse<{ enrollment: CourseEnrollment }>>(`/courses/${courseId}/enroll`, {
    studentId,
  });
  return unwrap(res).enrollment;
}

export async function unenrollStudent(courseId: string, studentId: string): Promise<void> {
  await api.post(`/courses/${courseId}/unenroll`, { studentId });
}

export async function listContent(
  courseId: string,
  params: { page?: number; pageSize?: number } = {},
  signal?: AbortSignal
): Promise<{ items: ContentItem[]; pagination?: Pagination }> {
  const res = await api.get<ApiResponse<ContentItem[]>>(`/courses/${courseId}/content`, {
    params: { page: params.page, pageSize: params.pageSize ?? 100 },
    signal,
  });
  return unwrapPage<ContentItem>(res);
}

export async function uploadContent(courseId: string, data: object): Promise<ContentItem> {
  const res = await api.post<ApiResponse<{ item: ContentItem }>>(`/courses/${courseId}/content`, data);
  return unwrap(res).item;
}

export async function archiveContent(contentId: string): Promise<ContentItem> {
  const res = await api.post<ApiResponse<{ item: ContentItem }>>(`/courses/content/${contentId}/archive`);
  return unwrap(res).item;
}
