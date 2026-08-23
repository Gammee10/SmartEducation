// Assignment routes - assignments, submissions, and grading.
import { Router } from 'express';
import multer from 'multer';
import * as assignmentController from '../controllers/assignmentController';
import authenticate from '../middleware/auth';
import { requireStudent, requireTeacher } from '../middleware/rbac';
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
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB - matches Cloudinary storage service limit
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

// ---------------------------------------------------------------
// Assignments (top-level)
// ---------------------------------------------------------------
router.get('/assignments/:id', assignmentController.getAssignment);
router.put('/assignments/:id', requireTeacher, assignmentController.updateAssignment);
router.post('/assignments/:id/archive', requireTeacher, assignmentController.archiveAssignment);

// ---------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------
router.post('/assignments/:id/submit', requireStudent, upload.single('file'), assignmentController.submitAssignment);
router.get('/assignments/:id/submissions', requireTeacher, assignmentController.listSubmissions);
router.post('/submissions/:id/grade', requireTeacher, assignmentController.gradeSubmission);

export default router;

// Course-scoped assignment routes live in courseRoutes.ts:
//   GET  /api/courses/:id/assignments - list course assignments
//   POST /api/courses/:id/assignments - create assignment (Teacher)