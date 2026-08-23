// Rate limiting middleware - protects against brute-force and DoS.
import rateLimit from 'express-rate-limit';

// General API limiter - generous ceiling that still stops runaway clients.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
    data: {},
  },
});

// Strict limiter for credential endpoints to slow brute-force attempts.
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