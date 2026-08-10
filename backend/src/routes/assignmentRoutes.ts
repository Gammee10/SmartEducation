// Assignment routes - assignments, submissions, and grading.
import { Router } from 'express';
import multer from 'multer';
import * as assignmentController from '../controllers/assignmentController';
import authenticate from '../middleware/auth';
import { requireStudent, requireTeacher } from '../middleware/rbac';

const router = Router();

// Memory storage so uploads go straight to Cloudinary (no local disk).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB - matches Cloudinary storage service limit
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