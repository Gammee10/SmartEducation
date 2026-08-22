// Tests for the dashboard service - admin/teacher/student aggregation.
import { test } from 'node:test';
import assert from 'node:assert';

const mockAdmin: any = { id: 'user-admin-1', role: 'ADMIN' };
const mockTeacher: any = { id: 'teacher-1', userId: 'user-teacher-1', employeeCode: 'TCH-001', subject: 'Mathematics' };
const mockStudent: any = { id: 'student-1', userId: 'user-student-1', studentCode: 'STU-001', gradeLevel: 'Grade 9', section: 'A' };
const mockCourse: any = { id: 'course-1', title: 'Math Grade 9', subject: 'Mathematics', gradeLevel: 'Grade 9', teacherId: 'teacher-1', status: 'ACTIVE' };
const mockEnrollment: any = { id: 'enr-1', courseId: 'course-1', studentId: 'student-1', status: 'ACTIVE', enrolledById: 'user-admin-1' };
const mockAttendance: any = { id: 'att-1', studentId: 'student-1', courseId: 'course-1', date: new Date('2026-08-20'), status: 'PRESENT', markedById: 'user-teacher-1' };
const mockSubmission: any = { id: 'sub-1', assignmentId: 'assign-1', studentId: 'student-1', status: 'GRADED', score: 8, assignment: { courseId: 'course-1' } };
const mockAttempt: any = { id: 'attempt-1', quizId: 'quiz-1', studentId: 'student-1', status: 'SUBMITTED', score: 4, maxScore: 5 };

const state: any = {
  users: [mockAdmin],
  teachers: [mockTeacher],
  students: [mockStudent],
  courses: [mockCourse],
  enrollments: [mockEnrollment],
  attendances: [mockAttendance],
  assignmentSubmissions: [mockSubmission],
  quizAttempts: [mockAttempt],
};

const mockPrisma = {
  user: { findUnique: async ({ where }: any) => state.users.find((u: any) => u.id === where.id) || null },
  course: {
    count: async ({ where }: any) => state.courses.filter((c: any) => !where?.status?.not || c.status !== where.status.not).length,
    findMany: async ({ where }: any) => state.courses.filter((c: any) => c.teacherId === where?.teacherId).map((c: any) => ({ ...c, _count: { enrollments: 1, assignments: 1, quizzes: 1 } })),
  },
  student: {
    findUnique: async ({ where }: any) => state.students.find((s: any) => s.userId === where.userId) || null,
    count: async () => state.students.length,
  },
  teacher: {
    findUnique: async ({ where }: any) => state.teachers.find((t: any) => t.userId === where.userId) || null,
    count: async () => state.teachers.length,
  },
  attendance: {
    count: async ({ where }: any = {}) => {
      let result = state.attendances;
      if (where?.studentId) result = result.filter((a: any) => a.studentId === where.studentId);
      if (where?.status?.in) result = result.filter((a: any) => where.status.in.includes(a.status));
      return result.length;
    },
  },
  assignment: { count: async () => 1 },
  quiz: { count: async () => 1 },
  assignmentSubmission: {
    findMany: async ({ where }: any) => {
      let result = state.assignmentSubmissions;
      if (where?.studentId) result = result.filter((s: any) => s.studentId === where.studentId);
      if (where?.status) result = result.filter((s: any) => s.status === where.status);
      return result;
    },
  },
  quizAttempt: {
    findMany: async ({ where }: any) => {
      let result = state.quizAttempts;
      if (where?.studentId) result = result.filter((a: any) => a.studentId === where.studentId);
      if (where?.status) result = result.filter((a: any) => a.status === where.status);
      return result;
    },
  },
  courseEnrollment: {
    count: async ({ where }: any) => state.enrollments.filter((e: any) => where?.courseId?.in?.includes(e.courseId)).length,
    findMany: async ({ where }: any) => state.enrollments.filter((e: any) => e.studentId === where?.studentId).map((e: any) => ({ ...e, course: state.courses.find((c: any) => c.id === e.courseId) })),
  },
};

const prismaClientPath = require.resolve('../src/prisma/client');
require.cache[prismaClientPath] = { id: prismaClientPath, filename: prismaClientPath, loaded: true, exports: mockPrisma } as any;

const dashboardService = require('../src/services/dashboardService');
const { ForbiddenError, NotFoundError } = require('../src/utils/errors');

test('getAdminDashboard returns aggregate stats', async () => {
  const result = await dashboardService.getAdminDashboard({ userId: 'user-admin-1' });
  assert.strictEqual(result.stats.courses, 1);
  assert.strictEqual(result.stats.students, 1);
  assert.strictEqual(result.stats.teachers, 1);
  assert.strictEqual(result.stats.attendanceRate, 100);
  assert.strictEqual(result.stats.avgAssignmentScore, 8);
  assert.strictEqual(result.stats.avgQuizScore, 80);
});

test('getAdminDashboard rejects non-admin', async () => {
  await assert.rejects(
    dashboardService.getAdminDashboard({ userId: 'user-teacher-1' }),
    ForbiddenError
  );
});

test('getTeacherDashboard returns teacher stats', async () => {
  const result = await dashboardService.getTeacherDashboard({ userId: 'user-teacher-1' });
  assert.strictEqual(result.stats.courses, 1);
  assert.strictEqual(result.stats.students, 1);
  assert.strictEqual(result.stats.quizzes, 1);
});

test('getStudentDashboard returns student stats', async () => {
  const result = await dashboardService.getStudentDashboard({ userId: 'user-student-1' });
  assert.strictEqual(result.stats.enrollments, 1);
  assert.strictEqual(result.stats.attendanceRate, 100);
  assert.strictEqual(result.stats.avgAssignmentScore, 8);
  assert.strictEqual(result.stats.avgQuizScore, 80);
});

