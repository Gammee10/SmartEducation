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

interface UserWithRelations {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: string;
  status: string;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
  student?: unknown;
  teacher?: unknown;
}

function signToken(userId: string): string {
  // Algorithm pinned so a tampered token cannot negotiate a weaker scheme.
  return jwt.sign({ sub: userId }, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

function sanitizeUser<T extends { passwordHash?: string }>(user: T | null): Omit<T, 'passwordHash'> | null {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
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

  const token = signToken(user.id);
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
  if (next === currentPassword) {
    throw new ValidationError('New password must be different from the current password');
  }

  const passwordHash = await bcrypt.hash(next, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

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

export { login, getCurrentUser, changePassword, signToken, sanitizeUser };