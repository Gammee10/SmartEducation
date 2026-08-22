// Timetable routes - timetable slot CRUD (Admin writes, all roles read).
import { Router } from 'express';
import * as timetableController from '../controllers/timetableController';
import authenticate from '../middleware/auth';
import { requireAdmin } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

// List timetable slots (all roles, role-filtered)
router.get('/timetable', timetableController.listTimetableSlots);

// Admin-only writes
router.post('/timetable', requireAdmin, timetableController.createTimetableSlot);
router.put('/timetable/:id', requireAdmin, timetableController.updateTimetableSlot);
router.delete('/timetable/:id', requireAdmin, timetableController.deleteTimetableSlot);

export default router;
