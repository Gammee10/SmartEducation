// Optional error tracker hook (M16).
//
// Active only when SENTRY_DSN is set AND @sentry/node is installed - there
// is deliberately no hard dependency, so the pilot runs fine without an
// error tracker. To enable: `npm install @sentry/node --workspace backend`
// and set SENTRY_DSN. All capture paths are failure-safe and never break
// the request lifecycle.
import { createRequire } from 'module';

const load = createRequire(__filename);

let enabled = false;

export function initErrorTracker(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    const Sentry = load('@sentry/node');
    Sentry.init({ dsn, environment: process.env.NODE_ENV || 'development' });
    enabled = true;
  } catch {
    process.stderr.write('[warn] SENTRY_DSN is set but @sentry/node is not installed - error tracking disabled.\n');
  }
}

export function isErrorTrackerEnabled(): boolean {
  return enabled;
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return;
  try {
    load('@sentry/node').captureException(err, { extra: context });
  } catch {
    // Tracking must never break the request path.
  }
}
