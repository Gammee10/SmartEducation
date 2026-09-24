// Tests for the shared kernel access policy (Stage 1/2).
// Locks the teacher/admin/student course-access matrix outside of
// courseService so assignment/quiz can depend on the kernel.
import { test } from 'node:test';
import assert from 'node:assert';

const teacher: any = { id: 'teacher-1', userId: 'user-teacher-1' };
const teacher2: any = { id: 'teacher-2', userId: 'user-teacher-2' };
const student: any = { id: 'student-1', userId: 'user-student-1' };
const course: any = { id: 'course-1', teacherId: 'teacher-1', status: 'ACTIVE' };

let enrollment: any = { id: 'enr-1', status: 'ACTIVE' };

const mockPrisma: any = {
  course: { findUnique: async ({ where }: any) => (where.id === course.id ? { ...course } : null) },
  teacher: {
    findUnique: async ({ where }: any) =>
      [teacher, teacher2].find((t) => t.userId === where.userId) || null,
  },
  student: {
    findUnique: async ({ where }: any) => (where.userId === student.userId ? student : null),
  },
  courseEnrollment: { findUnique: async () => enrollment },
};

const prismaClientPath = require.resolve('../src/prisma/client');
require.cache[prismaClientPath] = {
  id: prismaClientPath,
  filename: prismaClientPath,
  loaded: true,
  exports: mockPrisma,
} as any;

const { requireCourseAccess, isAdminRole, adminOverrideMeta } = require('../src/shared/accessPolicy');

test('accessPolicy: admin is allowed', async () => {
  const result = await requireCourseAccess({ courseId: 'course-1', role: 'ADMIN', userId: 'user-admin-1' });
  assert.strictEqual(result.id, 'course-1');
});

test('accessPolicy: owning teacher is allowed', async () => {
  const result = await requireCourseAccess({ courseId: 'course-1', role: 'TEACHER', userId: teacher.userId });
  assert.strictEqual(result.teacherId, 'teacher-1');
});

test('accessPolicy: non-owning teacher is forbidden', async () => {
  await assert.rejects(
    () => requireCourseAccess({ courseId: 'course-1', role: 'TEACHER', userId: teacher2.userId }),
    /access/
  );
});

test('accessPolicy: active enrolled student is allowed', async () => {
  enrollment = { id: 'enr-1', status: 'ACTIVE' };
  const result = await requireCourseAccess({ courseId: 'course-1', role: 'STUDENT', userId: student.userId });
  assert.strictEqual(result.id, 'course-1');
});

test('accessPolicy: dropped student is forbidden', async () => {
  enrollment = { id: 'enr-1', status: 'DROPPED' };
  await assert.rejects(
    () => requireCourseAccess({ courseId: 'course-1', role: 'STUDENT', userId: student.userId }),
    /enrolled/
  );
});

test('accessPolicy: missing course is not found', async () => {
  await assert.rejects(
    () => requireCourseAccess({ courseId: 'missing', role: 'ADMIN', userId: 'user-admin-1' }),
    /Course not found/
  );
});

test('accessPolicy: admin override metadata is tagged for admins only', () => {
  assert.strictEqual(isAdminRole('ADMIN'), true);
  assert.strictEqual(isAdminRole('TEACHER'), false);
  assert.deepStrictEqual(adminOverrideMeta('ADMIN', 'teacher-1'), {
    adminOverride: true,
    ownerTeacherId: 'teacher-1',
  });
  assert.deepStrictEqual(adminOverrideMeta('TEACHER', 'teacher-1'), {});
});
