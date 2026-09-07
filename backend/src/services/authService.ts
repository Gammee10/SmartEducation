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

async function login({ email, password }: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: {
      student: true,
      teacher: true,
    },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }
  if (user.status !== 'ACTIVE') {
    throw new UnauthorizedError('Account is not active');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

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