// Rate limiting middleware - protects against brute-force and DoS.
import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

// Prefer the authenticated user id so authenticated traffic is limited per
// user even behind shared NATs; fall back to req.ip (which correctly
// resolves to the client when TRUST_PROXY is configured for the deployment).
function limiterKey(req: Request): string {
  const userId = (req as any).user?.id;
  return userId ? `user:${userId}` : req.ip || 'unknown';
}

// NOTE: the default store is in-memory, which resets on restart and does not
// work across multiple instances. For a single pilot instance this is fine;
// if the backend is ever scaled horizontally, swap to rate-limit-redis (or
// similar).

// General API limiter - generous ceiling that still stops runaway clients.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: limiterKey,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
    data: {},
  },
});

// Strict limiter for credential endpoints to slow brute-force attempts.
// IP-based on purpose: login requests have no authenticated user yet.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.',
    data: {},
  },
});