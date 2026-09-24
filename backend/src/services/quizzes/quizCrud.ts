// Quiz CRUD and detail reads (REFACTORING_PLAN Stage 3). Questions and
// attempts live in sibling modules.
import prisma from '../../prisma/client';
import { Prisma } from '@prisma/client';
import { NotFoundError, ForbiddenError, ValidationError } from '../../utils/errors';
import { writeAuditLog } from '../auditService';
import { requireCourseAccess, isAdminRole, adminOverrideMeta } from '../../shared/accessPolicy';
import {
  assertQuizStatus,
  buildPagination,
  buildQuestionCreateData,
  userInfoSelect,
  validateQuestion,
} from './shared';
import type { QuestionInput } from './shared';

interface PaginationParams {
  page?: number;
  pageSize?: number;
}

interface ListCourseQuizzesParams extends PaginationParams {
  courseId: string;
  role: string;
  userId: string;
}

async function listCourseQuizzes({ courseId, role, userId, page = 1, pageSize = 20 }: ListCourseQuizzesParams) {
  // Enforce course access (teacher owner, enrolled student, or admin)
  await requireCourseAccess({ courseId, role, userId });

  const where: Prisma.QuizWhereInput = { courseId };
  if (role === 'STUDENT') {
    where.status = 'PUBLISHED';
  } else {
    where.status = { not: 'ARCHIVED' };
  }

  const [quizzes, total] = await Promise.all([
    prisma.quiz.findMany({
      where,
      include: {
        _count: { select: { questions: true, attempts: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.quiz.count({ where }),
  ]);

  return { quizzes, pagination: buildPagination(total, page, pageSize) };
}

interface GetQuizParams {
  quizId: string;
  role: string;
  userId: string;
}

/**
 * Loads a quiz (without correct answers for students unless allowed).
 */
async function getQuizDetails({ quizId, role, userId }: GetQuizParams) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      course: {
        include: {
          teacher: { include: { user: { select: userInfoSelect } } },
        },
      },
      questions: {
        include: { options: true },
        orderBy: { orderIndex: 'asc' },
      },
    },
  });
  if (!quiz) throw new NotFoundError('Quiz not found');

  // Admin can view everything
  if (role === 'ADMIN') {
    return { quiz };
  }

  // Teacher must own the course
  if (role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({ where: { userId } });
    if (!teacher || teacher.id !== quiz.course.teacherId) {
      throw new ForbiddenError('You can only view quizzes in your own courses');
    }
    return { quiz };
  }

  // Student must be enrolled and the quiz must be published
  if (role === 'STUDENT') {
    if (quiz.course.status !== 'ACTIVE' || quiz.status !== 'PUBLISHED') {
      throw new ForbiddenError('This quiz is not available yet');
    }
    const student = await prisma.student.findUnique({ where: { userId } });
    if (!student) throw new NotFoundError('Student profile not found');
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId: quiz.courseId, studentId: student.id } },
    });
    if (!enrollment || enrollment.status !== 'ACTIVE') {
      throw new ForbiddenError('You are not enrolled in this course');
    }

    // Strip answer keys from options when returning quiz details to students
    const sanitizedQuiz = {
      ...quiz,
      questions: quiz.questions.map((question: any) => ({
        ...question,
        options: question.options.map((option: any) => {
          const { isCorrect, ...rest } = option;
          void isCorrect;
          return rest;
        }),
      })),
    };

    // Include the student's attempt history
    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId, studentId: student.id },
      orderBy: { startedAt: 'desc' },
    });
    return { quiz: sanitizedQuiz, attempts };
  }

  throw new ForbiddenError('You do not have access to this quiz');
}

interface CreateQuizParams {
  actorId: string;
  courseId: string;
  data: {
    title: string;
    description?: string;
    timeLimit?: number;
    maxAttempts?: number;
    shuffleQuestions?: boolean;
    shuffleOptions?: boolean;
    status?: string;
    questions?: QuestionInput[];
  };
  ipAddress?: string | null;
}

async function createQuiz({ actorId, courseId, data, ipAddress }: CreateQuizParams) {
  const title = (data.title || '').trim();
  if (!title) {
    throw new ValidationError('Quiz title is required');
  }
  const timeLimit = Number(data.timeLimit ?? 10);
  if (!Number.isInteger(timeLimit) || timeLimit < 1 || timeLimit > 300) {
    throw new ValidationError('Time limit must be between 1 and 300 minutes');
  }
  const maxAttempts = Number(data.maxAttempts ?? 1);
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) {
    throw new ValidationError('Max attempts must be between 1 and 10');
  }
  const status = assertQuizStatus(data.status);

  // Validate questions before create
  const questions = (data.questions || []).filter((q) => q && (q.prompt || '').trim() !== '');
  questions.forEach((question, index) => validateQuestion(question, index));

  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!teacher) throw new NotFoundError('Teacher profile not found');

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new NotFoundError('Course not found');
  if (course.teacherId !== teacher.id) {
    throw new ForbiddenError('You can only create quizzes in your own courses');
  }

  const quiz = await prisma.quiz.create({
    data: {
      courseId,
      title,
      description: data.description || null,
      timeLimit,
      maxAttempts,
      shuffleQuestions: Boolean(data.shuffleQuestions),
      shuffleOptions: Boolean(data.shuffleOptions),
      status,
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
      createdById: actorId,
      questions: questions.length > 0 ? { create: buildQuestionCreateData(questions) } : undefined,
    },
    include: {
      course: { include: { teacher: { include: { user: { select: userInfoSelect } } } } },
      questions: { include: { options: true }, orderBy: { orderIndex: 'asc' } },
    },
  });

  await writeAuditLog({
    actorId,
    action: 'QUIZ_CREATED',
    entity: 'Quiz',
    entityId: quiz.id,
    metadata: {
      courseId,
      title,
      timeLimit,
      maxAttempts,
      status,
      questionCount: questions.length,
    },
    ipAddress,
  });

  return quiz;
}

interface UpdateQuizParams {
  actorId: string;
  actorRole?: string;
  quizId: string;
  data: {
    title?: string;
    description?: string | null;
    timeLimit?: number | string;
    maxAttempts?: number | string;
    shuffleQuestions?: boolean;
    shuffleOptions?: boolean;
    status?: string;
  };
  ipAddress?: string | null;
}

async function updateQuiz({ actorId, actorRole, quizId, data, ipAddress }: UpdateQuizParams) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { course: true },
  });
  if (!quiz) throw new NotFoundError('Quiz not found');

  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!isAdminRole(actorRole) && (!teacher || teacher.id !== quiz.course.teacherId)) {
    throw new ForbiddenError('You can only manage quizzes in your own courses');
  }

  const updateData: Prisma.QuizUpdateInput = {};

  if (data.title !== undefined) {
    const title = (data.title || '').trim();
    if (!title) throw new ValidationError('Quiz title cannot be empty');
    updateData.title = title;
  }
  if (data.description !== undefined) {
    updateData.description = data.description || null;
  }
  if (data.timeLimit !== undefined) {
    const timeLimit = Number(data.timeLimit);
    if (!Number.isInteger(timeLimit) || timeLimit < 1 || timeLimit > 300) {
      throw new ValidationError('Time limit must be between 1 and 300 minutes');
    }
    updateData.timeLimit = timeLimit;
  }
  if (data.maxAttempts !== undefined) {
    const maxAttempts = Number(data.maxAttempts);
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) {
      throw new ValidationError('Max attempts must be between 1 and 10');
    }
    updateData.maxAttempts = maxAttempts;
  }
  if (data.shuffleQuestions !== undefined) updateData.shuffleQuestions = Boolean(data.shuffleQuestions);
  if (data.shuffleOptions !== undefined) updateData.shuffleOptions = Boolean(data.shuffleOptions);
  if (data.status !== undefined) {
    const status = assertQuizStatus(data.status);
    updateData.status = status;
    // Set or clear publishedAt when transitioning to/from PUBLISHED
    if (status === 'PUBLISHED' && quiz.status !== 'PUBLISHED') {
      updateData.publishedAt = new Date();
    } else if (status !== 'PUBLISHED' && quiz.status === 'PUBLISHED') {
      updateData.publishedAt = null;
    }
  }

  const updated = await prisma.quiz.update({
    where: { id: quizId },
    data: updateData,
    include: {
      course: { include: { teacher: { include: { user: { select: userInfoSelect } } } } },
    },
  });

  await writeAuditLog({
    actorId,
    action: 'QUIZ_UPDATED',
    entity: 'Quiz',
    entityId: quizId,
    metadata: {
      courseId: quiz.courseId,
      title: updated.title,
      status: updated.status,
      ...adminOverrideMeta(actorRole, quiz.course.teacherId),
    },
    ipAddress,
  });

  return updated;
}

interface ArchiveQuizParams {
  actorId: string;
  actorRole?: string;
  quizId: string;
  ipAddress?: string | null;
}

async function archiveQuiz({ actorId, actorRole, quizId, ipAddress }: ArchiveQuizParams) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { course: true },
  });
  if (!quiz) throw new NotFoundError('Quiz not found');

  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!isAdminRole(actorRole) && (!teacher || teacher.id !== quiz.course.teacherId)) {
    throw new ForbiddenError('You can only archive quizzes in your own courses');
  }

  const updated = await prisma.quiz.update({
    where: { id: quizId },
    data: { status: 'ARCHIVED' },
  });

  await writeAuditLog({
    actorId,
    action: 'QUIZ_ARCHIVED',
    entity: 'Quiz',
    entityId: quizId,
    metadata: {
      courseId: quiz.courseId,
      title: quiz.title,
      ...adminOverrideMeta(actorRole, quiz.course.teacherId),
    },
    ipAddress,
  });

  return updated;
}

export { listCourseQuizzes, getQuizDetails, createQuiz, updateQuiz, archiveQuiz };
