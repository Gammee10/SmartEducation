// Client-side URL safety (H11, defense in depth).
//
// The backend allowlists upload/cover URLs, but previously stored rows (or
// any future gap) could still carry `javascript:` links, which execute in
// the app origin and steal the localStorage token (pairs with H10). Never
// trust the wire: only http(s) - including same-origin relative paths -
// render as anchors. Everything else renders as inert text with a note.
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export function isSafeHttpUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const value = url.trim();
  if (!value) return false;
  // Protocol-relative URLs inherit the page scheme but point anywhere.
  if (value.startsWith('//')) return false;
  try {
    // Relative paths resolve against the app origin (same-origin = safe).
    const parsed = new URL(value, window.location.origin);
    if (value.startsWith('/')) return true;
    return ALLOWED_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}
