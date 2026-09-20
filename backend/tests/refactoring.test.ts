// Stage-0 characterization tests for the refactoring plan (Tasks 2-3).
// These lock behavior BEFORE structural moves. They must pass on unmodified
// code and fail if any invariant in REFACTORING_PLAN.md section 8 is broken.
// Style follows the existing suite: mock Prisma via require.cache, require
// services after the mock is installed.
import { test } from 'node:test';
import assert from 'node:assert';

// ---------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------
const teacher: any = { id: 'teacher-1', userId: 'user-teacher-1' };
const student: any = { id: 'student-1', userId: 'user-student-1' };
const course: any = { id: 'course-1', teacherId: 'teacher-1', status: 'ACTIVE' };
const enrollment: any = { id: 'enr-1', courseId: 'course-1', studentId: 'student-1', status: 'ACTIVE' };

const quizWithKeys: any = {
  id: 'quiz-1',
  courseId: 'course-1',
  title: 'Q',
  status: 'PUBLISHED',
  course: { ...course, teacherId: 'teacher-1' },
  questions: [
    {
      id: 'q-1',
      prompt: 'P',
      type: 'SINGLE_CHOICE',
      points: 2,
      orderIndex: 0,
      options: [
        { id: 'o-1', optionText: 'A', isCorrect: false, orderIndex: 0 },
        { id: 'o-2', optionText: 'B', isCorrect: true, orderIndex: 1 },
      ],
    },
  ],
};

const calls: any = { audit: [], notification: [], notificationMany: [], txUsed: 0 };

function installMock(overrides: Record<string, any> = {}) {
  const base: Record<string, any> = {
    teacher: { findUnique: async ({ where }: any) => (where.userId === teacher.userId ? teacher : null) },
    student: { findUnique: async ({ where }: any) => (where.userId === student.userId || where.id === student.id ? student : null) },
    course: { findUnique: async ({ where }: any) => (where.id === course.id ? { ...course } : null) },
    courseEnrollment: {
      findUnique: async () => ({ ...enrollment }),
    },
    quiz: { findUnique: async ({ where }: any) => (where.id === quizWithKeys.id ? quizWithKeys : null) },
    quizAttempt: {
      findFirst: async () => null,
      findMany: async () => [],
      count: async () => 0,
      updateMany: async () => ({ count: 0 }),
      create: async ({ data }: any) => ({ id: 'attempt-new', ...data }),
    },
    auditLog: {
      create: async ({ data }: any) => {
        calls.audit.push(data);
        return { id: 'audit-1', ...data };
      },
    },
    notification: {
      create: async ({ data }: any) => {
        calls.notification.push(data);
        return { id: 'notif-1', ...data };
      },
      createMany: async ({ data }: any) => {
        calls.notificationMany.push(data);
        return { count: data.length };
      },
    },
    $transaction: async (fn: any) => {
      calls.txUsed += 1;
      const { $transaction: _omit, ...rest } = mock;
      void _omit;
      const tx = { ...rest, ...overrides.$tx };
      return typeof fn === 'function' ? fn(tx) : fn;
    },
  };
  const mock = { ...base, ...overrides };
  // Rebuild $transaction so tx sees the merged overrides
  mock.$transaction = base.$transaction;
  const prismaClientPath = require.resolve('../src/prisma/client');
  require.cache[prismaClientPath] = {
    id: prismaClientPath,
    filename: prismaClientPath,
    loaded: true,
    exports: mock,
  } as any;
  // Drop previously loaded service modules so they rebind to this mock
  for (const mod of ['../src/services/quizService', '../src/services/assignmentService', '../src/services/attendanceService', '../src/services/communicationService', '../src/services/libraryService', '../src/services/userAdminService', '../src/services/courseService', '../src/services/authService', '../src/services/auditService', '../src/services/notificationService']) {
    try {
      delete require.cache[require.resolve(mod)];
    } catch { /* not loaded yet */ }
  }
  calls.audit = [];
  calls.notification = [];
  calls.notificationMany = [];
  calls.txUsed = 0;
  return mock;
}

// ---------------------------------------------------------------
// R2: quiz answer secrecy for students
// ---------------------------------------------------------------
test('characterization: student quiz payload never contains isCorrect', async () => {
  installMock();
  const { getQuizDetails } = require('../src/services/quizService');
  const { quiz } = await getQuizDetails({ quizId: 'quiz-1', role: 'STUDENT', userId: student.userId });
  const serialized = JSON.stringify(quiz);
  assert.ok(!serialized.includes('isCorrect'), 'student payload leaked isCorrect');
  assert.strictEqual(quiz.questions[0].options.length, 2);
});

// ---------------------------------------------------------------
// R2: maxAttempts enforced
// ---------------------------------------------------------------
test('characterization: startAttempt enforces maxAttempts', async () => {
  installMock({
    quiz: {
      findUnique: async () => ({ ...quizWithKeys, maxAttempts: 1, timeLimit: 10 }),
    },
    quizAttempt: {
      findFirst: async () => null,
      findMany: async () => [],
      count: async () => 1,
      updateMany: async () => ({ count: 0 }),
      create: async () => {
        throw new Error('must not create beyond the limit');
      },
    },
  });
  const { startAttempt } = require('../src/services/quizService');
  await assert.rejects(() => startAttempt({ actorId: student.userId, quizId: 'quiz-1' }), /attempt/);
});

// ---------------------------------------------------------------
// R3: grading emits GRADE notification + audit atomically
// ---------------------------------------------------------------
test('characterization: gradeSubmission audits and notifies inside one transaction', async () => {
  const submission: any = {
    id: 'sub-1',
    assignmentId: 'assign-1',
    score: null,
    assignment: { id: 'assign-1', courseId: 'course-1', maxScore: 100 },
    student: { id: 'student-1', user: { id: 'user-student-1' } },
  };
  installMock({
    assignmentSubmission: { findUnique: async () => submission },
    $tx: {
      assignmentSubmission: {
        update: async ({ data }: any) => ({ ...submission, ...data }),
      },
    },
  });
  const { gradeSubmission } = require('../src/services/assignmentService');
  await gradeSubmission({ actorId: teacher.userId, actorRole: 'TEACHER', submissionId: 'sub-1', data: { score: 80 } });
  assert.strictEqual(calls.txUsed, 1);
  assert.strictEqual(calls.audit.length, 1);
  assert.strictEqual(calls.audit[0].action, 'SUBMISSION_GRADED');
  assert.strictEqual(calls.notification.length, 1);
  assert.strictEqual(calls.notification[0].type, 'GRADE');
});

// ---------------------------------------------------------------
// R3: attendance correction audit carries before/after
// ---------------------------------------------------------------
test('characterization: correctAttendance audit preserves before/after snapshots', async () => {
  const existing: any = { id: 'att-1', status: 'PRESENT', comment: null, course };
  installMock({
    attendance: {
      findUnique: async () => existing,
      update: async ({ data }: any) => ({ ...existing, ...data }),
    },
    user: { findUnique: async () => ({ id: teacher.userId, role: 'TEACHER' }) },
  });
  const { correctAttendance } = require('../src/services/attendanceService');
  await correctAttendance({ actorId: teacher.userId, attendanceId: 'att-1', data: { status: 'ABSENT' } });
  assert.strictEqual(calls.audit.length, 1);
  assert.strictEqual(calls.audit[0].action, 'ATTENDANCE_CORRECTED');
  assert.deepStrictEqual(calls.audit[0].metadata.before, { status: 'PRESENT', comment: null });
  assert.strictEqual(calls.audit[0].metadata.after.status, 'ABSENT');
});

// ---------------------------------------------------------------
// R4: announcement fan-out count matches audience
// ---------------------------------------------------------------
test('characterization: announcement fan-out notifies the whole audience', async () => {
  const audience = [{ id: 'u-1' }, { id: 'u-2' }, { id: 'u-3' }];
  installMock({
    $tx: {
      announcement: { create: async ({ data }: any) => ({ id: 'ann-1', ...data }) },
      user: { findMany: async () => audience },
    },
  });
  const { createAnnouncement } = require('../src/services/communicationService');
  await createAnnouncement({ actorId: 'admin-1', actorRole: 'ADMIN', data: { title: 'T', body: 'B', audience: 'ALL' } });
  const totalNotified = calls.notificationMany.flat().length;
  assert.strictEqual(totalNotified, audience.length);
  assert.strictEqual(calls.audit[0].action, 'ANNOUNCEMENT_PUBLISHED');
  assert.strictEqual(calls.audit[0].metadata.notified, audience.length);
});

// ---------------------------------------------------------------
// Library: atomic copy claim (lost race -> Conflict, no orphan loan)
// ---------------------------------------------------------------
test('characterization: approving a claimed copy fails instead of double-loaning', async () => {
  const request: any = {
    id: 'req-1',
    status: 'PENDING',
    studentId: 'student-1',
    bookCopyId: 'copy-1',
    bookCopy: { status: 'BORROWED' },
  };
  installMock({
    libraryBorrowRequest: { findUnique: async () => request },
    $tx: {
      libraryBookCopy: { updateMany: async () => ({ count: 0 }) },
      libraryBorrowRequest: { update: async () => request },
      libraryLoan: {
        create: async () => {
          throw new Error('must not create a loan when the copy claim loses');
        },
      },
    },
  });
  const { decideBorrowRequest } = require('../src/services/libraryService');
  const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  await assert.rejects(
    () => decideBorrowRequest({ actorId: 'admin-1', requestId: 'req-1', decision: 'APPROVED', dueDate: future }),
    /no longer available/
  );
});

// ---------------------------------------------------------------
// CSV import: per-row errors recorded, valid rows succeed
// ---------------------------------------------------------------
test('characterization: CSV import reports per-row errors without aborting', async () => {
  const created: any[] = [];
  const csv = 'fullName,email,role,gradeLevel\ngood user,good@example.com,STUDENT,Grade 9\nbad user,not-an-email,STUDENT,Grade 9';
  installMock({
    importBatch: {
      create: async ({ data }: any) => ({ id: 'batch-1', ...data }),
      update: async ({ data }: any) => ({ id: 'batch-1', ...data }),
    },
    importError: { create: async ({ data }: any) => data },
    user: {
      findUnique: async () => null,
      create: async ({ data }: any) => {
        created.push(data);
        return { id: `user-${created.length}`, ...data };
      },
    },
    student: {
      create: async ({ data }: any) => ({ id: 'student-x', ...data }),
      count: async () => 0,
      findUnique: async () => null,
    },
    teacher: { create: async ({ data }: any) => ({ id: 'teacher-x', ...data }) },
  });
  const { importUsersCsv } = require('../src/services/userAdminService');
  const result = await importUsersCsv({ actorId: 'admin-1', csv });
  assert.strictEqual(created.length, 1);
  assert.ok((result.errors?.length || 0) >= 1, 'expected at least one per-row error');
  assert.ok(result.batch || result.successCount !== undefined || result.success !== undefined, 'expected a batch summary');
});

// ---------------------------------------------------------------
// R1: sanitize + password-byte guards
// ---------------------------------------------------------------
test('characterization: sanitizeUser strips secrets; long passwords rejected', async () => {
  installMock();
  const { sanitizeUser, assertPasswordBytes } = require('../src/services/authService');
  const safe: any = sanitizeUser({ id: 'u-1', email: 'a@b.c', passwordHash: 'secret', tokenVersion: 3 });
  assert.strictEqual(safe.passwordHash, undefined);
  assert.strictEqual(safe.tokenVersion, undefined);
  assert.throws(() => assertPasswordBytes('x'.repeat(73)), /72 bytes/);
});

// ---------------------------------------------------------------
// Contract: standardized envelope shape
// ---------------------------------------------------------------
test('contract: response helpers keep the {success,message,data} envelope', async () => {
  const { success, created, paginated } = require('../src/utils/response');
  const seen: any[] = [];
  const res: any = {
    status: (code: number) => ({ json: (body: any) => { seen.push({ code, body }); return body; } }),
  };
  success(res, { a: 1 });
  created(res, { a: 1 });
  paginated(res, [{ a: 1 }], { page: 1, pageSize: 20, total: 1, totalPages: 1 });
  assert.strictEqual(seen[0].code, 200);
  assert.strictEqual(seen[1].code, 201);
  for (const { body } of seen) {
    assert.strictEqual(body.success, true);
    assert.ok(typeof body.message === 'string');
    assert.ok('data' in body);
  }
  assert.deepStrictEqual(Object.keys(seen[2].body.pagination).sort(), ['page', 'pageSize', 'total', 'totalPages']);
});

// ---------------------------------------------------------------
// D1/R8: getCourse shape lock (student roster privacy)
// ---------------------------------------------------------------
test('contract: getCourse hides the roster from students but not staff', async () => {
  let includeSeen: any = null;
  installMock({
    course: {
      findUnique: async ({ include }: any) => {
        includeSeen = include;
        return { id: 'course-1', teacherId: 'teacher-1', status: 'ACTIVE' };
      },
    },
  });
  const { getCourse } = require('../src/services/courseService');
  await getCourse({ courseId: 'course-1', role: 'STUDENT', userId: student.userId });
  assert.ok(!('enrollments' in (includeSeen || {})), 'student include must not fetch enrollments');
  await getCourse({ courseId: 'course-1', role: 'TEACHER', userId: teacher.userId });
  assert.ok('enrollments' in (includeSeen || {}), 'staff include must fetch enrollments');
});
