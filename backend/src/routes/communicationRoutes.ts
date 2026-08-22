// Communication routes - announcements and events (Member 6).
import { Router } from 'express';
import * as communicationController from '../controllers/communicationController';
import authenticate from '../middleware/auth';
import { requireAdmin, requireTeacher } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

// ---------------------------------------------------------------
// Announcements - all roles read (audience-filtered server-side)
// ---------------------------------------------------------------
router.get('/announcements', communicationController.listAnnouncements);
router.post('/announcements', requireTeacher, communicationController.createAnnouncement);
router.delete('/announcements/:id', requireAdmin, communicationController.deleteAnnouncement);

// ---------------------------------------------------------------
// Events - all roles read (audience-filtered server-side)
// ---------------------------------------------------------------
router.get('/events', communicationController.listEvents);
router.post('/events', requireTeacher, communicationController.createEvent);
router.delete('/events/:id', requireAdmin, communicationController.deleteEvent);

export default router;