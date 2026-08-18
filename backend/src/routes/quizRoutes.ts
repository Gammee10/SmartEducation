// Quiz routes - quizzes, questions, attempts, and results.
import { Router } from 'express';
import * as quizController from '../controllers/quizController';
import authenticate from '../middleware/auth';
import { requireStudent, requireTeacher } from '../middleware/rbac';

const router = Router();

// All quiz routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------
// Quizzes (top-level)
// ---------------------------------------------------------------
router.get('/quizzes/:id', quizController.getQuiz);
router.put('/quizzes/:id', requireTeacher, quizController.updateQuiz);
router.post('/quizzes/:id/archive', requireTeacher, quizController.archiveQuiz);

// ---------------------------------------------------------------
// Questions
// ---------------------------------------------------------------
router.post('/quizzes/:id/questions', requireTeacher, quizController.addQuestion);
router.put('/quizzes/questions/:questionId', requireTeacher, quizController.updateQuestion);
router.delete('/quizzes/questions/:questionId', requireTeacher, quizController.deleteQuestion);

// ---------------------------------------------------------------
// Attempts
// ---------------------------------------------------------------
router.post('/quizzes/:id/attempt', requireStudent, quizController.startAttempt);
router.post('/attempts/:id/submit', requireStudent, quizController.submitAttempt);
router.get('/attempts/:id', quizController.getAttempt);

// ---------------------------------------------------------------
// Results
// ---------------------------------------------------------------
router.get('/quizzes/:id/results', quizController.getQuizResults);

export default router;

// Course-scoped quiz routes live in courseRoutes.ts:
//   GET  /api/courses/:id/quizzes - list course quizzes
//   POST /api/courses/:id/quizzes - create quiz (Teacher)