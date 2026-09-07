// Assignment routes - assignments, submissions, and grading.
import { Router } from 'express';
import multer from 'multer';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import * as assignmentController from '../controllers/assignmentController';
import authenticate from '../middleware/auth';
import { authenticatedLimiter, uploadLimiter } from '../middleware/rateLimit';
import { requireRole, requireStudent } from '../middleware/rbac';
import { ValidationError } from '../utils/errors';

const router = Router();

// Memory storage so uploads go straight to Cloudinary (no local disk).
const ALLOWED_MIME_TYPES = new Set([
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

const upload = multer({
  // M10: disk-backed uploads stream from temp files instead of buffering
  // full files (up to 20MB, base64-doubled) in RAM before the upload
  // semaphore even engages. Files are removed after the Cloudinary upload.
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(os.tmpdir(), 'smartedu-uploads');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const safe = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}-${safe}`);
    },
  }),
  // 20MB - submissions are documents; smaller buffers also reduce the memory
  // cost of the upload path (content upload is URL-based).
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new ValidationError('File type not allowed. Please upload a document, image, or archive.'));
      return;
    }
    cb(null, true);
  },
});

// All assignment routes require authentication
router.use(authenticate);
// Per-user budget (C3) - mounted after auth so req.user exists.
router.use(authenticatedLimiter);

// ---------------------------------------------------------------
// Assignments (top-level)
// ---------------------------------------------------------------
router.get('/assignments/:id', assignmentController.getAssignment);
// H6: ADMIN may intervene in teacher-owned assignments (audited override).
router.put('/assignments/:id', requireRole('TEACHER', 'ADMIN'), assignmentController.updateAssignment);
router.post('/assignments/:id/archive', requireRole('TEACHER', 'ADMIN'), assignmentController.archiveAssignment);

// ---------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------
router.post(
  '/assignments/:id/submit',
  requireStudent,
  // M10: per-IP upload throttle (60/15min) - submissions are normally
  // one-per-assignment, so this only bites bulk-abuse scripts.
  uploadLimiter,
  upload.single('file'),
  assignmentController.submitAssignment
);
router.get(
  '/assignments/:id/submissions',
  requireRole('TEACHER', 'ADMIN'),
  assignmentController.listSubmissions
);
router.post('/submissions/:id/grade', requireRole('TEACHER', 'ADMIN'), assignmentController.gradeSubmission);

export default router;

// Course-scoped assignment routes live in courseRoutes.ts:
//   GET  /api/courses/:id/assignments - list course assignments
//   POST /api/courses/:id/assignments - create assignment (Teacher)