// Auth routes.
import { Router } from 'express';
import * as authController from '../controllers/authController';
import authenticate from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';

const router = Router();

// Strict limiter on the credential endpoint to slow brute-force attempts.
router.post('/login', authLimiter, authController.login);
router.get('/me', authenticate, authController.me);
router.put('/password', authenticate, authController.changePassword);

export default router;