// Tests for RBAC middleware.
import { test } from 'node:test';
import assert from 'node:assert';
import { requireRole, requireAdmin, requireStudent, requireTeacher } from '../src/middleware/rbac';

function mockReq(role: string | null) {
  return { user: role ? { role } : null } as any;
}

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

function mockNext() {
  let called = false;
  let error: Error | null = null;
  const next = (err?: Error) => {
    called = true;
    error = err || null;
  };
  (next as any).called = () => called;
  (next as any).error = () => error;
  return next as any;
}

test('requireRole allows matching role', () => {
  const req = mockReq('ADMIN');
  const res = mockRes();
  const next = mockNext();
  requireRole('ADMIN')(req, res, next);
  assert.strictEqual(next.called(), true);
  assert.strictEqual(next.error(), null);
});

test('requireRole allows any of multiple roles', () => {
  const req = mockReq('TEACHER');
  const res = mockRes();
  const next = mockNext();
  requireRole('ADMIN', 'TEACHER')(req, res, next);
  assert.strictEqual(next.called(), true);
  assert.strictEqual(next.error(), null);
});

test('requireRole rejects wrong role with 403', () => {
  const req = mockReq('STUDENT');
  const res = mockRes();
  const next = mockNext();
  requireRole('ADMIN')(req, res, next);
  assert.strictEqual(next.called(), true);
  assert.strictEqual(next.error().status, 403);
  assert.strictEqual(next.error().code, 'FORBIDDEN');
});

test('requireRole rejects missing user', () => {
  const req = mockReq(null);
  const res = mockRes();
  const next = mockNext();
  requireRole('ADMIN')(req, res, next);
  assert.strictEqual(next.called(), true);
  assert.strictEqual(next.error().status, 403);
});

test('requireAdmin allows admin only', () => {
  const adminReq = mockReq('ADMIN');
  const adminNext = mockNext();
  requireAdmin(adminReq, mockRes(), adminNext);
  assert.strictEqual(adminNext.error(), null);

  const studentReq = mockReq('STUDENT');
  const studentNext = mockNext();
  requireAdmin(studentReq, mockRes(), studentNext);
  assert.strictEqual(studentNext.error().status, 403);
});

test('requireStudent allows student only', () => {
  const studentReq = mockReq('STUDENT');
  const studentNext = mockNext();
  requireStudent(studentReq, mockRes(), studentNext);
  assert.strictEqual(studentNext.error(), null);

  const adminReq = mockReq('ADMIN');
  const adminNext = mockNext();
  requireStudent(adminReq, mockRes(), adminNext);
  assert.strictEqual(adminNext.error().status, 403);
});

test('requireTeacher allows teacher only', () => {
  const teacherReq = mockReq('TEACHER');
  const teacherNext = mockNext();
  requireTeacher(teacherReq, mockRes(), teacherNext);
  assert.strictEqual(teacherNext.error(), null);

  const studentReq = mockReq('STUDENT');
  const studentNext = mockNext();
  requireTeacher(studentReq, mockRes(), studentNext);
  assert.strictEqual(studentNext.error().status, 403);
});