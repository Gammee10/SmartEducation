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

// ---------------------------------------------------------------
// LMS - Courses & Content
// ---------------------------------------------------------------

export type CourseStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
export type ContentType = 'VIDEO' | 'DOCUMENT' | 'PDF' | 'IMAGE' | 'LINK' | 'OTHER';

export interface Course {
  id: string;
  title: string;
  description?: string | null;
  subject: string;
  gradeLevel: string;
  status: CourseStatus;
  coverUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  teacher?: {
    id: string;
    user?: {
      id: string;
      fullName: string;
      email: string;
    };
  };
  enrollments?: CourseEnrollment[];
  _count?: {
    enrollments: number;
    content: number;
  };
}

export interface CourseEnrollment {
  id: string;
  courseId: string;
  studentId: string;
  status: string;
  createdAt: string;
  student?: {
    id: string;
    user?: {
      id: string;
      fullName: string;
      email: string;
    };
  };
}

export interface ContentItem {
  id: string;
  courseId: string;
  title: string;
  description?: string | null;
  type: ContentType;
  url: string;
  publicId?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  isArchived: boolean;
  createdAt: string;
  uploadedBy?: {
    id: string;
    fullName: string;
    email: string;
  };
}

// ---------------------------------------------------------------
// LMS - Quizzes, Attempts, Results (Member 4)
// ---------------------------------------------------------------

export type QuizStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
export type QuizQuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';
export type QuizAttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'TIME_EXPIRED';

export interface QuizOption {
  id: string;
  optionText: string;
  orderIndex: number;
  isCorrect?: boolean;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  type: QuizQuestionType;
  points: number;
  orderIndex: number;
  options: QuizOption[];
}

export interface Quiz {
  id: string;
  courseId: string;
  title: string;
  description?: string | null;
  timeLimit: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  status: QuizStatus;
  publishedAt?: string | null;
  createdAt: string;
  course?: {
    id: string;
    title: string;
    subject: string;
    gradeLevel: string;
  };
  questions?: QuizQuestion[];
  attempts?: QuizAttempt[];
  _count?: {
    questions: number;
    attempts: number;
  };
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  studentId: string;
  status: QuizAttemptStatus;
  startedAt: string;
  submittedAt?: string | null;
  expiresAt: string;
  score?: number | null;
  maxScore?: number | null;
  student?: {
    id: string;
    user?: {
      id: string;
      fullName: string;
      email: string;
    };
  };
}

export interface QuizAnswer {
  id: string;
  attemptId: string;
  questionId: string;
  optionId?: string | null;
  isCorrect?: boolean | null;
  pointsEarned?: number | null;
}

// ---------------------------------------------------------------
// LMS - Assignments, Submissions, Grading
// ---------------------------------------------------------------

export type AssignmentStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
export type SubmissionStatus = 'SUBMITTED' | 'GRADED';

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  instructions?: string | null;
  maxScore: number;
  dueDate?: string | null;
  status: AssignmentStatus;
  createdAt: string;
  updatedAt: string;
  course?: {
    id: string;
    title: string;
    subject: string;
    gradeLevel: string;
    teacher?: {
      id: string;
      user?: {
        id: string;
        fullName: string;
        email: string;
      };
    };
  };
  submissions?: AssignmentSubmission[];
  _count?: {
    submissions: number;
  };
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  content?: string | null;
  fileUrl?: string | null;
  publicId?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  status: SubmissionStatus;
  isLate: boolean;
  score?: number | null;
  feedback?: string | null;
  gradedById?: string | null;
  gradedAt?: string | null;
  submittedAt: string;
  student?: {
    id: string;
    user?: {
      id: string;
      fullName: string;
      email: string;
    };
  };
}
