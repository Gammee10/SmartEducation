// Assignments API - assignment CRUD, submissions, and grading.
import api from './client';
import { unwrap, unwrapPage } from './envelope';
import type { ApiResponse, Assignment, AssignmentSubmission, Pagination } from '../types';

export async function listCourseAssignments(
  courseId: string,
  params: { status?: string; page?: number; pageSize?: number } = {},
  signal?: AbortSignal
): Promise<{ assignments: Assignment[]; pagination?: Pagination }> {
  const res = await api.get<ApiResponse<Assignment[]>>(`/courses/${courseId}/assignments`, {
    params: { status: params.status, page: params.page, pageSize: params.pageSize ?? 100 },
    signal,
  });
  const { items, pagination } = unwrapPage<Assignment>(res);
  return { assignments: items, pagination };
}

export async function createAssignment(
  courseId: string,
  data: { title: string; instructions?: string; maxScore: number; dueDate?: string; status?: string }
): Promise<Assignment> {
  const res = await api.post<ApiResponse<{ assignment: Assignment }>>(`/courses/${courseId}/assignments`, data);
  return unwrap(res).assignment;
}

export async function getAssignment(
  id: string
): Promise<{ assignment: Assignment; submissions: AssignmentSubmission[] }> {
  const res = await api.get<ApiResponse<{ assignment: Assignment; submissions: AssignmentSubmission[] }>>(
    `/assignments/${id}`
  );
  return unwrap(res);
}

export async function submitAssignment(
  id: string,
  data: FormData,
  opts: { timeout?: number } = {}
): Promise<AssignmentSubmission> {
  const res = await api.post<ApiResponse<{ submission: AssignmentSubmission }>>(
    `/assignments/${id}/submit`,
    data,
    { timeout: opts.timeout ?? 120000 }
  );
  return unwrap(res).submission;
}

export async function gradeSubmission(
  submissionId: string,
  data: { score: number; feedback?: string }
): Promise<AssignmentSubmission> {
  const res = await api.post<ApiResponse<{ submission: AssignmentSubmission }>>(
    `/submissions/${submissionId}/grade`,
    data
  );
  return unwrap(res).submission;
}
