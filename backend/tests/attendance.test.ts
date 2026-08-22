// Tests for the attendance service - marking, corrections, and history.
import { test } from 'node:test';
import assert from 'node:assert';

const mockTeacher: any = { id: 'teacher-1', userId: 'user-teacher-1', employeeCode: 'TCH-001', subject: 'Mathematics' };
const mockTeacher2: any = { id: 'teacher-2', userId: 'user-teacher-2', employeeCode: 'TCH-002', subject: 'Physics' };
const mockStudent: any = { id: 'student-1', userId: 'user-student-1', studentCode: 'STU-001', gradeLevel: 'Grade 9', section: 'A' };
const mockStudent2: any = { id: 'student-2', userId: 'user-student-2', studentCode: 'STU-002', gradeLevel: 'Grade 9', section: 'B' };
const mockStudent3: any = { id: 'student-3', userId: 'user-student-3', studentCode: 'STU-003', gradeLevel: 'Grade 10', section: 'A' };
const mockCourse: any = { id: 'course-1', title: 'Math Grade 9', subject: 'Mathematics', gradeLevel: 'Grade 9', teacherId: 'teacher-1', status: 'ACTIVE' };
const mockCourse2: any = { id: 'course-2', title: 'Physics Grade 9', subject: 'Physics', gradeLevel: 'Grade 9', teacherId: 'teacher-2', status: 'ACTIVE' };
const mockEnrollment: any = { id: 'enr-1', courseId: 'course-1', studentId: 'student-1', status: 'ACTIVE', enrolledById: 'user-admin-1' };
const mockEnrollment2: any = { id: 'enr-2', courseId: 'course-1', studentId: 'student-2', status: 'ACTIVE', enrolledById: 'user-admin-1' };
const mockAdmin: any = { id: 'user-admin-1', role: 'ADMIN' };

const state: any = {
  teachers: [mockTeacher, mockTeacher2],
  students: [mockStudent, mockStudent2, mockStudent3],
  courses: [mockCourse, mockCourse2],
  enrollments: [mockEnrollment, mockEnrollment2],
  attendances: [],
  users: [mockAdmin],
  auditLogs: [],
};

const mockPrisma = {
  teacher: { findUnique: async ({ where }: any) => state.teachers.find((t: any) => t.userId === where.userId) || null },
  student: { findUnique: async ({ where }: any) => state.students.find((s: any) => s.userId === where.userId || s.id === where.id) || null },
  course: {
    findUnique: async ({ where }: any) => {
      const c = state.courses.find((c: any) => c.id === where.id);
      if (!c) return null;
      return { ...c, enrollments: state.enrollments.filter((e: any) => e.courseId === c.id).map((e: any) => ({ student: state.students.find((s: any) => s.id === e.studentId) })) };
    },
  },
  user: { findUnique: async ({ where }: any) => state.users.find((u: any) => u.id === where.id) || null },
  courseEnrollment: {
    findUnique: async ({ where }: any) => {
      if (where.courseId_studentId) {
        return state.enrollments.find((e: any) => e.courseId === where.courseId_studentId.courseId && e.studentId === where.courseId_studentId.studentId) || null;
      }
      return state.enrollments.find((e: any) => e.id === where.id) || null;
    },
    findFirst: async ({ where }: any) => {
      return state.enrollments.find((e: any) => e.studentId === where.studentId && where.courseId?.in?.includes(e.courseId)) || null;
    },
  },
  attendance: {
    findMany: async ({ where }: any) => {
      let result = state.attendances;
      if (where?.courseId) result = result.filter((a: any) => a.courseId === where.courseId);
      if (where?.studentId) result = result.filter((a: any) => a.studentId === where.studentId);
      return result;
    },
    count: async ({ where }: any) => {
      let result = state.attendances;
      if (where?.courseId) result = result.filter((a: any) => a.courseId === where.courseId);
      if (where?.studentId) result = result.filter((a: any) => a.studentId === where.studentId);
      return result.length;
    },
    findUnique: async ({ where }: any) => {
      let found;
      if (where.studentId_courseId_date) {
        found = state.attendances.find((a: any) => a.studentId === where.studentId_courseId_date.studentId && a.courseId === where.studentId_courseId_date.courseId && a.date.getTime() === where.studentId_courseId_date.date.getTime()) || null;
      } else {
        found = state.attendances.find((a: any) => a.id === where.id) || null;
      }
      if (found) {
        const course = state.courses.find((c: any) => c.id === found.courseId);
        return { ...found, course: course || null };
      }
      return null;
    },
    create: async ({ data }: any) => {
      const rec = { id: `att-${state.attendances.length + 1}`, ...data, createdAt: new Date(), updatedAt: new Date() };
      state.attendances.push(rec);
      return rec;
    },
    update: async ({ where, data }: any) => {
      const idx = state.attendances.findIndex((a: any) => a.id === where.id);
      state.attendances[idx] = { ...state.attendances[idx], ...data };
      return state.attendances[idx];
    },
  },
  auditLog: { create: async ({ data }: any) => { const log = { id: `audit-${state.auditLogs.length + 1}`, ...data }; state.auditLogs.push(log); return log; } },
  $transaction: async (fn: any) => fn(mockPrisma),
};

const prismaClientPath = require.resolve('../src/prisma/client');
require.cache[prismaClientPath] = { id: prismaClientPath, filename: prismaClientPath, loaded: true, exports: mockPrisma } as any;

const attendanceService = require('../src/services/attendanceService');
const { NotFoundError, ForbiddenError, ConflictError, ValidationError } = require('../src/utils/errors');

test('listCourseAttendance returns enrolled students for teacher owner', async () => {
  const result = await attendanceService.listCourseAttendance({ courseId: 'course-1', role: 'TEACHER', userId: 'user-teacher-1' });
  assert.strictEqual(result.enrolledStudents.length, 2);
  assert.strictEqual(result.course.id, 'course-1');
});

test('listCourseAttendance rejects non-owner teacher', async () => {
  await assert.rejects(
    attendanceService.listCourseAttendance({ courseId: 'course-1', role: 'TEACHER', userId: 'user-teacher-2' }),
    ForbiddenError
  );
});

test('upsertAttendance creates records for enrolled students', async () => {
  const result = await attendanceService.upsertAttendance({
    actorId: 'user-teacher-1',
    records: [
      { studentId: 'student-1', courseId: 'course-1', date: '2026-08-20', status: 'PRESENT' },
      { studentId: 'student-2', courseId: 'course-1', date: '2026-08-20', status: 'ABSENT' },
    ],
  });
  assert.strictEqual(result.length, 2);
  assert.strictEqual(state.auditLogs.length, 1);
  assert.strictEqual(state.auditLogs[0].action, 'ATTENDANCE_MARKED');
});

test('upsertAttendance rejects non-enrolled student', async () => {
  await assert.rejects(
    attendanceService.upsertAttendance({
      actorId: 'user-teacher-1',
      records: [{ studentId: 'student-3', courseId: 'course-1', date: '2026-08-21', status: 'PRESENT' }],
    }),
    ValidationError
  );
});

test('correctAttendance audits the change', async () => {
  const existing = state.attendances[0];
  const result = await attendanceService.correctAttendance({
    actorId: 'user-teacher-1',
    attendanceId: existing.id,
    data: { status: 'LATE' },
  });
  assert.strictEqual(result.status, 'LATE');
  const audit = state.auditLogs.find((l: any) => l.action === 'ATTENDANCE_CORRECTED');
  assert.ok(audit);
  assert.strictEqual(audit.metadata.before.status, 'PRESENT');
  assert.strictEqual(audit.metadata.after.status, 'LATE');
});

test('listStudentAttendance allows self access', async () => {
  const result = await attendanceService.listStudentAttendance({ studentId: 'student-1', role: 'STUDENT', userId: 'user-student-1' });
  assert.ok(result.attendance.length >= 1);
});

test('listStudentAttendance rejects other student', async () => {
  await assert.rejects(
    attendanceService.listStudentAttendance({ studentId: 'student-1', role: 'STUDENT', userId: 'user-student-2' }),
    ForbiddenError
  );
});


