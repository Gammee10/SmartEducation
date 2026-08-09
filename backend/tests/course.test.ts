// Tests for the course service - courses, enrollment, and content.
import { test } from 'node:test';
import assert from 'node:assert';

// ---------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------
const mockTeacher: any = {
  id: 'teacher-1',
  userId: 'user-teacher-1',
  employeeCode: 'TCH-001',
  subject: 'Mathematics',
};

const mockStudent: any = {
  id: 'student-1',
  userId: 'user-student-1',
  studentCode: 'STU-001',
  gradeLevel: 'Grade 9',
  section: 'A',
};

const mockCourse: any = {
  id: 'course-1',
  title: 'Mathematics Grade 9',
  description: 'Basic algebra',
  subject: 'Mathematics',
  gradeLevel: 'Grade 9',
  teacherId: 'teacher-1',
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockEnrollment: any = {
  id: 'enr-1',
  courseId: 'course-1',
  studentId: 'student-1',
  status: 'ACTIVE',
  enrolledById: 'user-admin-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockContent: any = {
  id: 'content-1',
  courseId: 'course-1',
  title: 'Chapter 1 Notes',
  description: 'Introduction to algebra',
  type: 'PDF',
  url: 'https://res.cloudinary.com/test/notes.pdf',
  publicId: 'course-content/notes',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  uploadedById: 'user-teacher-1',
  isArchived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ---------------------------------------------------------------
// Mock Prisma client
// ---------------------------------------------------------------
const state: any = {
  teachers: [mockTeacher],
  students: [mockStudent],
  courses: [mockCourse],
  enrollments: [mockEnrollment],
  content: [mockContent],
  auditLogs: [],
};

const mockPrisma = {
  teacher: {
    findUnique: async ({ where }: any) => state.teachers.find((t: any) => t.userId === where.userId) || null,
  },
  student: {
    findUnique: async ({ where }: any) => state.students.find((s: any) => s.userId === where.userId || s.id === where.id) || null,
  },
  course: {
    findMany: async ({ where, skip, take }: any) => {
      let result = state.courses;
      if (where?.teacherId) result = result.filter((c: any) => c.teacherId === where.teacherId);
      if (where?.status) result = result.filter((c: any) => c.status === where.status);
      if (where?.enrollments?.some) {
        result = result.filter((c: any) =>
          state.enrollments.some(
            (e: any) => e.courseId === c.id && e.studentId === where.enrollments.some.studentId && e.status === 'ACTIVE'
          )
        );
      }
      return result.slice(skip || 0, (skip || 0) + (take || 20));
    },
    count: async ({ where }: any) => {
      let result = state.courses;
      if (where?.teacherId) result = result.filter((c: any) => c.teacherId === where.teacherId);
      if (where?.status) result = result.filter((c: any) => c.status === where.status);
      return result.length;
    },
    findUnique: async ({ where }: any) => state.courses.find((c: any) => c.id === where.id) || null,
    create: async ({ data }: any) => {
      const course = {
        id: `course-${state.courses.length + 1}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      state.courses.push(course);
      return course;
    },
    update: async ({ where, data }: any) => {
      const idx = state.courses.findIndex((c: any) => c.id === where.id);
      state.courses[idx] = { ...state.courses[idx], ...data };
      return state.courses[idx];
    },
  },
  courseEnrollment: {
    findUnique: async ({ where }: any) => {
      if (where.courseId_studentId) {
        return state.enrollments.find(
          (e: any) => e.courseId === where.courseId_studentId.courseId && e.studentId === where.courseId_studentId.studentId
        ) || null;
      }
      return state.enrollments.find((e: any) => e.id === where.id) || null;
    },
    create: async ({ data }: any) => {
      const enr = {
        id: `enr-${state.enrollments.length + 1}`,
        ...data,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      state.enrollments.push(enr);
      return enr;
    },
    update: async ({ where, data }: any) => {
      const idx = state.enrollments.findIndex((e: any) => e.id === where.id);
      state.enrollments[idx] = { ...state.enrollments[idx], ...data };
      return state.enrollments[idx];
    },
  },
  contentItem: {
    findMany: async ({ where, skip, take }: any) => {
      let result = state.content;
      if (where?.courseId) result = result.filter((c: any) => c.courseId === where.courseId);
      if (where?.isArchived !== undefined) result = result.filter((c: any) => c.isArchived === where.isArchived);
      return result.slice(skip || 0, (skip || 0) + (take || 20));
    },
    count: async ({ where }: any) => {
      let result = state.content;
      if (where?.courseId) result = result.filter((c: any) => c.courseId === where.courseId);
      if (where?.isArchived !== undefined) result = result.filter((c: any) => c.isArchived === where.isArchived);
      return result.length;
    },
    findUnique: async ({ where }: any) => state.content.find((c: any) => c.id === where.id) || null,
    create: async ({ data }: any) => {
      const item = {
        id: `content-${state.content.length + 1}`,
        ...data,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      state.content.push(item);
      return item;
    },
    update: async ({ where, data }: any) => {
      const idx = state.content.findIndex((c: any) => c.id === where.id);
      state.content[idx] = { ...state.content[idx], ...data };
      return state.content[idx];
    },
  },
  auditLog: {
    create: async ({ data }: any) => {
      const log = { id: `audit-${state.auditLogs.length + 1}`, ...data };
      state.auditLogs.push(log);
      return log;
    },
  },
  $transaction: async (fn: any) => fn(mockPrisma),
};

// Inject mock prisma
const prismaClientPath = require.resolve('../src/prisma/client');
require.cache[prismaClientPath] = {
  id: prismaClientPath,
  filename: prismaClientPath,
  loaded: true,
  exports: mockPrisma,
} as any;

const courseService = require('../src/services/courseService');
const { NotFoundError, ForbiddenError, ConflictError, ValidationError } = require('../src/utils/errors');

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

test('listCourses returns all courses for admin', async () => {
  const result = await courseService.listCourses({ role: 'ADMIN', userId: 'user-admin-1' });
  assert.strictEqual(result.courses.length, 1);
  assert.strictEqual(result.pagination.total, 1);
});

test('listCourses filters by teacher for teacher role', async () => {
  const result = await courseService.listCourses({ role: 'TEACHER', userId: 'user-teacher-1' });
  assert.strictEqual(result.courses.length, 1);
  assert.strictEqual(result.courses[0].teacherId, 'teacher-1');
});

test('listCourses filters by enrollment for student role', async () => {
  const result = await courseService.listCourses({ role: 'STUDENT', userId: 'user-student-1' });
  assert.strictEqual(result.courses.length, 1);
});

test('getCourse returns course for admin', async () => {
  const course = await courseService.getCourse({ courseId: 'course-1', role: 'ADMIN', userId: 'user-admin-1' });
  assert.strictEqual(course.id, 'course-1');
  assert.strictEqual(course.title, 'Mathematics Grade 9');
});

test('getCourse throws NotFoundError for missing course', async () => {
  await assert.rejects(
    () => courseService.getCourse({ courseId: 'missing', role: 'ADMIN', userId: 'user-admin-1' }),
    (err: any) => err instanceof NotFoundError
  );
});

test('getCourse throws ForbiddenError for non-owner teacher', async () => {
  // Add a second teacher who doesn't own the course
  state.teachers.push({ id: 'teacher-2', userId: 'user-teacher-2', employeeCode: 'TCH-002', subject: 'Physics' });
  await assert.rejects(
    () => courseService.getCourse({ courseId: 'course-1', role: 'TEACHER', userId: 'user-teacher-2' }),
    (err: any) => err instanceof ForbiddenError
  );
});

test('getCourse throws ForbiddenError for unenrolled student', async () => {
  // Add a second student who isn't enrolled
  state.students.push({ id: 'student-2', userId: 'user-student-2', studentCode: 'STU-002', gradeLevel: 'Grade 9', section: 'B' });
  await assert.rejects(
    () => courseService.getCourse({ courseId: 'course-1', role: 'STUDENT', userId: 'user-student-2' }),
    (err: any) => err instanceof ForbiddenError
  );
});

test('createCourse validates required fields', async () => {
  await assert.rejects(
    () => courseService.createCourse({ actorId: 'user-teacher-1', data: { title: '', subject: '', gradeLevel: '' } }),
    (err: any) => err instanceof ValidationError
  );
});

test('createCourse creates course with audit log', async () => {
  const course = await courseService.createCourse({
    actorId: 'user-teacher-1',
    data: { title: 'Physics Grade 9', subject: 'Physics', gradeLevel: 'Grade 9' },
  });
  assert.strictEqual(course.title, 'Physics Grade 9');
  assert.strictEqual(course.teacherId, 'teacher-1');
  assert.strictEqual(state.auditLogs.some((l: any) => l.action === 'COURSE_CREATED'), true);
});

test('updateCourse throws ForbiddenError for non-owner teacher', async () => {
  await assert.rejects(
    () => courseService.updateCourse({ actorId: 'user-teacher-2', courseId: 'course-1', data: { title: 'Hacked' } }),
    (err: any) => err instanceof ForbiddenError
  );
});

test('enrollStudent creates enrollment with audit log', async () => {
  const enrollment = await courseService.enrollStudent({
    actorId: 'user-admin-1',
    courseId: 'course-1',
    studentId: 'student-2',
  });
  assert.strictEqual(enrollment.status, 'ACTIVE');
  assert.strictEqual(state.auditLogs.some((l: any) => l.action === 'COURSE_ENROLLED'), true);
});

test('enrollStudent rejects duplicate active enrollment', async () => {
  await assert.rejects(
    () => courseService.enrollStudent({ actorId: 'user-admin-1', courseId: 'course-1', studentId: 'student-1' }),
    (err: any) => err instanceof ConflictError
  );
});

test('unenrollStudent drops enrollment', async () => {
  const result = await courseService.unenrollStudent({
    actorId: 'user-admin-1',
    courseId: 'course-1',
    studentId: 'student-2',
  });
  assert.strictEqual(result.status, 'DROPPED');
  assert.strictEqual(state.auditLogs.some((l: any) => l.action === 'COURSE_UNENROLLED'), true);
});

test('listContent returns course content', async () => {
  const result = await courseService.listContent({
    courseId: 'course-1',
    role: 'ADMIN',
    userId: 'user-admin-1',
  });
  assert.strictEqual(result.items.length, 1);
  assert.strictEqual(result.items[0].title, 'Chapter 1 Notes');
});

test('uploadContent validates title and url', async () => {
  await assert.rejects(
    () => courseService.uploadContent({ actorId: 'user-teacher-1', courseId: 'course-1', data: { title: '', url: '' } }),
    (err: any) => err instanceof ValidationError
  );
});

test('uploadContent throws ForbiddenError for non-owner teacher', async () => {
  await assert.rejects(
    () => courseService.uploadContent({
      actorId: 'user-teacher-2',
      courseId: 'course-1',
      data: { title: 'Test', url: 'https://example.com' },
    }),
    (err: any) => err instanceof ForbiddenError
  );
});

test('uploadContent creates content with audit log', async () => {
  const item = await courseService.uploadContent({
    actorId: 'user-teacher-1',
    courseId: 'course-1',
    data: { title: 'Chapter 2 Notes', url: 'https://res.cloudinary.com/test/ch2.pdf', type: 'PDF' },
  });
  assert.strictEqual(item.title, 'Chapter 2 Notes');
  assert.strictEqual(item.courseId, 'course-1');
  assert.strictEqual(state.auditLogs.some((l: any) => l.action === 'CONTENT_UPLOADED'), true);
});

test('archiveContent archives content with audit log', async () => {
  const item = await courseService.archiveContent({
    actorId: 'user-teacher-1',
    contentId: 'content-1',
  });
  assert.strictEqual(item.isArchived, true);
  assert.strictEqual(state.auditLogs.some((l: any) => l.action === 'CONTENT_ARCHIVED'), true);
});

test('archiveContent throws ForbiddenError for non-owner teacher', async () => {
  await assert.rejects(
    () => courseService.archiveContent({ actorId: 'user-teacher-2', contentId: 'content-1' }),
    (err: any) => err instanceof ForbiddenError
  );
});