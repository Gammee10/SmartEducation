// Dashboard routes - admin/teacher/student dashboards + student summary.
import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController';
import authenticate from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimit';
import { requireAdmin, requireTeacher, requireStudent } from '../middleware/rbac';

const router = Router();
router.use(authenticate);
// Per-user budget (C3) - mounted after auth so req.user exists.
router.use(authenticatedLimiter);

router.get('/dashboard/admin', requireAdmin, dashboardController.getAdminDashboard);
router.get('/dashboard/teacher', requireTeacher, dashboardController.getTeacherDashboard);
router.get('/dashboard/student', requireStudent, dashboardController.getStudentDashboard);
router.get('/students/:id/summary', dashboardController.getStudentSummary);

export default router;
