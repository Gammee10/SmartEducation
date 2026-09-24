// Shared assignment helpers (REFACTORING_PLAN Stage 3). Kept tiny so the
// CRUD, submission, and grading modules share the status enum, pagination
// shape, and user select without importing each other.
import { ValidationError } from '../../utils/errors';

type AssignmentStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';

const ASSIGNMENT_STATUSES: AssignmentStatus[] = ['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'];

const userInfoSelect = { id: true, fullName: true, email: true };

function assertStatusCode(status: string | undefined): AssignmentStatus {
  if (status !== undefined && !ASSIGNMENT_STATUSES.includes(status as AssignmentStatus)) {
    throw new ValidationError('Invalid assignment status');
  }
  return (status || 'DRAFT') as AssignmentStatus;
}

function buildPagination(total: number, page: number, pageSize: number) {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

export { ASSIGNMENT_STATUSES, userInfoSelect, assertStatusCode, buildPagination };
export type { AssignmentStatus };
