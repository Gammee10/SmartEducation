// Auth service - login, JWT generation, current user, password change.
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';
import env from '../config/env';
import { UnauthorizedError, NotFoundError, ValidationError } from '../utils/errors';
import { writeAuditLog } from './auditService';

interface LoginInput {
  email: string;
  password: string;
  ipAddress?: string | null;
}

// M11: login attempts are auditable (email only - never passwords). Writes
// are best-effort so a broken audit table cannot lock every user out;
// brute-force log flooding is bounded by authLimiter (10 logins/15min/IP).
async function auditLoginAttempt(
  action: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE',
  userId: string | null,
  email: string,
  ipAddress?: string | null
): Promise<void> {
  try {
    await writeAuditLog({
      actorId: userId,
      action,
      entity: 'User',
      entityId: userId,
      metadata: { email },
      ipAddress,
    });
  } catch (err) {
    console.error('Login audit write failed:', err);
  }
}


function signToken(userId: string, tokenVersion = 0): string {
  // Algorithm pinned so a tampered token cannot negotiate a weaker scheme.
  // `tv` carries the session revocation counter (C2): the auth middleware
  // rejects tokens whose tv no longer matches the user row, so password
  // change/reset and archive/reactivate kill stolen sessions immediately.
  return jwt.sign({ sub: userId, tv: tokenVersion }, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

function sanitizeUser<T extends { passwordHash?: string; tokenVersion?: unknown }>(
  user: T | null
): Omit<T, 'passwordHash' | 'tokenVersion'> | null {
  if (!user) return null;
  const { passwordHash: _passwordHash, tokenVersion: _tokenVersion, ...safe } = user;
  return safe;
}

// bcrypt silently truncates at 72 bytes - a longer password would not
// actually protect the account, so reject it with a clear error (M12).
const MAX_PASSWORD_BYTES = 72;

function assertPasswordBytes(value: string, field = 'Password'): void {
  if (Buffer.byteLength(value, 'utf8') > MAX_PASSWORD_BYTES) {
    throw new ValidationError(`${field} must be at most ${MAX_PASSWORD_BYTES} bytes`);
  }
}

async function login({ email, password, ipAddress }: LoginInput) {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      student: true,
      teacher: true,
    },
  });

  if (!user) {
    await auditLoginAttempt('LOGIN_FAILURE', null, normalizedEmail, ipAddress);
    throw new UnauthorizedError('Invalid email or password');
  }
  if (user.status !== 'ACTIVE') {
    await auditLoginAttempt('LOGIN_FAILURE', user.id, normalizedEmail, ipAddress);
    throw new UnauthorizedError('Account is not active');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await auditLoginAttempt('LOGIN_FAILURE', user.id, normalizedEmail, ipAddress);
    throw new UnauthorizedError('Invalid email or password');
  }

  await auditLoginAttempt('LOGIN_SUCCESS', user.id, normalizedEmail, ipAddress);
  const token = signToken(user.id, (user as { tokenVersion?: number }).tokenVersion ?? 0);
  return { token, user: sanitizeUser(user) };
}

async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      student: true,
      teacher: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return sanitizeUser(user);
}

/**
 * Change the authenticated user's own password. Requires the current
 * password so a stolen session cannot silently take over the account.
 */
async function changePassword({
  userId,
  currentPassword,
  newPassword,
  ipAddress,
}: {
  userId: string;
  currentPassword: string;
  newPassword: string;
  ipAddress?: string | null;
}) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User not found');

  const valid = await bcrypt.compare(String(currentPassword || ''), user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  const next = String(newPassword || '');
  if (next.length < 8) {
    throw new ValidationError('New password must be at least 8 characters');
  }
  assertPasswordBytes(next, 'New password');
  if (next === currentPassword) {
    throw new ValidationError('New password must be different from the current password');
  }

  const passwordHash = await bcrypt.hash(next, 10);
  // Bump tokenVersion so every previously issued token dies with the old
  // password (C2). A stolen session on a shared school computer survives at
  // most until the legitimate user changes the password - which now
  // immediately invalidates it.
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, tokenVersion: { increment: 1 } },
  });

  await writeAuditLog({
    actorId: userId,
    action: 'PASSWORD_CHANGED',
    entity: 'User',
    entityId: userId,
    metadata: {},
    ipAddress,
  });

  return { changed: true };
}

export { login, getCurrentUser, changePassword, signToken, sanitizeUser, assertPasswordBytes, MAX_PASSWORD_BYTES };