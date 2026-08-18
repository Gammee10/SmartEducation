// Tests for the quiz service - quiz CRUD, questions, attempts, auto-grading.
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

// A quiz with 2 questions (4 total points)
const mockQuiz: any = {
  id: 'quiz-1',
  courseId: 'course-1',
  title: 'Math Quiz 1',
  description: 'Algebra basics',
  timeLimit: 10,
  maxAttempts: 2,
  shuffleQuestions: false,
  shuffleOptions: false,
  status: 'PUBLISHED',
  publishedAt: new Date(),
  createdById: 'user-teacher-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  course: mockCourse,
  questions: [
    {
      id: 'question-1',
      quizId: 'quiz-1',
      prompt: 'What is 2+2?',
      type: 'SINGLE_CHOICE',
      points: 2,
      orderIndex: 0,
      options: [
        { id: 'option-1', questionId: 'question-1', optionText: '3', isCorrect: false, orderIndex: 0 },
        { id: 'option-2', questionId: 'question-1', optionText: '4', isCorrect: true, orderIndex: 1 },
      ],
    },
    {
      id: 'question-2',
      quizId: 'quiz-1',
      prompt: 'What is 3+3?',
      type: 'SINGLE_CHOICE',
      points: 2,
      orderIndex: 1,
      options: [
        { id: 'option-3', questionId: 'question-2', optionText: '5', isCorrect: false, orderIndex: 0 },
        { id: 'option-4', questionId: 'question-2', optionText: '6', isCorrect: true, orderIndex: 1 },
      ],
    },
  ],
};

// Draft quiz - not available to students
const mockDraftQuiz: any = {
  ...mockQuiz,
  id: 'quiz-draft',
  title: 'Draft Quiz',
  status: 'DRAFT',
  publishedAt: null,
  questions: [],
};

// Quiz with only 1 attempt allowed
const mockSingleAttemptQuiz: any = {
  ...mockQuiz,
  id: 'quiz-single',
  title: 'Single Attempt Quiz',
  maxAttempts: 1,
  questions: mockQuiz.questions,
};

const mockAttempt: any = {
  id: 'attempt-1',
  quizId: 'quiz-1',
  studentId: 'student-1',
  status: 'IN_PROGRESS',
  startedAt: new Date(),
  submittedAt: null,
  expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
  score: null,
  maxScore: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  quiz: mockQuiz,
  answers: [],
};

// An expired attempt (past expiresAt)
const mockExpiredAttempt: any = {
  ...mockAttempt,
  id: 'attempt-expired',
  expiresAt: new Date(Date.now() - 60 * 1000), // already expired
  status: 'IN_PROGRESS',
};

// ---------------------------------------------------------------
// Mock Prisma client
// ---------------------------------------------------------------
const state: any = {
  teachers: [mockTeacher, mockTeacher2],
  students: [mockStudent, mockStudent2],
  courses: [mockCourse],
  enrollments: [mockEnrollment],
  quizzes: [mockQuiz, mockDraftQuiz, mockSingleAttemptQuiz],
  questions: [...mockQuiz.questions],
  attempts: [mockAttempt, mockExpiredAttempt],
  answers: [],
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
              e.courseId === where.courseId_studentId.courseId &&
              e.studentId === where.courseId_studentId.studentId
          ) || null
        );
      }
      return state.enrollments.find((e: any) => e.id === where.id) || null;
    },
  },
  quiz: {
    findMany: async ({ where, skip, take }: any) => {
      let result = state.quizzes;
      if (where?.courseId) result = result.filter((q: any) => q.courseId === where.courseId);
      if (typeof where?.status === 'string') result = result.filter((q: any) => q.status === where.status);
      if (where?.status && where.status.not) result = result.filter((q: any) => q.status !== where.status.not);
      return result.slice(skip || 0, (skip || 0) + (take || 20));
    },
    count: async ({ where }: any) => {
      let result = state.quizzes;
      if (where?.courseId) result = result.filter((q: any) => q.courseId === where.courseId);
      if (typeof where?.status === 'string') result = result.filter((q: any) => q.status === where.status);
      if (where?.status && where.status.not) result = result.filter((q: any) => q.status !== where.status.not);
      return result.length;
    },
    findUnique: async ({ where }: any) => state.quizzes.find((q: any) => q.id === where.id) || null,
    create: async ({ data }: any) => {
      const quiz = {
        id: `quiz-${state.quizzes.length + 1}`,
        ...data,
        status: data.status || 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
        course: state.courses.find((c: any) => c.id === data.courseId),
        questions: data.questions?.create || [],
      };
      state.quizzes.push(quiz);
      return quiz;
    },
    update: async ({ where, data }: any) => {
      const idx = state.quizzes.findIndex((q: any) => q.id === where.id);
      state.quizzes[idx] = { ...state.quizzes[idx], ...data };
      return state.quizzes[idx];
    },
  },
  quizQuestion: {
    findUnique: async ({ where }: any) => {
      const q = state.questions.find((question: any) => question.id === where.id);
      if (!q) return null;
      // Enrich with quiz + course relations for service-level access checks
      const quiz = state.quizzes.find((quiz: any) => quiz.id === q.quizId);
      return {
        ...q,
        quiz: quiz ? { ...quiz, course: quiz.course || null } : null,
      };
    },
    create: async ({ data }: any) => {
      const question = {
        id: `question-${state.questions.length + 1}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        options: data.options?.create || [],
      };
      state.questions.push(question);
      return question;
    },
    update: async ({ where, data }: any) => {
      const idx = state.questions.findIndex((q: any) => q.id === where.id);
      state.questions[idx] = { ...state.questions[idx], ...data };
      return state.questions[idx];
    },
    delete: async ({ where }: any) => {
      state.questions = state.questions.filter((q: any) => q.id !== where.id);
      return { id: where.id };
    },
  },
  quizOption: {
    deleteMany: async () => ({ count: 0 }),
  },
  quizAttempt: {
    findUnique: async ({ where }: any) => state.attempts.find((a: any) => a.id === where.id) || null,
    findMany: async ({ where }: any) => {
      let result = state.attempts;
      if (where?.quizId) result = result.filter((a: any) => a.quizId === where.quizId);
      if (where?.studentId) result = result.filter((a: any) => a.studentId === where.studentId);
      return result;
    },
    count: async ({ where }: any) => {
      let result = state.attempts;
      if (where?.quizId) result = result.filter((a: any) => a.quizId === where.quizId);
      if (where?.studentId) result = result.filter((a: any) => a.studentId === where.studentId);
      if (where?.status?.in) result = result.filter((a: any) => where.status.in.includes(a.status));
      return result.length;
    },
    create: async ({ data }: any) => {
      const attempt = {
        id: `attempt-${state.attempts.length + 1}`,
        ...data,
        status: data.status || 'IN_PROGRESS',
        createdAt: new Date(),
        updatedAt: new Date(),
        quiz: state.quizzes.find((q: any) => q.id === data.quizId),
        student: state.students.find((s: any) => s.id === data.studentId),
        answers: [],
      };
      state.attempts.push(attempt);
      return attempt;
    },
    update: async ({ where, data }: any) => {
      const idx = state.attempts.findIndex((a: any) => a.id === where.id);
      state.attempts[idx] = { ...state.attempts[idx], ...data };
      return state.attempts[idx];
    },
  },
  quizAnswer: {
    deleteMany: async () => ({ count: 0 }),
    createMany: async ({ data }: any) => {
      state.answers.push(...data);
      return { count: data.length };
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
// Inject mock prisma and mock courseService dependency
// ---------------------------------------------------------------
const prismaClientPath = require.resolve('../src/prisma/client');
require.cache[prismaClientPath] = {
  id: prismaClientPath,
  filename: prismaClientPath,
  loaded: true,
  exports: mockPrisma,
} as any;

const courseServicePath = require.resolve('../src/services/courseService');
require.cache[courseServicePath] = {
  id: courseServicePath,
  filename: courseServicePath,
  loaded: true,
  exports: {
    getCourse: async ({ courseId, role, userId }: any) => {
      const course = state.courses.find((c: any) => c.id === courseId);
      if (!course) {
        const { NotFoundError } = require('../src/utils/errors');
        throw new NotFoundError('Course not found');
      }
      if (role === 'TEACHER') {
        const teacher = state.teachers.find((t: any) => t.userId === userId);
        if (!teacher || teacher.id !== course.teacherId) {
          const { ForbiddenError } = require('../src/utils/errors');
          throw new ForbiddenError('You do not have access to this course');
        }
      } else if (role === 'STUDENT') {
        const student = state.students.find((s: any) => s.userId === userId);
        if (!student) {
          const { NotFoundError } = require('../src/utils/errors');
          throw new NotFoundError('Student profile not found');
        }
        const enrollment = state.enrollments.find(
          (e: any) => e.courseId === courseId && e.studentId === student.id
        );
        if (!enrollment || enrollment.status !== 'ACTIVE') {
          const { ForbiddenError } = require('../src/utils/errors');
          throw new ForbiddenError('You are not enrolled in this course');
        }
      }
      return course;
    },
  },
} as any;

const quizService = require('../src/services/quizService');
const { NotFoundError, ForbiddenError, ConflictError, ValidationError } = require('../src/utils/errors');

// ---------------------------------------------------------------
// Helper: create a fresh attempt for repeated tests
// ---------------------------------------------------------------
function freshAttempt(overrides: any = {}) {
  return {
    id: `attempt-fresh-${state.attempts.length + 1}`,
    quizId: 'quiz-1',
    studentId: 'student-1',
    status: 'IN_PROGRESS',
    startedAt: new Date(),
    submittedAt: null,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    score: null,
    maxScore: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    quiz: mockQuiz,
    answers: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------
// Tests - Quiz CRUD and access control
// ---------------------------------------------------------------

test('listCourseQuizzes returns quizzes for admin', async () => {
  const result = await quizService.listCourseQuizzes({ courseId: 'course-1', role: 'ADMIN', userId: 'user-admin-1' });
  assert.strictEqual(result.quizzes.length, 3);
  assert.ok(result.quizzes.every((q: any) => q.courseId === 'course-1'));
});

test('listCourseQuizzes filters published for student role', async () => {
  const result = await quizService.listCourseQuizzes({ courseId: 'course-1', role: 'STUDENT', userId: 'user-student-1' });
  assert.strictEqual(result.quizzes.length, 2);
  assert.ok(result.quizzes.every((q: any) => q.status === 'PUBLISHED'));
});

test('listCourseQuizzes throws ForbiddenError for unenrolled student', async () => {
  await assert.rejects(
    () => quizService.listCourseQuizzes({ courseId: 'course-1', role: 'STUDENT', userId: 'user-student-2' }),
    (err: any) => err instanceof ForbiddenError
  );
});

test('getQuizDetails returns quiz with full options for owner teacher', async () => {
  const result = await quizService.getQuizDetails({ quizId: 'quiz-1', role: 'TEACHER', userId: 'user-teacher-1' });
  assert.strictEqual(result.quiz.id, 'quiz-1');
  assert.strictEqual(result.quiz.questions.length, 2);
  // Teacher sees isCorrect flags
  const question = result.quiz.questions[0];
  assert.ok(question.options.some((o: any) => o.isCorrect === true));
});

test('getQuizDetails throws ForbiddenError for non-owner teacher', async () => {
  await assert.rejects(
    () => quizService.getQuizDetails({ quizId: 'quiz-1', role: 'TEACHER', userId: 'user-teacher-2' }),
    (err: any) => err instanceof ForbiddenError
  );
});

test('getQuizDetails never leaks correct answers to students', async () => {
  const result = await quizService.getQuizDetails({ quizId: 'quiz-1', role: 'STUDENT', userId: 'user-student-1' });
  assert.strictEqual(result.quiz.id, 'quiz-1');
  assert.strictEqual(result.quiz.questions.length, 2);
  for (const question of result.quiz.questions) {
    for (const option of question.options) {
      assert.strictEqual(option.isCorrect, undefined, 'isCorrect must not be exposed to students');
    }
  }
});

test('getQuizDetails throws ForbiddenError for draft quiz to student', async () => {
  await assert.rejects(
    () => quizService.getQuizDetails({ quizId: 'quiz-draft', role: 'STUDENT', userId: 'user-student-1' }),
    (err: any) => err instanceof ForbiddenError
  );
});

test('createQuiz validates required title', async () => {
  await assert.rejects(
    () => quizService.createQuiz({ actorId: 'user-teacher-1', courseId: 'course-1', data: { title: '' } }),
    (err: any) => err instanceof ValidationError
  );
});

test('createQuiz validates time limit', async () => {
  await assert.rejects(
    () => quizService.createQuiz({ actorId: 'user-teacher-1', courseId: 'course-1', data: { title: 'Quiz', timeLimit: 0 } }),
    (err: any) => err instanceof ValidationError
  );
});

test('createQuiz validates max attempts', async () => {
  await assert.rejects(
    () => quizService.createQuiz({ actorId: 'user-teacher-1', courseId: 'course-1', data: { title: 'Quiz', maxAttempts: 0 } }),
    (err: any) => err instanceof ValidationError
  );
});

test('createQuiz validates question requires at least 2 options', async () => {
  await assert.rejects(
    () =>
      quizService.createQuiz({
        actorId: 'user-teacher-1',
        courseId: 'course-1',
        data: {
          title: 'Quiz',
          questions: [{ prompt: 'Q1', options: [{ optionText: 'A', isCorrect: true }] }],
        },
      }),
    (err: any) => err instanceof ValidationError
  );
});

test('createQuiz validates single choice needs exactly one correct option', async () => {
  await assert.rejects(
    () =>
      quizService.createQuiz({
        actorId: 'user-teacher-1',
        courseId: 'course-1',
        data: {
          title: 'Quiz',
          questions: [
            {
              prompt: 'Q1',
              type: 'SINGLE_CHOICE',
              options: [
                { optionText: 'A', isCorrect: true },
                { optionText: 'B', isCorrect: true },
              ],
            },
          ],
        },
      }),
    (err: any) => err instanceof ValidationError
  );
});

test('createQuiz throws ForbiddenError for non-owner teacher', async () => {
  await assert.rejects(
    () => quizService.createQuiz({ actorId: 'user-teacher-2', courseId: 'course-1', data: { title: 'Quiz' } }),
    (err: any) => err instanceof ForbiddenError
  );
});

test('createQuiz creates quiz with questions and audit log', async () => {
  const quiz = await quizService.createQuiz({
    actorId: 'user-teacher-1',
    courseId: 'course-1',
    data: {
      title: 'Physics Quiz 1',
      description: 'Mechanics',
      timeLimit: 15,
      maxAttempts: 3,
      status: 'PUBLISHED',
      questions: [
        {
          prompt: 'What is velocity?',
          type: 'SINGLE_CHOICE',
          points: 2,
          options: [
            { optionText: 'Speed', isCorrect: false },
            { optionText: 'Speed with direction', isCorrect: true },
          ],
        },
      ],
    },
    ipAddress: '127.0.0.1',
  });
  assert.strictEqual(quiz.title, 'Physics Quiz 1');
  assert.strictEqual(quiz.courseId, 'course-1');
  assert.strictEqual(quiz.status, 'PUBLISHED');
  assert.strictEqual(quiz.timeLimit, 15);
  assert.strictEqual(state.auditLogs.some((l: any) => l.action === 'QUIZ_CREATED'), true);
});

test('updateQuiz throws ForbiddenError for non-owner teacher', async () => {
  await assert.rejects(
    () => quizService.updateQuiz({ actorId: 'user-teacher-2', quizId: 'quiz-1', data: { title: 'Hacked' } }),
    (err: any) => err instanceof ForbiddenError
  );
});

test('updateQuiz updates status with audit log', async () => {
  const updated = await quizService.updateQuiz({
    actorId: 'user-teacher-1',
    quizId: 'quiz-draft',
    data: { status: 'PUBLISHED', timeLimit: 20 },
    ipAddress: '127.0.0.1',
  });
  assert.strictEqual(updated.status, 'PUBLISHED');
  assert.strictEqual(updated.timeLimit, 20);
  assert.ok(updated.publishedAt);
  assert.strictEqual(state.auditLogs.some((l: any) => l.action === 'QUIZ_UPDATED'), true);
});

test('archiveQuiz archives quiz with audit log', async () => {
  const updated = await quizService.archiveQuiz({ actorId: 'user-teacher-1', quizId: 'quiz-single' });
  assert.strictEqual(updated.status, 'ARCHIVED');
  assert.strictEqual(state.auditLogs.some((l: any) => l.action === 'QUIZ_ARCHIVED'), true);
});

// ---------------------------------------------------------------
// Tests - Questions
// ---------------------------------------------------------------

test('addQuestion creates question with options', async () => {
  const question = await quizService.addQuestion({
    actorId: 'user-teacher-1',
    quizId: 'quiz-1',
    data: {
      prompt: 'What is 10/2?',
      type: 'SINGLE_CHOICE',
      points: 1,
      options: [
        { optionText: '4', isCorrect: false },
        { optionText: '5', isCorrect: true },
      ],
    },
    ipAddress: '127.0.0.1',
  });
  assert.strictEqual(question.prompt, 'What is 10/2?');
  assert.strictEqual(question.options.length, 2);
  assert.strictEqual(state.auditLogs.some((l: any) => l.action === 'QUIZ_QUESTION_ADDED'), true);
});

test('addQuestion validates at least 2 options', async () => {
  await assert.rejects(
    () =>
      quizService.addQuestion({
        actorId: 'user-teacher-1',
        quizId: 'quiz-1',
        data: { prompt: 'Q', options: [{ optionText: 'A', isCorrect: true }] },
      }),
    (err: any) => err instanceof ValidationError
  );
});

test('addQuestion throws ForbiddenError for non-owner teacher', async () => {
  await assert.rejects(
    () =>
      quizService.addQuestion({
        actorId: 'user-teacher-2',
        quizId: 'quiz-1',
        data: { prompt: 'Q', options: [{ optionText: 'A' }, { optionText: 'B', isCorrect: true }] },
      }),
    (err: any) => err instanceof ForbiddenError
  );
});

test('deleteQuestion deletes and audits', async () => {
  const result = await quizService.deleteQuestion({
    actorId: 'user-teacher-1',
    questionId: 'question-1',
    ipAddress: '127.0.0.1',
  });
  assert.strictEqual(result.deleted, true);
  assert.strictEqual(state.auditLogs.some((l: any) => l.action === 'QUIZ_QUESTION_DELETED'), true);
});

// ---------------------------------------------------------------
// Tests - Attempts
// ---------------------------------------------------------------

test('startAttempt creates IN_PROGRESS attempt for enrolled student', async () => {
  const result = await quizService.startAttempt({ actorId: 'user-student-1', quizId: 'quiz-1' });
  assert.ok(result.attempt.id);
  assert.ok(result.attempt.expiresAt > new Date());
  assert.strictEqual(result.quiz.title, 'Math Quiz 1');
  assert.strictEqual(result.quiz.questions.length, 2);
  // Questions must not include isCorrect for student attempts
  for (const question of result.quiz.questions) {
    for (const option of question.options) {
      assert.strictEqual(option.isCorrect, undefined);
    }
  }
});

test('startAttempt throws ForbiddenError for unenrolled student', async () => {
  await assert.rejects(
    () => quizService.startAttempt({ actorId: 'user-student-2', quizId: 'quiz-1' }),
    (err: any) => err instanceof ForbiddenError
  );
});

test('startAttempt throws ForbiddenError for draft quiz', async () => {
  // Fresh draft quiz so earlier tests mutating quiz-draft cannot affect this test
  const draft: any = {
    ...mockQuiz,
    id: 'quiz-draft-fresh',
    title: 'Fresh Draft Quiz',
    status: 'DRAFT',
    publishedAt: null,
    questions: [],
  };
  state.quizzes.push(draft);
  await assert.rejects(
    () => quizService.startAttempt({ actorId: 'user-student-1', quizId: 'quiz-draft-fresh' }),
    (err: any) => err instanceof ForbiddenError
  );
});

test('startAttempt enforces max attempts limit', async () => {
  // Self-contained fixture: fresh quiz with maxAttempts 1 and one completed attempt
  const single: any = {
    ...mockQuiz,
    id: 'quiz-single-fresh',
    title: 'Fresh Single Attempt Quiz',
    maxAttempts: 1,
  };
  state.quizzes.push(single);
  state.attempts.push({
    id: 'attempt-single-fresh-done',
    quizId: 'quiz-single-fresh',
    studentId: 'student-1',
    status: 'SUBMITTED',
    startedAt: new Date(Date.now() - 60 * 1000),
    submittedAt: new Date(),
    expiresAt: new Date(Date.now() - 60 * 1000),
    score: 2,
    maxScore: 4,
    quiz: single,
    answers: [],
  });

  await assert.rejects(
    () => quizService.startAttempt({ actorId: 'user-student-1', quizId: 'quiz-single-fresh' }),
    (err: any) => err instanceof ConflictError
  );
});

test('submitAttempt auto-grades correct answers', async () => {
  const result = await quizService.submitAttempt({
    actorId: 'user-student-1',
    attemptId: 'attempt-1',
    answers: [
      { questionId: 'question-1', optionIds: ['option-2'] }, // correct
      { questionId: 'question-2', optionIds: ['option-4'] }, // correct
    ],
    ipAddress: '127.0.0.1',
  });
  assert.strictEqual(result.score, 4);
  assert.strictEqual(result.maxScore, 4);
  assert.strictEqual(result.status, 'SUBMITTED');
  assert.strictEqual(result.expired, false);
  // Audit log and notification created
  assert.strictEqual(state.auditLogs.some((l: any) => l.action === 'QUIZ_ATTEMPT_SUBMITTED'), true);
  const note = state.notifications.find((n: any) => n.type === 'QUIZ_RESULT');
  assert.ok(note, 'QUIZ_RESULT notification should exist');
  assert.strictEqual(note.userId, 'user-student-1');
});

test('submitAttempt scores partial credit (half correct)', async () => {
  const attempt = freshAttempt({ id: 'attempt-partial' });
  state.attempts.push(attempt);
  const result = await quizService.submitAttempt({
    actorId: 'user-student-1',
    attemptId: 'attempt-partial',
    answers: [
      { questionId: 'question-1', optionIds: ['option-2'] }, // correct
      { questionId: 'question-2', optionIds: ['option-3'] }, // wrong
    ],
  });
  assert.strictEqual(result.score, 2);
  assert.strictEqual(result.maxScore, 4);
});

test('submitAttempt rejects wrong answer set for single choice', async () => {
  // question-1 is SINGLE_CHOICE; passing 2 options should fail (set mismatch)
  const attempt = freshAttempt();
  state.attempts.push(attempt);
  const result = await quizService.submitAttempt({
    actorId: 'user-student-1',
    attemptId: attempt.id,
    answers: [
      { questionId: 'question-1', optionIds: ['option-1', 'option-2'] }, // 2 options = wrong
    ],
  });
  assert.strictEqual(result.score, 0);
});

test('submitAttempt marks expired attempts as TIME_EXPIRED with score still graded', async () => {
  const result = await quizService.submitAttempt({
    actorId: 'user-student-1',
    attemptId: 'attempt-expired',
    answers: [
      { questionId: 'question-1', optionIds: ['option-2'] }, // correct
      { questionId: 'question-2', optionIds: ['option-4'] }, // correct
    ],
  });
  assert.strictEqual(result.status, 'TIME_EXPIRED');
  assert.strictEqual(result.expired, true);
  assert.strictEqual(result.score, 4);
  assert.strictEqual(result.maxScore, 4);
});

test('submitAttempt throws ConflictError for already-submitted attempt', async () => {
  const attempt = freshAttempt({ status: 'SUBMITTED', submittedAt: new Date(), score: 2, maxScore: 4 });
  state.attempts.push(attempt);
  await assert.rejects(
    () => quizService.submitAttempt({ actorId: 'user-student-1', attemptId: attempt.id, answers: [] }),
    (err: any) => err instanceof ConflictError
  );
});

test('submitAttempt throws ForbiddenError for another student attempt', async () => {
  await assert.rejects(
    () => quizService.submitAttempt({ actorId: 'user-student-2', attemptId: 'attempt-1', answers: [] }),
    (err: any) => err instanceof ForbiddenError
  );
});

test('submitAttempt throws NotFoundError for missing attempt', async () => {
  await assert.rejects(
    () => quizService.submitAttempt({ actorId: 'user-student-1', attemptId: 'missing', answers: [] }),
    (err: any) => err instanceof NotFoundError
  );
});

// ---------------------------------------------------------------
// Tests - Results and Attempt detail
// ---------------------------------------------------------------

test('getQuizResults returns all attempts for owner teacher', async () => {
  const result = await quizService.getQuizResults({ quizId: 'quiz-1', role: 'TEACHER', userId: 'user-teacher-1' });
  assert.strictEqual(result.quiz.id, 'quiz-1');
  assert.ok(result.attempts.length >= 1);
});

test('getQuizResults throws ForbiddenError for non-owner teacher', async () => {
  await assert.rejects(
    () => quizService.getQuizResults({ quizId: 'quiz-1', role: 'TEACHER', userId: 'user-teacher-2' }),
    (err: any) => err instanceof ForbiddenError
  );
});

test('getQuizResults returns only own attempts for student', async () => {
  const result = await quizService.getQuizResults({ quizId: 'quiz-1', role: 'STUDENT', userId: 'user-student-1' });
  assert.ok(
    result.attempts.every((a: any) => a.studentId === 'student-1'),
    'Student should only see their own attempts'
  );
});

test('getQuizResults throws ForbiddenError for unenrolled student', async () => {
  await assert.rejects(
    () => quizService.getQuizResults({ quizId: 'quiz-1', role: 'STUDENT', userId: 'user-student-2' }),
    (err: any) => err instanceof ForbiddenError
  );
});

test('getAttemptDetail throws ForbiddenError for student viewing another student attempt', async () => {
  await assert.rejects(
    () => quizService.getAttemptDetail({ attemptId: 'attempt-1', role: 'STUDENT', userId: 'user-student-2' }),
    (err: any) => err instanceof ForbiddenError
  );
});