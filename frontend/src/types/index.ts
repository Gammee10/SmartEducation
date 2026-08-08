// Shared frontend types.

export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: string;
  student?: {
    id: string;
    studentCode: string;
    gradeLevel: string;
    section: string | null;
  } | null;
  teacher?: {
    id: string;
    employeeCode: string;
    subject: string | null;
  } | null;
}

export interface BookCopy {
  id: string;
  copyNumber: string;
  status: string;
  condition?: string | null;
  location?: string | null;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn?: string | null;
  publisher?: string | null;
  publishedYear?: number | null;
  category?: string | null;
  description?: string | null;
  coverUrl?: string | null;
  copies?: BookCopy[];
}

export interface BorrowRequest {
  id: string;
  status: string;
  requestedAt: string;
  reason?: string | null;
  bookCopy?: {
    copyNumber: string;
    book?: {
      id: string;
      title: string;
      author: string;
      isbn?: string | null;
    };
  };
  student?: {
    user?: {
      id: string;
      fullName: string;
      email: string;
    };
  };
}

export interface Loan {
  id: string;
  status: string;
  issuedAt: string;
  dueDate: string;
  returnedAt?: string | null;
  bookCopy?: {
    copyNumber: string;
    book?: {
      id: string;
      title: string;
      author: string;
      isbn?: string | null;
    };
  };
  student?: {
    user?: {
      id: string;
      fullName: string;
      email: string;
    };
  };
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  pagination?: Pagination;
}