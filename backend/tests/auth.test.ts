// Tests for the auth service.
import { test } from 'node:test';
import assert from 'node:assert';

// Mock bcrypt and prisma before requiring authService
const mockCompare = async (password: string, hash: string) => password === 'correct-password';

// Mock bcryptjs
const bcryptPath = require.resolve('bcryptjs');
require.cache[bcryptPath] = {
  id: bcryptPath,
  filename: bcryptPath,
  loaded: true,
  exports: { compare: mockCompare, hash: async () => 'hashed' },
} as any;

// Mock jsonwebtoken
const jwtPath = require.resolve('jsonwebtoken');
require.cache[jwtPath] = {
  id: jwtPath,
  filename: jwtPath,
  loaded: true,
  exports: { sign: () => 'mock-jwt-token', verify: () => ({ sub: 'user-1' }) },
} as any;

// Mock prisma client
const mockUser = {
  id: 'user-1',
  email: 'admin@school.edu',
  passwordHash: 'hashed-password',
  fullName: 'Admin',
  role: 'ADMIN',
  status: 'ACTIVE',
  student: null,
  teacher: null,
};

const mockPrisma = {
  user: {
    findUnique: async ({ where }: { where: { email?: string; id?: string } }) => {
      if (where.email === 'admin@school.edu') return mockUser;
      if (where.id === 'user-1') return mockUser;
      return null;
    },
  },
};

const prismaClientPath = require.resolve('../src/prisma/client');
require.cache[prismaClientPath] = {
  id: prismaClientPath,
  filename: prismaClientPath,
  loaded: true,
  exports: mockPrisma,
} as any;

const authService = require('../src/services/authService');
const { UnauthorizedError, NotFoundError } = require('../src/utils/errors');

test('login returns token and sanitized user', async () => {
  const result = await authService.login({ email: 'admin@school.edu', password: 'correct-password' });
  assert.strictEqual(result.token, 'mock-jwt-token');
  assert.strictEqual(result.user.email, 'admin@school.edu');
  assert.strictEqual(result.user.passwordHash, undefined);
  assert.strictEqual(result.user.role, 'ADMIN');
});

test('login rejects invalid password', async () => {
  await assert.rejects(
    () => authService.login({ email: 'admin@school.edu', password: 'wrong-password' }),
    (err: any) => err instanceof UnauthorizedError && err.status === 401
  );
});

test('login rejects unknown email', async () => {
  await assert.rejects(
    () => authService.login({ email: 'nobody@school.edu', password: 'correct-password' }),
    (err: any) => err instanceof UnauthorizedError && err.status === 401
  );
});

test('login rejects missing credentials', async () => {
  await assert.rejects(
    () => authService.login({ email: '', password: '' }),
    (err: any) => err instanceof UnauthorizedError
  );
});

test('getCurrentUser returns sanitized user', async () => {
  const user = await authService.getCurrentUser('user-1');
  assert.strictEqual(user.id, 'user-1');
  assert.strictEqual(user.passwordHash, undefined);
});

test('getCurrentUser throws NotFoundError for missing user', async () => {
  await assert.rejects(
    () => authService.getCurrentUser('missing-user'),
    (err: any) => err instanceof NotFoundError && err.status === 404
  );
});

test('sanitizeUser removes password hash', () => {
  const safe = authService.sanitizeUser({ id: '1', passwordHash: 'secret', email: 'a@b.c' });
  assert.strictEqual(safe.passwordHash, undefined);
  assert.strictEqual(safe.email, 'a@b.c');
});