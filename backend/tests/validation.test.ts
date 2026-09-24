// Stage-4 validation matrix: representative invalid inputs must raise
// ValidationError (422), never a raw Prisma 500. Exercises the shared
// validation seam plus the per-domain enum asserts.
import { test } from 'node:test';
import assert from 'node:assert';

// notificationService constructs the shared prisma client; stub it so this
// pure-validation test never touches a real connection.
const prismaClientPath = require.resolve('../src/prisma/client');
require.cache[prismaClientPath] = {
  id: prismaClientPath,
  filename: prismaClientPath,
  loaded: true,
  exports: {},
} as any;

const { ValidationError } = require('../src/utils/errors');
const { assertValidDate, assertEmailFormat } = require('../src/shared/validation');
const { assertCourseStatus, assertContentType } = require('../src/services/courses/shared');
const { assertNotificationType } = require('../src/services/notificationService');

function isValidation422(fn: () => unknown) {
  try {
    fn();
    return false;
  } catch (err: any) {
    return err instanceof ValidationError && err.status === 422;
  }
}

test('validation: shared assertValidDate rejects garbage', () => {
  assert.ok(isValidation422(() => assertValidDate('not-a-date', 'Due date')));
  assert.ok(assertValidDate('2026-01-02', 'Due date') instanceof Date);
});

test('validation: shared email format', () => {
  assert.ok(isValidation422(() => assertEmailFormat('nope')));
  assert.strictEqual(assertEmailFormat(' A@B.CO '), 'a@b.co');
});

test('validation: course status enum', () => {
  assert.ok(isValidation422(() => assertCourseStatus('BOGUS')));
  assert.strictEqual(assertCourseStatus(undefined), 'DRAFT');
});

test('validation: content type enum', () => {
  assert.ok(isValidation422(() => assertContentType('BOGUS')));
  assert.strictEqual(assertContentType(undefined), 'OTHER');
});

test('validation: notification type enum', () => {
  assert.ok(isValidation422(() => assertNotificationType('BOGUS')));
  assert.strictEqual(assertNotificationType(undefined), 'GENERAL');
});
