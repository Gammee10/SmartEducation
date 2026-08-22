// Course routes - courses, enrollment, and content.
import { Router } from 'express';
import * as courseController from '../controllers/courseController';
import * as assignmentController from '../controllers/assignmentController';
import * as quizController from '../controllers/quizController';
import * as attendanceController from '../controllers/attendanceController';
import authenticate from '../middleware/auth';
import { requireAdmin, requireTeacher } from '../middleware/rbac';

const router = Router();

// All course routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------
// Courses
// ---------------------------------------------------------------
router.get('/', courseController.listCourses);
router.get('/:id', courseController.getCourse);

// Course management - Teacher only
router.post('/', requireTeacher, courseController.createCourse);
router.put('/:id', requireTeacher, courseController.updateCourse);

// ---------------------------------------------------------------
// Enrollment - Admin only
// ---------------------------------------------------------------
router.post('/:id/enroll', requireAdmin, courseController.enrollStudent);
router.post('/:id/unenroll', requireAdmin, courseController.unenrollStudent);

// ---------------------------------------------------------------
// Content
// ---------------------------------------------------------------
router.get('/:id/content', courseController.listContent);
router.post('/:courseId/content', requireTeacher, courseController.uploadContent);
router.post('/content/:id/archive', requireTeacher, courseController.archiveContent);

// ---------------------------------------------------------------
// Assignments (course-scoped)
// ---------------------------------------------------------------
router.get('/:id/assignments', assignmentController.listCourseAssignments);
router.post('/:id/assignments', requireTeacher, assignmentController.createAssignment);

// ---------------------------------------------------------------
// Quizzes (course-scoped)
// ---------------------------------------------------------------
router.get('/:id/quizzes', quizController.listCourseQuizzes);
router.post('/:id/quizzes', requireTeacher, quizController.createQuiz);

// ---------------------------------------------------------------
// Attendance (course-scoped)
// ---------------------------------------------------------------
router.get('/:id/attendance', attendanceController.listCourseAttendance);

export default router;

