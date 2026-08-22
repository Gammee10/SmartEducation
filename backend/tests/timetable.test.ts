// Tests for the timetable service - slot CRUD and conflict detection.
import { test } from 'node:test';
import assert from 'node:assert';

const mockTeacher: any = { id: 'teacher-1', userId: 'user-teacher-1', employeeCode: 'TCH-001', subject: 'Mathematics' };
const mockTeacher2: any = { id: 'teacher-2', userId: 'user-teacher-2', employeeCode: 'TCH-002', subject: 'Physics' };
const mockStudent: any = { id: 'student-1', userId: 'user-student-1', studentCode: 'STU-001', gradeLevel: 'Grade 9', section: 'A' };
const mockCourse: any = { id: 'course-1', title: 'Math Grade 9', subject: 'Mathematics', gradeLevel: 'Grade 9', teacherId: 'teacher-1', status: 'ACTIVE' };
const mockCourse2: any = { id: 'course-2', title: 'Physics Grade 9', subject: 'Physics', gradeLevel: 'Grade 9', teacherId: 'teacher-2', status: 'ACTIVE' };
const mockEnrollment: any = { id: 'enr-1', courseId: 'course-1', studentId: 'student-1', status: 'ACTIVE', enrolledById: 'user-admin-1' };

const state: any = {
  teachers: [mockTeacher, mockTeacher2],
  students: [mockStudent],
  courses: [mockCourse, mockCourse2],
  enrollments: [mockEnrollment],
  timetableSlots: [],
};

const mockPrisma = {
  teacher: { findUnique: async ({ where }: any) => state.teachers.find((t: any) => t.userId === where.userId || t.id === where.id) || null },
  student: { findUnique: async ({ where }: any) => state.students.find((s: any) => s.userId === where.userId) || null },
  course: { findUnique: async ({ where }: any) => state.courses.find((c: any) => c.id === where.id) || null },
  courseEnrollment: { findFirst: async ({ where }: any) => state.enrollments.find((e: any) => e.studentId === where.studentId && where.courseId?.in?.includes(e.courseId)) || null },
  timetableSlot: {
    findMany: async ({ where }: any) => {
      let result = state.timetableSlots;
      if (where?.dayOfWeek) result = result.filter((s: any) => s.dayOfWeek === where.dayOfWeek);
      if (where?.room) result = result.filter((s: any) => s.room === where.room);
      if (where?.teacherId) result = result.filter((s: any) => s.teacherId === where.teacherId);
      if (where?.NOT?.id) result = result.filter((s: any) => s.id !== where.NOT.id);
      return result;
    },
    findUnique: async ({ where }: any) => state.timetableSlots.find((s: any) => s.id === where.id) || null,
    create: async ({ data }: any) => {
      const slot = { id: `slot-${state.timetableSlots.length + 1}`, ...data, createdAt: new Date(), updatedAt: new Date() };
      state.timetableSlots.push(slot);
      return slot;
    },
    update: async ({ where, data }: any) => {
      const idx = state.timetableSlots.findIndex((s: any) => s.id === where.id);
      state.timetableSlots[idx] = { ...state.timetableSlots[idx], ...data };
      return state.timetableSlots[idx];
    },
    delete: async ({ where }: any) => {
      state.timetableSlots = state.timetableSlots.filter((s: any) => s.id !== where.id);
      return { id: where.id };
    },
  },
};

const prismaClientPath = require.resolve('../src/prisma/client');
require.cache[prismaClientPath] = { id: prismaClientPath, filename: prismaClientPath, loaded: true, exports: mockPrisma } as any;

const timetableService = require('../src/services/timetableService');
const { NotFoundError, ValidationError, ConflictError } = require('../src/utils/errors');

test('createTimetableSlot creates a valid slot', async () => {
  const slot = await timetableService.createTimetableSlot({
    actorId: 'user-admin-1',
    data: { courseId: 'course-1', dayOfWeek: 'MONDAY', startTime: '08:00', endTime: '09:30', room: 'R1' },
  });
  assert.strictEqual(slot.dayOfWeek, 'MONDAY');
  assert.strictEqual(slot.teacherId, 'teacher-1');
});

test('createTimetableSlot rejects room conflict', async () => {
  await assert.rejects(
    timetableService.createTimetableSlot({
      actorId: 'user-admin-1',
      data: { courseId: 'course-2', dayOfWeek: 'MONDAY', startTime: '08:30', endTime: '10:00', room: 'R1' },
    }),
    ConflictError
  );
});

test('createTimetableSlot rejects teacher conflict', async () => {
  await assert.rejects(
    timetableService.createTimetableSlot({
      actorId: 'user-admin-1',
      data: { courseId: 'course-1', dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:30', room: 'R2' },
    }),
    ConflictError
  );
});

test('createTimetableSlot rejects invalid time range', async () => {
  await assert.rejects(
    timetableService.createTimetableSlot({
      actorId: 'user-admin-1',
      data: { courseId: 'course-1', dayOfWeek: 'TUESDAY', startTime: '10:00', endTime: '09:00', room: 'R3' },
    }),
    ValidationError
  );
});

test('listTimetableSlots filters by teacher role', async () => {
  const result = await timetableService.listTimetableSlots({ role: 'TEACHER', userId: 'user-teacher-1' });
  assert.ok(result.slots.length >= 1);
  assert.ok(result.slots.every((s: any) => s.teacherId === 'teacher-1'));
});

test('deleteTimetableSlot removes a slot', async () => {
  const slot = state.timetableSlots[0];
  const result = await timetableService.deleteTimetableSlot({ actorId: 'user-admin-1', slotId: slot.id });
  assert.strictEqual(result.id, slot.id);
  assert.strictEqual(state.timetableSlots.length, 0);
});
