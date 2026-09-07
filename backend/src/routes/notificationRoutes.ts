// Notification routes - inbox, unread count, read state (Member 6).
import { Router } from 'express';
import * as notificationController from '../controllers/notificationController';
import authenticate from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimit';

const router = Router();
router.use(authenticate);
// Per-user budget (C3) - mounted after auth so req.user exists.
router.use(authenticatedLimiter);

// All routes are scoped to the authenticated user
router.get('/notifications', notificationController.listNotifications);
router.get('/notifications/unread-count', notificationController.getUnreadCount);
router.put('/notifications/read-all', notificationController.markAllNotificationsRead);
router.put('/notifications/:id/read', notificationController.markNotificationRead);

export default router;