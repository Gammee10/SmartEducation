// URL validation - allowlist http(s) schemes for any URL stored and later
// rendered as a link (content URLs, cover images). React does not sanitize
// href schemes, so javascript:/data: URLs would execute in the app origin.
import { ValidationError } from './errors';

export function assertHttpUrl(value: unknown, field = 'URL'): string {
  const raw = String(value ?? '').trim();
  if (!raw) {
    throw new ValidationError(`${field} is required`);
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ValidationError(`${field} must be a valid http(s) link`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new ValidationError(`${field} must be a valid http(s) link`);
  }
  return raw;
}

/** Optional URL: null/undefined passes through, non-empty values are validated. */
export function assertOptionalHttpUrl(value: unknown, field = 'URL'): string | null {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }
  return assertHttpUrl(value, field);
}
