// Rate limiting middleware - protects against brute-force and DoS.
//
// Two layers (C3):
//   1. Edge (IP-keyed) `apiLimiter` in app.ts runs BEFORE auth, so it can
//      only ever key by IP. It is the coarse global guard.
//   2. Authenticated (user-keyed) `authenticatedLimiter` is mounted INSIDE
//      routers AFTER `authenticate`, so req.user exists and each user gets
//      their own budget even behind shared school NATs/proxies.
// The previous single-limiter design claimed per-user limiting but the key
// function ran before auth middleware, so req.user was always undefined and
// every client shared the IP bucket (dead code).
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';

// Edge key: client IP only. Correct only when TRUST_PROXY matches the
// deployment (see .env.example); otherwise all proxied clients share one
// bucket - env.ts logs a loud prod warning for that case.
function ipKey(req: Request): string {
  return req.ip ? `ip:${ipKeyGenerator(req.ip)}` : 'unknown';
}

// Authenticated key: per-user budget with IP fallback for requests that
// somehow reach it without a user (e.g. failed auth still passing through).
// ipKeyGenerator normalizes IPv6 addresses so /64 blocks share one bucket.
function userKey(req: Request): string {
  const userId = (req as any).user?.id;
  if (userId) return `user:${userId}`;
  return ipKey(req);
}

// NOTE: the default store is in-memory, which resets on restart and does not
// work across multiple instances. For a single pilot instance this is fine;
// if the backend is ever scaled horizontally, swap to rate-limit-redis (or
// similar).

// General API limiter - generous edge ceiling that still stops runaway
// clients. IP-keyed on purpose: it runs before auth in app.ts.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
    data: {},
  },
});

// Per-user limiter for authenticated traffic. Mount AFTER `authenticate`
// inside routers: `router.use(authenticate); router.use(authenticatedLimiter);`
export const authenticatedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKey,
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
  keyGenerator: ipKey,
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.',
    data: {},
  },
});

// Stricter budget for credential-changing and expensive endpoints (M9):
// password change/reset and the 5000-row CSV import. User-keyed when a
// session exists so one abusive user cannot lock out the whole school, with
// IP fallback for unauthenticated hits.
export const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKey,
  message: {
    success: false,
    message: 'Too many sensitive requests, please try again later.',
    data: {},
  },
});

// Per-IP upload throttle (M10): disk-backed uploads still cost temp disk,
// validation CPU, and outbound bandwidth per file. 60/15min is far above
// legitimate use (one submission per assignment) while bounding bulk abuse.
// IP-keyed on purpose: it runs before any per-user accounting on the
// multipart route.
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: {
    success: false,
    message: 'Too many uploads, please try again later.',
    data: {},
  },
});
