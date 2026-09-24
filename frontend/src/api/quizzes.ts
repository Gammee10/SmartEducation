// Quizzes API - quizzes, questions, attempts, and results.
import api from './client';
import { unwrap, unwrapPage } from './envelope';
import type { ApiResponse, Pagination, Quiz, QuizAttempt, QuizQuestion } from '../types';

export async function listCourseQuizzes(
  courseId: string,
  params: { page?: number; pageSize?: number } = {},
  signal?: AbortSignal
): Promise<{ quizzes: Quiz[]; pagination?: Pagination }> {
  const res = await api.get<ApiResponse<Quiz[]>>(`/courses/${courseId}/quizzes`, {
    params: { page: params.page, pageSize: params.pageSize ?? 100 },
    signal,
  });
  const { items, pagination } = unwrapPage<Quiz>(res);
  return { quizzes: items, pagination };
}

export async function createQuiz(
  courseId: string,
  data: {
    title: string;
    description?: string;
    timeLimit?: number;
    maxAttempts?: number;
    shuffleQuestions?: boolean;
    shuffleOptions?: boolean;
    status?: string;
    questions?: Array<Record<string, unknown>>;
  }
): Promise<Quiz> {
  const res = await api.post<ApiResponse<{ quiz: Quiz }>>(`/courses/${courseId}/quizzes`, data);
  return unwrap(res).quiz;
}

export async function getQuiz(id: string): Promise<{ quiz: Quiz; attempts?: QuizAttempt[] }> {
  const res = await api.get<ApiResponse<{ quiz: Quiz; attempts?: QuizAttempt[] }>>(`/quizzes/${id}`);
  return unwrap(res);
}

export async function updateQuiz(id: string, data: object): Promise<Quiz> {
  const res = await api.put<ApiResponse<{ quiz: Quiz }>>(`/quizzes/${id}`, data);
  return unwrap(res).quiz;
}

export async function addQuestion(quizId: string, data: object): Promise<QuizQuestion> {
  const res = await api.post<ApiResponse<{ question: QuizQuestion }>>(`/quizzes/${quizId}/questions`, data);
  return unwrap(res).question;
}

export async function getQuizResults(id: string): Promise<{ quiz: Quiz; attempts: QuizAttempt[] }> {
  const res = await api.get<ApiResponse<{ quiz: Quiz; attempts: QuizAttempt[] }>>(`/quizzes/${id}/results`);
  return unwrap(res);
}

export async function startAttempt(
  quizId: string
): Promise<{ attempt: QuizAttempt; quiz: Quiz & { questions: QuizQuestion[] } }> {
  const res = await api.post<ApiResponse<{ attempt: QuizAttempt; quiz: Quiz & { questions: QuizQuestion[] } }>>(
    `/quizzes/${quizId}/attempt`
  );
  return unwrap(res);
}

export async function submitAttempt(
  attemptId: string,
  answers: Array<{ questionId: string; optionIds?: string[] | string }>
): Promise<{ attempt: QuizAttempt; score: number; maxScore: number; status: string; expired: boolean }> {
  const res = await api.post<
    ApiResponse<{ attempt: QuizAttempt; score: number; maxScore: number; status: string; expired: boolean }>
  >(`/attempts/${attemptId}/submit`, { answers });
  return unwrap(res);
}
