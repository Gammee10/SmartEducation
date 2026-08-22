// Attendance routes - attendance marking, corrections, and history.
import { Router } from 'express';
import * as attendanceController from '../controllers/attendanceController';
import authenticate from '../middleware/auth';
import { requireTeacher } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

// Mark/upsert attendance (Teacher)
router.post('/attendance/upsert', requireTeacher, attendanceController.upsertAttendance);

// Correct an attendance record (Teacher owner or Admin)
router.put('/attendance/:id', attendanceController.correctAttendance);

// Student attendance history (own / teacher / admin)
router.get('/students/:id/attendance', attendanceController.listStudentAttendance);

export default router;
