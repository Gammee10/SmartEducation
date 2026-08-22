// Dashboard routes - admin/teacher/student dashboards + student summary.
import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController';
import authenticate from '../middleware/auth';
import { requireAdmin, requireTeacher, requireStudent } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

router.get('/dashboard/admin', requireAdmin, dashboardController.getAdminDashboard);
router.get('/dashboard/teacher', requireTeacher, dashboardController.getTeacherDashboard);
router.get('/dashboard/student', requireStudent, dashboardController.getStudentDashboard);
router.get('/students/:id/summary', dashboardController.getStudentSummary);

export default router;
