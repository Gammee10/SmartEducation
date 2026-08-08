// Auth service - login, JWT generation, current user.
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';
import env from '../config/env';
import { UnauthorizedError, NotFoundError } from '../utils/errors';

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
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] });
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

export { login, getCurrentUser, signToken, sanitizeUser };