// Tests for the central error handler's Prisma error mapping.
import { test } from 'node:test';
import assert from 'node:assert';

const errorHandler = require('../src/middleware/errorHandler').default;

function mockResponse() {
  const res: any = { statusCode: 0, body: null, headers: {} };
  res.setHeader = (_k: string, v: string) => {
    res.headers[_k] = v;
  };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload: any) => {
    res.body = payload;
    return res;
  };
  return res;
}

function run(err: Error) {
  const res = mockResponse();
  errorHandler(err, { id: 'req-1', method: 'GET', originalUrl: '/x' } as any, res, (() => {}) as any);
  return res;
}

test('P2002 unique violations map to 409', () => {
  const err: any = new Error('duplicate');
  err.name = 'PrismaClientKnownRequestError';
  err.code = 'P2002';
  const res = run(err);
  assert.strictEqual(res.statusCode, 409);
  assert.strictEqual(res.body.success, false);
});

test('P2023 malformed identifiers map to 404, never 500', () => {
  const err: any = new Error('Inconsistent column data: Error creating UUID');
  err.name = 'PrismaClientKnownRequestError';
  err.code = 'P2023';
  const res = run(err);
  assert.strictEqual(res.statusCode, 404);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.message, 'Record not found');
});

test('P2003 foreign key failures map to 409 (C4/C1 defense-in-depth)', () => {
  const err: any = new Error('FK violation');
  err.name = 'PrismaClientKnownRequestError';
  err.code = 'P2003';
  const res = run(err);
  assert.strictEqual(res.statusCode, 409);
});

test('P2025 missing records map to 404', () => {
  const err: any = new Error('not found');
  err.name = 'PrismaClientKnownRequestError';
  err.code = 'P2025';
  const res = run(err);
  assert.strictEqual(res.statusCode, 404);
});
