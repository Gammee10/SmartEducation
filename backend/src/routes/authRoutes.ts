// Auth routes.
import { Router } from 'express';
import * as authController from '../controllers/authController';
import authenticate from '../middleware/auth';
import { authLimiter, authenticatedLimiter, sensitiveLimiter } from '../middleware/rateLimit';

const router = Router();

// Strict limiter on the credential endpoint to slow brute-force attempts.
router.post('/login', authLimiter, authController.login);
router.get('/me', authenticate, authenticatedLimiter, authController.me);
// Credential-changing endpoint: per-user budget + strict sensitive budget (M9).
router.put('/password', authenticate, authenticatedLimiter, sensitiveLimiter, authController.changePassword);

export default router;