// Library API - catalog, borrow requests, and loans.
import api from './client';
import { unwrap, unwrapPage } from './envelope';
import type { ApiResponse, Book, BorrowRequest, Loan, Pagination } from '../types';

export async function listBooks(
  params: { search?: string; category?: string; page?: number; pageSize?: number } = {},
  signal?: AbortSignal
): Promise<{ books: Book[]; pagination?: Pagination }> {
  const res = await api.get<ApiResponse<Book[]>>('/library/books', {
    params: { search: params.search, category: params.category, page: params.page, pageSize: params.pageSize ?? 20 },
    signal,
  });
  const { items, pagination } = unwrapPage<Book>(res);
  return { books: items, pagination };
}

export async function getBook(id: string): Promise<Book> {
  const res = await api.get<ApiResponse<{ book: Book }>>(`/library/books/${id}`);
  return unwrap(res).book;
}

export async function createBook(data: object): Promise<Book> {
  const res = await api.post<ApiResponse<{ book: Book }>>('/library/books', data);
  return unwrap(res).book;
}

export async function updateBook(id: string, data: object): Promise<Book> {
  const res = await api.put<ApiResponse<{ book: Book }>>(`/library/books/${id}`, data);
  return unwrap(res).book;
}

export async function addCopies(bookId: string, count: number): Promise<{ count: number }> {
  const res = await api.post<ApiResponse<{ count: number }>>(`/library/books/${bookId}/copies`, { count });
  return unwrap(res);
}

export async function createBorrowRequest(bookCopyId: string, reason?: string): Promise<BorrowRequest> {
  const res = await api.post<ApiResponse<{ request: BorrowRequest }>>('/library/requests', { bookCopyId, reason });
  return unwrap(res).request;
}

export async function listBorrowRequests(
  params: { status?: string; page?: number; pageSize?: number } = {},
  signal?: AbortSignal
): Promise<{ requests: BorrowRequest[]; pagination?: Pagination }> {
  const res = await api.get<ApiResponse<BorrowRequest[]>>('/library/requests', {
    params: { status: params.status, page: params.page, pageSize: params.pageSize ?? 100 },
    signal,
  });
  const { items, pagination } = unwrapPage<BorrowRequest>(res);
  return { requests: items, pagination };
}

export async function listMyBorrowRequests(
  params: { page?: number; pageSize?: number } = {},
  signal?: AbortSignal
): Promise<{ requests: BorrowRequest[]; pagination?: Pagination }> {
  const res = await api.get<ApiResponse<BorrowRequest[]>>('/library/requests/mine', {
    params: { page: params.page, pageSize: params.pageSize ?? 50 },
    signal,
  });
  const { items, pagination } = unwrapPage<BorrowRequest>(res);
  return { requests: items, pagination };
}

export async function decideBorrowRequest(
  requestId: string,
  body: { decision: string; reason?: string; dueDate?: string }
): Promise<void> {
  await api.post(`/library/requests/${requestId}/decide`, body);
}

export async function listLoans(
  params: { status?: string; page?: number; pageSize?: number } = {},
  signal?: AbortSignal
): Promise<{ loans: Loan[]; pagination?: Pagination }> {
  const res = await api.get<ApiResponse<Loan[]>>('/library/loans', {
    params: { status: params.status, page: params.page, pageSize: params.pageSize ?? 100 },
    signal,
  });
  const { items, pagination } = unwrapPage<Loan>(res);
  return { loans: items, pagination };
}

export async function listMyLoans(
  params: { page?: number; pageSize?: number } = {},
  signal?: AbortSignal
): Promise<{ loans: Loan[]; pagination?: Pagination }> {
  const res = await api.get<ApiResponse<Loan[]>>('/library/loans/mine', {
    params: { page: params.page, pageSize: params.pageSize ?? 50 },
    signal,
  });
  const { items, pagination } = unwrapPage<Loan>(res);
  return { loans: items, pagination };
}

export async function returnLoan(loanId: string, notes?: string, condition?: string): Promise<Loan> {
  const res = await api.post<ApiResponse<{ loan: Loan }>>(`/library/loans/${loanId}/return`, { notes, condition });
  return unwrap(res).loan;
}
