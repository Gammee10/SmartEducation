// Shared course helpers (REFACTORING_PLAN Stage 3). Enum validation used by
// the CRUD and content modules; keeping it here avoids module cross-imports.
import { ValidationError } from '../../utils/errors';

type CourseStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
type ContentTypeEnum = 'VIDEO' | 'DOCUMENT' | 'PDF' | 'IMAGE' | 'LINK' | 'OTHER';

// Known enum values - validated on write so bad inputs produce a 422 instead
// of a raw Prisma validation error (500).
const COURSE_STATUSES: CourseStatus[] = ['DRAFT', 'ACTIVE', 'ARCHIVED'];
const CONTENT_TYPES: ContentTypeEnum[] = ['VIDEO', 'DOCUMENT', 'PDF', 'IMAGE', 'LINK', 'OTHER'];

function assertCourseStatus(status: string | undefined): CourseStatus {
  if (status !== undefined && !COURSE_STATUSES.includes(status as CourseStatus)) {
    throw new ValidationError('Invalid course status');
  }
  return (status || 'DRAFT') as CourseStatus;
}

function assertContentType(type: string | undefined): ContentTypeEnum {
  if (type !== undefined && !CONTENT_TYPES.includes(type as ContentTypeEnum)) {
    throw new ValidationError('Invalid content type');
  }
  return (type || 'OTHER') as ContentTypeEnum;
}

export { COURSE_STATUSES, CONTENT_TYPES, assertCourseStatus, assertContentType };
export type { CourseStatus, ContentTypeEnum };
