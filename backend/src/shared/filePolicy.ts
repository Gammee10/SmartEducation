// Shared kernel: upload file policy. Single definition of the MIME
// allowlist + size limit, consumed by the route-level multer filter
// (assignmentRoutes) and the content-level magic-byte check
// (fileStorageService) so the two gates cannot drift.
import { ValidationError } from '../utils/errors';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB - documents only; content upload is URL-based

const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/zip',
]);

function assertFileAllowed(mimetype: string, size: number): void {
  if (!ALLOWED_MIME_TYPES.has(mimetype)) {
    throw new ValidationError('File type not allowed. Please upload a document, image, or archive.');
  }
  if (size > MAX_FILE_SIZE) {
    throw new ValidationError('File size exceeds the 20MB limit');
  }
}

export { MAX_FILE_SIZE, ALLOWED_MIME_TYPES, assertFileAllowed };
