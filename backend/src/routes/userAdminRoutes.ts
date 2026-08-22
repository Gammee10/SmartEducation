// User admin routes - user management and CSV import (Member 6, Admin only).
import { Router } from 'express';
import * as userAdminController from '../controllers/userAdminController';
import authenticate from '../middleware/auth';
import { requireAdmin } from '../middleware/rbac';

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

router.get('/users', userAdminController.listUsers);
router.post('/users', userAdminController.createUser);
router.put('/users/:id', userAdminController.updateUser);
router.post('/users/:id/archive', userAdminController.archiveUser);
router.post('/users/import', userAdminController.importUsers);

export default router;