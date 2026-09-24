// Shared kernel: user sanitization. Moved verbatim from authService so
// user-admin shares it without importing auth internals. Never returns
// passwordHash or tokenVersion (C2 session-revocation counter).
function sanitizeUser<T extends { passwordHash?: string; tokenVersion?: unknown }>(
  user: T | null | undefined
): Omit<T, 'passwordHash' | 'tokenVersion'> | null {
  if (!user) return null;
  const { passwordHash: _passwordHash, tokenVersion: _tokenVersion, ...safe } = user;
  return safe;
}

export { sanitizeUser };
