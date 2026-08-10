// Tests for the assignment service - assignments, submissions, and grading.
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

const mockTeacher2: any = {
  id: 'teacher-2',
  userId: 'user-teacher-2',
  employeeCode: 'TCH-002',
  subject: 'Physics',
};

const mockStudent: any = {
  id: 'student-1',
  userId: 'user-student-1',
  studentCode: 'STU-001',
  gradeLevel: 'Grade 9',
  section: 'A',
};

const mockStudent2: any = {
  id: 'student-2',
  userId: 'user-student-2',
  studentCode: 'STU-002',
  gradeLevel: 'Grade 9',
  section: 'B',
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

const mockAssignment: any = {
  id: 'assignment-1',
  courseId: 'course-1',
  title: 'Math Homework 1',
  instructions: 'Solve problems 1-10',
  maxScore: 100,
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // future
  status: 'PUBLISHED',
  createdById: 'user-teacher-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  course: mockCourse,
};

// An assignment with a past due date, used to verify late submissions
const mockLateAssignment: any = {
  id: 'assignment-2',
  courseId: 'course-1',
  title: 'Late Homework',
  instructions: 'Past due',
  maxScore: 50,
  dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // past
  status: 'PUBLISHED',
  createdById: 'user-teacher-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  course: mockCourse,
};

const mockSubmission: any = {
  id: 'submission-1',
  assignmentId: 'assignment-1',
  studentId: 'student-1',
  content: 'My answer',
  fileUrl: null,
  publicId: null,
  mimeType: null,
  sizeBytes: null,
  status: 'SUBMITTED',
  isLate: false,
  score: null,
  feedback: null,
  gradedById: null,
  gradedAt: null,
  submittedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  assignment: mockAssignment,
  student: { ...mockStudent, user: { id: 'user-student-1', fullName: 'Sample Student', email: 'student@school.edu' } },
};

// ---------------------------------------------------------------
// Mock Prisma client
// ---------------------------------------------------------------
const state: any = {
  teachers: [mockTeacher, mockTeacher2],
  students: [mockStudent, mockStudent2],
  courses: [mockCourse],
  enrollments: [mockEnrollment],
  assignments: [mockAssignment, mockLateAssignment],
  submissions: [mockSubmission],
  auditLogs: [],
  notifications: [],
};

const mockPrisma = {
  teacher: {
    findUnique: async ({ where }: any) => state.teachers.find((t: any) => t.userId === where.userId) || null,
  },
  student: {
    findUnique: async ({ where }: any) =>
      state.students.find((s: any) => s.userId === where.userId || s.id === where.id) || null,
  },
  course: {
    findUnique: async ({ where }: any) => state.courses.find((c: any) => c.id === where.id) || null,
  },
  courseEnrollment: {
    findUnique: async ({ where }: any) => {
      if (where.courseId_studentId) {
        return (
          state.enrollments.find(
            (e: any) =>
              e.courseId === where.courseId_studentId.courseId && e.studentId === where.courseId_studentId.studentId
          ) || null
        );
      }
      return state.enrollments.find((e: any) => e.id === where.id) || null;
    },
  },
  assignment: {
    findMany: async ({ where, skip, take }: any) => {
      let result = state.assignments;
      if (where?.courseId) result = result.filter((a: any) => a.courseId === where.courseId);
      if (typeof where?.status === 'string') result = result.filter((a: any) => a.status === where.status);
      if (where?.status && where.status.not) result = result.filter((a: any) => a.status !== where.status.not);
      return result.slice(skip || 0, (skip || 0) + (take || 20));
    },
    count: async ({ where }: any) => {
      let result = state.assignments;
      if (where?.courseId) result = result.filter((a: any) => a.courseId === where.courseId);
      if (typeof where?.status === 'string') result = result.filter((a: any) => a.status === where.status);
      if (where?.status && where.status.not) result = result.filter((a: any) => a.status !== where.status.not);
      return result.length;
    },
    findUnique: async ({ where }: any) => state.assignments.find((a: any) => a.id === where.id) || null,
    create: async ({ data }: any) => {
      const assignment = {
        id: `assignment-${state.assignments.length + 1}`,
        ...data,
        status: data.status || 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
        course: state.courses.find((c: any) => c.id === data.courseId),
      };
      state.assignments.push(assignment);
      return assignment;
    },
    update: async ({ where, data }: any) => {
      const idx = state.assignments.findIndex((a: any) => a.id === where.id);
      state.assignments[idx] = { ...state.assignments[idx], ...data };
      return state.assignments[idx];
    },
  },
  assignmentSubmission: {
    findUnique: async ({ where }: any) => {
      if (where.assignmentId_studentId) {
        return (
          state.submissions.find(
            (s: any) =>
              s.assignmentId === where.assignmentId_studentId.assignmentId &&
              s.studentId === where.assignmentId_studentId.studentId
          ) || null
        );
      }
      return state.submissions.find((s: any) => s.id === where.id) || null;
    },
    findMany: async ({ where, skip, take }: any) => {
      let result = state.submissions;
      if (where?.assignmentId) result = result.filter((s: any) => s.assignmentId === where.assignmentId);
      if (where?.studentId) result = result.filter((s: any) => s.studentId === where.studentId);
      return result.slice(skip || 0, (skip || 0) + (take || 20));
    },
    count: async ({ where }: any) => {
      let result = state.submissions;
      if (where?.assignmentId) result = result.filter((s: any) => s.assignmentId === where.assignmentId);
      return result.length;
    },
    create: async ({ data }: any) => {
      const submission = {
        id: `submission-${state.submissions.length + 1}`,
        ...data,
        status: data.status || 'SUBMITTED',
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        assignment: state.assignments.find((a: any) => a.id === data.assignmentId),
        student: { ...mockStudent, user: { id: 'user-student-1', fullName: 'Sample Student', email: 'student@school.edu' } },
      };
      state.submissions.push(submission);
      return submission;
    },
    update: async ({ where, data }: any) => {
      const idx = state.submissions.findIndex((s: any) => s.id === where.id);
      state.submissions[idx] = { ...state.submissions[idx], ...data };
      return state.submissions[idx];
    },
  },
  auditLog: {
    create: async ({ data }: any) => {
      const log = { id: `audit-${state.auditLogs.length + 1}`, ...data };
      state.auditLogs.push(log);
      return log;
    },
  },
  notification: {
    create: async ({ data }: any) => {
      const item = { id: `note-${state.notifications.length + 1}`, ...data };
      state.notifications.push(item);
      return item;
    },
  },
  $transaction: async (fn: any) => fn(mockPrisma),
};

// ---------------------------------------------------------------
// Inject mock prisma and mock cloudinary storage
// ---------------------------------------------------------------
const prismaClientPath = require.resolve('../src/prisma/client');
require.cache[prismaClientPath] = {
  id: prismaClientPath,
  filename: prismaClientPath,
  loaded: true,
  exports: mockPrisma,
} as any;

const storagePath = require.resolve('../src/services/fileStorageService');
require.cache[storagePath] = {
  id: storagePath,
  filename: storagePath,
  loaded: true,
  exports: {
    uploadFile: async () => ({
      url: 'https://res.cloudinary.com/test/assignment-submissions/submission.pdf',
      publicId: 'assignment-submissions/submission',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
    }),
    deleteFile: async () => undefined,
    getContentType: (mime: string) => (mime === 'application/pdf' ? 'PDF' : 'OTHER'),
    isConfigured: () => true,
  },
} as any;

const assignmentService = require('../src/services/assignmentService');
const { NotFoundError, ForbiddenError, ConflictError, ValidationError } = require('../src/utils/errors');

// ---------------------------------------------------------------
// Tests - Assignment CRUD and access control
// ---------------------------------------------------------------

test('listCourseAssignments returns course assignments for admin', async () => {
  const result = await assignmentService.listCourseAssignments({ courseId: 'course-1', role: 'ADMIN', userId: 'user-admin-1' });
  assert.strictEqual(result.assignments.length, 2);
  assert.ok(result.assignments.every((a: any) => a.courseId === 'course-1'));
  assert.strictEqual(result.pagination.total, 2);
});

test('listCourseAssignments filters published for student role', async () => {
  const result = await assignmentService.listCourseAssignments({ courseId: 'course-1', role: 'STUDENT', userId: 'user-student-1' });
  assert.strictEqual(result.assignments.length, 2);
  assert.ok(result.assignments.every((a: any) => a.status === 'PUBLISHED'));
});

test('listCourseAssignments throws ForbiddenError for unenrolled student', async () => {
  await assert.rejects(
    () => assignmentService.listCourseAssignments({ courseId: 'course-1', role: 'STUDENT', userId: 'user-student-2' }),
    (err: any) => err instanceof ForbiddenError
  );
});

test('getAssignmentDetails returns assignment for owner teacher', async () => {
  const result = await assignmentService.getAssignmentDetails({ assignmentId: 'assignment-1', role: 'TEACHER', userId: 'user-teacher-1' });
  assert.strictEqual(result.assignment.id, 'assignment-1');
  assert.strictEqual(result.submissions.length, 1);
});

test('getAssignmentDetails throws ForbiddenError for non-owner teacher', async () => {
  await assert.rejects(
    () => assignmentService.getAssignmentDetails({ assignmentId: 'assignment-1', role: 'TEACHER', userId: 'user-teacher-2' }),
    (err: any) => err instanceof ForbiddenError
  );
});

test('getAssignmentDetails returns only own submission for enrolled student', async () => {
  const result = await assignmentService.getAssignmentDetails({ assignmentId: 'assignment-1', role: 'STUDENT', userId: 'user-student-1' });
  assert.strictEqual(result.assignment.id, 'assignment-1');
  assert.strictEqual(result.submissions.length, 1);
  assert.strictEqual(result.submissions[0].studentId, 'student-1');
});

test('getAssignmentDetails throws NotFoundError for missing assignment', async () => {
  await assert.rejects(
    () => assignmentService.getAssignmentDetails({ assignmentId: 'missing', role: 'ADMIN', userId: 'user-admin-1' }),
    (err: any) => err instanceof NotFoundError
  );
});

test('createAssignment validates required fields', async () => {
  await assert.rejects(
    () => assignmentService.createAssignment({ actorId: 'user-teacher-1', courseId: 'course-1', data: { title: '', maxScore: 100 } }),
    (err: any) => err instanceof ValidationError
  );
});

test('createAssignment validates max score', async () => {
  await assert.rejects(
    () => assignmentService.createAssignment({ actorId: 'user-teacher-1', courseId: 'course-1', data: { title: 'HW', maxScore: 0 } }),
    (err: any) => err instanceof ValidationError
  );
});

test('createAssignment throws ForbiddenError for non-owner teacher', async () => {
  await assert.rejects(
    () => assignmentService.createAssignment({ actorId: 'user-teacher-2', courseId: 'course-1', data: { title: 'HW', maxScore: 100 } }),
    (err: any) => err instanceof ForbiddenError
  );
});

test('createAssignment creates assignment with audit log', async () => {
  const assignment = await assignmentService.createAssignment({
    actorId: 'user-teacher-1',
    courseId: 'course-1',
    data: { title: 'Physics Homework', instructions: 'Read chapter 3', maxScore: 50, status: 'PUBLISHED' },
    ipAddress: '127.0.0.1',
  });
  assert.strictEqual(assignment.title, 'Physics Homework');
  assert.strictEqual(assignment.courseId, 'course-1');
  assert.strictEqual(assignment.status, 'PUBLISHED');
  assert.strictEqual(state.auditLogs.some((l: any) => l.action === 'ASSIGNMENT_CREATED'), true);
});

test('createAssignment validates invalid due date', async () => {
  await assert.rejects(
    () =>
      assignmentService.createAssignment({
        actorId: 'user-teacher-1',
        courseId: 'course-1',
        data: { title: 'HW', maxScore: 100, dueDate: 'not-a-date' },
      }),
    (err: any) => err instanceof ValidationError
  );
});

test('updateAssignment throws ForbiddenError for non-owner teacher', async () => {
  await assert.rejects(
    () => assignmentService.updateAssignment({ actorId: 'user-teacher-2', assignmentId: 'assignment-1', data: { title: 'Hacked' } }),
    (err: any) => err instanceof ForbiddenError
  );
});

test('updateAssignment validates max score', async () => {
  await assert.rejects(
    () => assignmentService.updateAssignment({ actorId: 'user-teacher-1', assignmentId: 'assignment-1', data: { maxScore: -5 } }),
    (err: any) => err instanceof ValidationError
  );
});

test('updateAssignment updates status with audit log', async () => {
  const updated = await assignmentService.updateAssignment({
    actorId: 'user-teacher-1',
    assignmentId: 'assignment-1',
    data: { status: 'CLOSED', maxScore: 120 },
    ipAddress: '127.0.0.1',
  });
  assert.strictEqual(updated.status, 'CLOSED');
  assert.strictEqual(updated.maxScore, 120);
  assert.strictEqual(state.auditLogs.some((l: any) => l.action === 'ASSIGNMENT_UPDATED'), true);
});

test('archiveAssignment archives assignment with audit log', async () => {
  const updated = await assignmentService.archiveAssignment({ actorId: 'user-teacher-1', assignmentId: 'assignment-1' });
  assert.strictEqual(updated.status, 'ARCHIVED');
  assert.strictEqual(state.auditLogs.some((l: any) => l.action === 'ASSIGNMENT_ARCHIVED'), true);
});

test('archiveAssignment throws ForbiddenError for non-owner teacher', async () => {
  await assert.rejects(
    () => assignmentService.archiveAssignment({ actorId: 'user-teacher-2', assignmentId: 'assignment-1' }),
    (err: any) => err instanceof ForbiddenError
  );
});

// ---------------------------------------------------------------
// Tests - Submissions
// ---------------------------------------------------------------

test('submitAssignment creates submission for enrolled student with audit log', async () => {
  state.assignments.push({
    id: 'assignment-open',
    courseId: 'course-1',
    title: 'Open Homework',
    maxScore: 50,
    dueDate: null,
    status: 'PUBLISHED',
    createdById: 'user-teacher-1',
    course: mockCourse,
  });
  const submission = await assignmentService.submitAssignment({
    actorId: 'user-student-1',
    assignmentId: 'assignment-open',
    data: { content: 'My solution' },
    ipAddress: '127.0.0.1',
  });
  assert.strictEqual(submission.status, 'SUBMITTED');
  assert.strictEqual(submission.isLate, false);
  assert.strictEqual(submission.content, 'My solution');
  assert.strictEqual(state.auditLogs.some((l: any) => l.action === 'SUBMISSION_SUBMITTED'), true);
});

test('submitAssignment rejects submission with no text and no file', async () => {
  await assert.rejects(
    () =>
      assignmentService.submitAssignment({
        actorId: 'user-student-1',
        assignmentId: 'assignment-2',
        data: { content: '' },
      }),
    (err: any) => err instanceof ValidationError
  );
});

test('submitAssignment throws ForbiddenError for unenrolled student', async () => {
  await assert.rejects(
    () =>
      assignmentService.submitAssignment({
        actorId: 'user-student-2',
        assignmentId: 'assignment-open',
        data: { content: 'Hacked answer' },
      }),
    (err: any) => err instanceof ForbiddenError
  );
});

test('submitAssignment rejects duplicate submission', async () => {
  // Self-contained fixture: published assignment with an existing submission
  state.assignments.push({
    id: 'assignment-dup',
    courseId: 'course-1',
    title: 'Dup Homework',
    maxScore: 40,
    dueDate: null,
    status: 'PUBLISHED',
    createdById: 'user-teacher-1',
    course: mockCourse,
  });
  state.submissions.push({
    id: 'submission-dup',
    assignmentId: 'assignment-dup',
    studentId: 'student-1',
    content: 'Already submitted',
    status: 'SUBMITTED',
    isLate: false,
    assignment: mockAssignment,
    student: {
      ...mockStudent,
      user: { id: 'user-student-1', fullName: 'Sample Student', email: 'student@school.edu' },
    },
  });
  await assert.rejects(
    () =>
      assignmentService.submitAssignment({
        actorId: 'user-student-1',
        assignmentId: 'assignment-dup',
        data: { content: 'Duplicate' },
      }),
    (err: any) => err instanceof ConflictError
  );
});

test('submitAssignment marks late submission when past due', async () => {
  // assignment-2 has a past due date (mockLateAssignment)
  const submission = await assignmentService.submitAssignment({
    actorId: 'user-student-1',
    assignmentId: 'assignment-2',
    data: { content: 'Late answer' },
  });
  assert.strictEqual(submission.isLate, true);
  assert.strictEqual(submission.status, 'SUBMITTED');
});

test('submitAssignment uploads submission file through Cloudinary', async () => {
  state.assignments.push({
    id: 'assignment-up',
    courseId: 'course-1',
    title: 'Upload Homework',
    maxScore: 40,
    dueDate: null,
    status: 'PUBLISHED',
    createdById: 'user-teacher-1',
    course: mockCourse,
  });
  const submission = await assignmentService.submitAssignment({
    actorId: 'user-student-1',
    assignmentId: 'assignment-up',
    data: { content: '' },
    file: { buffer: Buffer.from('pdf-content'), mimetype: 'application/pdf', size: 2048 },
  });
  assert.strictEqual(submission.fileUrl, 'https://res.cloudinary.com/test/assignment-submissions/submission.pdf');
  assert.strictEqual(submission.publicId, 'assignment-submissions/submission');
  assert.strictEqual(submission.mimeType, 'application/pdf');
  assert.strictEqual(submission.sizeBytes, 2048);
});

test('submitAssignment throws ForbiddenError when assignment is not published', async () => {
  state.assignments.push({
    id: 'assignment-draft',
    courseId: 'course-1',
    title: 'Draft Homework',
    maxScore: 40,
    dueDate: null,
    status: 'DRAFT',
    createdById: 'user-teacher-1',
    course: mockCourse,
  });
  await assert.rejects(
    () =>
      assignmentService.submitAssignment({
        actorId: 'user-student-1',
        assignmentId: 'assignment-draft',
        data: { content: 'Too early' },
      }),
    (err: any) => err instanceof ForbiddenError
  );
});

// ---------------------------------------------------------------
// Tests - Grading
// ---------------------------------------------------------------

test('listSubmissions returns submissions for owner teacher', async () => {
  const result = await assignmentService.listSubmissions({ actorId: 'user-teacher-1', assignmentId: 'assignment-1' });
  assert.strictEqual(result.submissions.length, 1);
  assert.strictEqual(result.submissions[0].studentId, 'student-1');
  assert.strictEqual(result.pagination.total, 1);
});

test('listSubmissions throws ForbiddenError for non-owner teacher', async () => {
  await assert.rejects(
    () => assignmentService.listSubmissions({ actorId: 'user-teacher-2', assignmentId: 'assignment-1' }),
    (err: any) => err instanceof ForbiddenError
  );
});

test('gradeSubmission requires a score', async () => {
  await assert.rejects(
    () => assignmentService.gradeSubmission({ actorId: 'user-teacher-1', submissionId: 'submission-1', data: {} }),
    (err: any) => err instanceof ValidationError
  );
});

test('gradeSubmission rejects score above max score', async () => {
  // assignment-1 maxScore is 120 after update test; use a value above it
  await assert.rejects(
    () => assignmentService.gradeSubmission({ actorId: 'user-teacher-1', submissionId: 'submission-1', data: { score: 150 } }),
    (err: any) => err instanceof ValidationError
  );
});

test('gradeSubmission throws ForbiddenError for non-owner teacher', async () => {
  await assert.rejects(
    () => assignmentService.gradeSubmission({ actorId: 'user-teacher-2', submissionId: 'submission-1', data: { score: 80 } }),
    (err: any) => err instanceof ForbiddenError
  );
});

test('gradeSubmission grades submission with audit and notification', async () => {
  const graded = await assignmentService.gradeSubmission({
    actorId: 'user-teacher-1',
    submissionId: 'submission-1',
    data: { score: 85, feedback: 'Good work' },
    ipAddress: '127.0.0.1',
  });
  assert.strictEqual(graded.status, 'GRADED');
  assert.strictEqual(graded.score, 85);
  assert.strictEqual(graded.feedback, 'Good work');
  assert.strictEqual(graded.gradedById, 'user-teacher-1');

  const audit = state.auditLogs.find((l: any) => l.action === 'SUBMISSION_GRADED');
  assert.ok(audit, 'SUBMISSION_GRADED audit log should exist');
  assert.strictEqual(audit.metadata.score, 85);
  assert.strictEqual(audit.metadata.maxScore, 100);

  const note = state.notifications.find((n: any) => n.type === 'GRADE');
  assert.ok(note, 'GRADE notification should exist');
  assert.strictEqual(note.userId, 'user-student-1');
  assert.match(note.message, /85/);
});

test('gradeSubmission re-grade is audited with previous score', async () => {
  await assignmentService.gradeSubmission({
    actorId: 'user-teacher-1',
    submissionId: 'submission-1',
    data: { score: 90, feedback: 'Even better' },
    ipAddress: '127.0.0.1',
  });
  const reGrade = state.auditLogs.filter((l: any) => l.action === 'SUBMISSION_GRADED');
  const last = reGrade[reGrade.length - 1];
  assert.strictEqual(last.metadata.score, 90);
  assert.strictEqual(last.metadata.previousScore, 85);
});