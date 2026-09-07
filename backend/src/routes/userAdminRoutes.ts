// User admin routes - user management and CSV import (Member 6, Admin only).
import { Router } from 'express';
import * as userAdminController from '../controllers/userAdminController';
import authenticate from '../middleware/auth';
import { authenticatedLimiter, sensitiveLimiter } from '../middleware/rateLimit';
import { requireAdmin } from '../middleware/rbac';

const router = Router();
router.use(authenticate);
router.use(requireAdmin);
// Per-user budget (C3) - mounted after auth so req.user exists.
router.use(authenticatedLimiter);

router.get('/users', userAdminController.listUsers);
router.post('/users', userAdminController.createUser);
router.put('/users/:id', userAdminController.updateUser);
router.post('/users/:id/archive', userAdminController.archiveUser);
router.post('/users/:id/reset-password', sensitiveLimiter, userAdminController.resetPassword);
router.post('/users/import', sensitiveLimiter, userAdminController.importUsers);

export default router;