// Tests for shared response and error helpers.
import { test } from 'node:test';
import assert from 'node:assert';
import { success, created, paginated } from '../src/utils/response';
import {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError,
} from '../src/utils/errors';

function mockRes() {
  const res: any = {};
  res.status = function (code: number) {
    res.statusCode = code;
    return this;
  };
  res.json = function (body: unknown) {
    res.body = body;
    return this;
  };
  return res;
}

test('success helper returns standard shape', () => {
  const res = mockRes();
  const result = success(res, { id: 1 }, 'Done');
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, {
    success: true,
    message: 'Done',
    data: { id: 1 },
  });
});

test('created helper returns 201', () => {
  const res = mockRes();
  created(res, { id: 1 }, 'Created');
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.success, true);
});

test('paginated helper includes pagination metadata', () => {
  const res = mockRes();
  paginated(res, [1, 2], { page: 1, total: 2 } as never, 'List');
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body.pagination, { page: 1, total: 2 });
  assert.deepStrictEqual(res.body.data, [1, 2]);
});

test('AppError has correct defaults', () => {
  const err = new AppError('Bad request');
  assert.strictEqual(err.status, 400);
  assert.strictEqual(err.code, 'BAD_REQUEST');
  assert.strictEqual(err.isOperational, true);
});

test('NotFoundError has 404 status', () => {
  const err = new NotFoundError();
  assert.strictEqual(err.status, 404);
  assert.strictEqual(err.code, 'NOT_FOUND');
});

test('UnauthorizedError has 401 status', () => {
  const err = new UnauthorizedError();
  assert.strictEqual(err.status, 401);
  assert.strictEqual(err.code, 'UNAUTHORIZED');
});

test('ForbiddenError has 403 status', () => {
  const err = new ForbiddenError();
  assert.strictEqual(err.status, 403);
  assert.strictEqual(err.code, 'FORBIDDEN');
});

test('ValidationError has 422 status and details', () => {
  const err = new ValidationError('Invalid', { field: 'email' });
  assert.strictEqual(err.status, 422);
  assert.deepStrictEqual(err.details, { field: 'email' });
});

test('ConflictError has 409 status', () => {
  const err = new ConflictError();
  assert.strictEqual(err.status, 409);
  assert.strictEqual(err.code, 'CONFLICT');
});