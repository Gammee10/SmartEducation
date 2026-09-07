// Communication routes - announcements and events (Member 6).
import { Router } from 'express';
import * as communicationController from '../controllers/communicationController';
import authenticate from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimit';
import { requireRole } from '../middleware/rbac';

const router = Router();
router.use(authenticate);
// Per-user budget (C3) - mounted after auth so req.user exists.
router.use(authenticatedLimiter);

// ---------------------------------------------------------------
// Announcements - all roles read (audience-filtered server-side).
// Creates: teachers and admins (service enforces). Deletes (M8): owner
// teacher or admin (service enforces ownership).
// ---------------------------------------------------------------
router.get('/announcements', communicationController.listAnnouncements);
router.post('/announcements', requireRole('TEACHER', 'ADMIN'), communicationController.createAnnouncement);
router.delete('/announcements/:id', requireRole('TEACHER', 'ADMIN'), communicationController.deleteAnnouncement);

// ---------------------------------------------------------------
// Events - all roles read (audience-filtered server-side)
// ---------------------------------------------------------------
router.get('/events', communicationController.listEvents);
router.post('/events', requireRole('TEACHER', 'ADMIN'), communicationController.createEvent);
router.delete('/events/:id', requireRole('TEACHER', 'ADMIN'), communicationController.deleteEvent);

export default router;