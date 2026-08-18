// Quiz service - quiz CRUD, questions, attempts, auto-grading, and results.
import prismaModule from '../prisma/client';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../utils/errors';
import { writeAuditLog } from './auditService';
import { createNotification } from './notificationService';
import { getCourse as getCourseWithAccess } from './courseService';

// Cast to any to work around Prisma type resolution in monorepo
const prisma = prismaModule as any;

type QuizStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
type QuizQuestionType = 'MULTIPLE_CHOICE' | 'SINGLE_CHOICE';
type QuizAttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'TIME_EXPIRED';

const QUIZ_STATUSES: QuizStatus[] = ['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'];
const QUESTION_TYPES: QuizQuestionType[] = ['MULTIPLE_CHOICE', 'SINGLE_CHOICE'];

interface PaginationParams {
  page?: number;
  pageSize?: number;
}

const userInfoSelect = { id: true, fullName: true, email: true };

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function buildPagination(total: number, page: number, pageSize: number) {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

function assertQuizStatus(status: string | undefined): QuizStatus {
  if (status !== undefined && !QUIZ_STATUSES.includes(status as QuizStatus)) {
    throw new ValidationError('Invalid quiz status');
  }
  return (status || 'DRAFT') as QuizStatus;
}

function assertQuestionType(type: string | undefined): QuizQuestionType {
  if (type !== undefined && !QUESTION_TYPES.includes(type as QuizQuestionType)) {
    throw new ValidationError('Invalid question type');
  }
  return (type || 'SINGLE_CHOICE') as QuizQuestionType;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface QuestionInput {
  id?: string;
  prompt?: string;
  type?: string;
  points?: number;
  orderIndex?: number;
  options?: Array<{
    id?: string;
    optionText?: string;
    isCorrect?: boolean;
    orderIndex?: number;
  }>;
}

function validateQuestion(question: QuestionInput, index: number) {
  const prompt = (question.prompt || '').trim();
  if (!prompt) {
    throw new ValidationError(`Question ${index + 1}: prompt is required`);
  }
  const type = assertQuestionType(question.type);
  const points = Number(question.points ?? 1);
  if (!Number.isInteger(points) || points < 1) {
    throw new ValidationError(`Question ${index + 1}: points must be a positive whole number`);
  }

  const options = (question.options || []).filter((o) => o && (o.optionText || '').trim());
  if (options.length < 2) {
    throw new ValidationError(`Question ${index + 1}: at least 2 options are required`);
  }
  if (options.length > 6) {
    throw new ValidationError(`Question ${index + 1}: at most 6 options are allowed`);
  }
  const correctCount = options.filter((o) => Boolean(o.isCorrect)).length;
  if (type === 'SINGLE_CHOICE' && correctCount !== 1) {
    throw new ValidationError(`Question ${index + 1}: single-choice questions must have exactly one correct option`);
  }
  if (type === 'MULTIPLE_CHOICE' && correctCount < 1) {
    throw new ValidationError(`Question ${index + 1}: multiple-choice questions must have at least one correct option`);
  }
  for (const option of options) {
    if (!(option.optionText || '').trim()) {
      throw new ValidationError(`Question ${index + 1}: option text is required`);
    }
  }
}

/**
 * Build a nested create payload for a quiz with questions and options.
 */
function buildQuestionCreateData(questions: QuestionInput[]) {
  return questions.map((question, index) => ({
    prompt: (question.prompt || '').trim(),
    type: assertQuestionType(question.type),
    points: Number(question.points ?? 1),
    orderIndex: Number(question.orderIndex ?? index),
    options: {
      create: (question.options || [])
        .filter((o) => o && (o.optionText || '').trim() !== '')
        .map((option, optionIndex) => ({
          optionText: (option.optionText || '').trim(),
          isCorrect: Boolean(option.isCorrect),
          orderIndex: Number(option.orderIndex ?? optionIndex),
        })),
    },
  }));
}

// ---------------------------------------------------------------
// Quiz CRUD
// ---------------------------------------------------------------

interface ListCourseQuizzesParams extends PaginationParams {
  courseId: string;
  role: string;
  userId: string;
}

async function listCourseQuizzes({ courseId, role, userId, page = 1, pageSize = 20 }: ListCourseQuizzesParams) {
  // Enforce course access (teacher owner, enrolled student, or admin)
  await getCourseWithAccess({ courseId, role, userId });

  const where: Record<string, unknown> = { courseId };
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

async function updateQuiz({ actorId, quizId, data, ipAddress }: UpdateQuizParams) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { course: true },
  });
  if (!quiz) throw new NotFoundError('Quiz not found');

  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!teacher || teacher.id !== quiz.course.teacherId) {
    throw new ForbiddenError('You can only manage quizzes in your own courses');
  }

  const updateData: Record<string, unknown> = {};

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
    metadata: { courseId: quiz.courseId, title: updated.title, status: updated.status },
    ipAddress,
  });

  return updated;
}

interface ArchiveQuizParams {
  actorId: string;
  quizId: string;
  ipAddress?: string | null;
}

async function archiveQuiz({ actorId, quizId, ipAddress }: ArchiveQuizParams) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { course: true },
  });
  if (!quiz) throw new NotFoundError('Quiz not found');

  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!teacher || teacher.id !== quiz.course.teacherId) {
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
    metadata: { courseId: quiz.courseId, title: quiz.title },
    ipAddress,
  });

  return updated;
}

// ---------------------------------------------------------------
// Questions - manage quiz questions and options
// ---------------------------------------------------------------

interface AddQuestionParams {
  actorId: string;
  quizId: string;
  data: QuestionInput;
  ipAddress?: string | null;
}

async function addQuestion({ actorId, quizId, data, ipAddress }: AddQuestionParams) {
  validateQuestion(data, 0);

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { course: true },
  });
  if (!quiz) throw new NotFoundError('Quiz not found');

  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!teacher || teacher.id !== quiz.course.teacherId) {
    throw new ForbiddenError('You can only manage questions in your own courses');
  }

  const question = await prisma.quizQuestion.create({
    data: {
      quizId,
      prompt: (data.prompt || '').trim(),
      type: assertQuestionType(data.type),
      points: Number(data.points ?? 1),
      orderIndex: Number(data.orderIndex ?? quiz.questions.length),
      options: {
        create: (data.options || [])
          .filter((o) => o && (o.optionText || '').trim() !== '')
          .map((option, optionIndex) => ({
            optionText: (option.optionText || '').trim(),
            isCorrect: Boolean(option.isCorrect),
            orderIndex: Number(option.orderIndex ?? optionIndex),
          })),
      },
    },
    include: { options: true },
  });

  await writeAuditLog({
    actorId,
    action: 'QUIZ_QUESTION_ADDED',
    entity: 'QuizQuestion',
    entityId: question.id,
    metadata: { quizId },
    ipAddress,
  });

  return question;
}

interface UpdateQuestionParams {
  actorId: string;
  questionId: string;
  data: QuestionInput;
  ipAddress?: string | null;
}

async function updateQuestion({ actorId, questionId, data, ipAddress }: UpdateQuestionParams) {
  const existing = await prisma.quizQuestion.findUnique({
    where: { id: questionId },
    include: { quiz: { include: { course: true } } },
  });
  if (!existing) throw new NotFoundError('Question not found');

  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!teacher || teacher.id !== existing.quiz.course.teacherId) {
    throw new ForbiddenError('You can only manage questions in your own courses');
  }

  // If options are provided, validate the full question
  if (data.options && data.options.length > 0) {
    validateQuestion(
      {
        prompt: data.prompt ?? existing.prompt,
        type: data.type ?? existing.type,
        points: data.points ?? existing.points,
        options: data.options,
      },
      0
    );
  }

  const updateData: Record<string, unknown> = {};
  if (data.prompt !== undefined) {
    const prompt = (data.prompt || '').trim();
    if (!prompt) throw new ValidationError('Question prompt is required');
    updateData.prompt = prompt;
  }
  if (data.type !== undefined) updateData.type = assertQuestionType(data.type);
  if (data.points !== undefined) {
    const points = Number(data.points);
    if (!Number.isInteger(points) || points < 1) {
      throw new ValidationError('Points must be a positive whole number');
    }
    updateData.points = points;
  }
  if (data.orderIndex !== undefined) updateData.orderIndex = Number(data.orderIndex);

  // If options are provided, replace them (delete and recreate for correctness)
  if (data.options && data.options.length > 0) {
    const options = data.options
      .filter((o) => o && (o.optionText || '').trim() !== '')
      .map((option, optionIndex) => ({
        optionText: (option.optionText || '').trim(),
        isCorrect: Boolean(option.isCorrect),
        orderIndex: Number(option.orderIndex ?? optionIndex),
      }));

    const [updated] = await Promise.all([
      prisma.quizQuestion.update({
        where: { id: questionId },
        data: {
          ...updateData,
          options: { deleteMany: {}, create: options },
        },
        include: { options: true },
      }),
    ]);

    await writeAuditLog({
      actorId,
      action: 'QUIZ_QUESTION_UPDATED',
      entity: 'QuizQuestion',
      entityId: questionId,
      metadata: { quizId: existing.quizId },
      ipAddress,
    });

    return updated;
  }

  const updated = await prisma.quizQuestion.update({
    where: { id: questionId },
    data: updateData,
    include: { options: true },
  });

  await writeAuditLog({
    actorId,
    action: 'QUIZ_QUESTION_UPDATED',
    entity: 'QuizQuestion',
    entityId: questionId,
    metadata: { quizId: existing.quizId },
    ipAddress,
  });

  return updated;
}

interface DeleteQuestionParams {
  actorId: string;
  questionId: string;
  ipAddress?: string | null;
}

async function deleteQuestion({ actorId, questionId, ipAddress }: DeleteQuestionParams) {
  const existing = await prisma.quizQuestion.findUnique({
    where: { id: questionId },
    include: { quiz: { include: { course: true } } },
  });
  if (!existing) throw new NotFoundError('Question not found');

  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!teacher || teacher.id !== existing.quiz.course.teacherId) {
    throw new ForbiddenError('You can only manage questions in your own courses');
  }

  await prisma.quizQuestion.delete({ where: { id: questionId } });

  await writeAuditLog({
    actorId,
    action: 'QUIZ_QUESTION_DELETED',
    entity: 'QuizQuestion',
    entityId: questionId,
    metadata: { quizId: existing.quizId },
    ipAddress,
  });

  return { id: questionId, deleted: true };
}

// ---------------------------------------------------------------
// Attempts - start, submit, auto-grade
// ---------------------------------------------------------------

interface StartAttemptParams {
  actorId: string;
  quizId: string;
  ipAddress?: string | null;
}

async function startAttempt({ actorId, quizId, ipAddress }: StartAttemptParams) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      course: true,
      questions: { include: { options: true }, orderBy: { orderIndex: 'asc' } },
      _count: { select: { attempts: true } },
    },
  });
  if (!quiz) throw new NotFoundError('Quiz not found');

  if (quiz.course.status !== 'ACTIVE' || quiz.status !== 'PUBLISHED') {
    throw new ForbiddenError('This quiz is not open for attempts');
  }

  const student = await prisma.student.findUnique({ where: { userId: actorId } });
  if (!student) throw new NotFoundError('Student profile not found');

  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { courseId_studentId: { courseId: quiz.courseId, studentId: student.id } },
  });
  if (!enrollment || enrollment.status !== 'ACTIVE') {
    throw new ForbiddenError('You must be enrolled in this course to take quizzes');
  }

  // Count completed attempts (submitted or expired)
  const attemptCount = await prisma.quizAttempt.count({
    where: { quizId, studentId: student.id, status: { in: ['SUBMITTED', 'TIME_EXPIRED'] } },
  });
  if (attemptCount >= quiz.maxAttempts) {
    throw new ConflictError(`You have used all ${quiz.maxAttempts} attempt(s) for this quiz`);
  }

  // Calculate required max score from question points
  const maxScore = quiz.questions.reduce((sum: number, q: any) => sum + Number(q.points || 1), 0);

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + quiz.timeLimit * 60 * 1000);

  const attempt = await prisma.quizAttempt.create({
    data: {
      quizId,
      studentId: student.id,
      startedAt,
      expiresAt,
      maxScore,
    },
    include: {
      quiz: { include: { course: true } },
      student: { include: { user: { select: userInfoSelect } } },
    },
  });

  // Build the question payload for the student (no correct answers)
  let questions = quiz.questions.map((question: any) => {
    let options = question.options.map((option: any) => ({
      id: option.id,
      optionText: option.optionText,
      orderIndex: option.orderIndex,
    }));
    if (quiz.shuffleOptions) options = shuffle(options);
    return {
      id: question.id,
      prompt: question.prompt,
      type: question.type,
      points: question.points,
      orderIndex: question.orderIndex,
      options,
    };
  });
  if (quiz.shuffleQuestions) questions = shuffle(questions);

  await writeAuditLog({
    actorId,
    action: 'QUIZ_ATTEMPT_STARTED',
    entity: 'QuizAttempt',
    entityId: attempt.id,
    metadata: { quizId, timeLimit: quiz.timeLimit, expiresAt: expiresAt.toISOString() },
    ipAddress,
  });

  return {
    attempt: {
      id: attempt.id,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
    },
    quiz: {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      timeLimit: quiz.timeLimit,
      shuffleQuestions: quiz.shuffleQuestions,
      shuffleOptions: quiz.shuffleOptions,
      questions,
    },
  };
}

interface SubmitAttemptParams {
  actorId: string;
  attemptId: string;
  answers: Array<{ questionId: string; optionIds?: string[] | string }>;
  ipAddress?: string | null;
}

async function submitAttempt({ actorId, attemptId, answers, ipAddress }: SubmitAttemptParams) {
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: {
        include: {
          course: true,
          questions: { include: { options: true } },
        },
      },
      answers: true,
    },
  });
  if (!attempt) throw new NotFoundError('Attempt not found');

  const student = await prisma.student.findUnique({ where: { userId: actorId } });
  if (!student || student.id !== attempt.studentId) {
    throw new ForbiddenError('You can only submit your own quiz attempts');
  }

  if (attempt.status !== 'IN_PROGRESS') {
    throw new ConflictError('This attempt has already been submitted');
  }

  // Determine if the attempt expired (server-side enforcement)
  const now = new Date();
  const expired = now >= new Date(attempt.expiresAt);

  // Build question lookup
  const questionMap = new Map<string, any>();
  for (const question of attempt.quiz.questions) {
    questionMap.set(question.id, question);
  }

  // Auto-grade all submitted answers
  const answerData: any[] = [];
  let earned = 0;
  let total = 0;

  for (const question of attempt.quiz.questions) {
    total += Number(question.points || 1);
    const submitted = (answers || []).find((a) => a.questionId === question.id);
    if (!submitted) continue;

    const correctOptionIds = new Set(
      question.options.filter((o: any) => o.isCorrect).map((o: any) => o.id)
    );
    const selected: string[] = Array.isArray(submitted.optionIds)
      ? (submitted.optionIds as string[])
      : submitted.optionIds
        ? [submitted.optionIds as string]
        : [];

    // Determine answer correctness (anti-cheating: selected options must match correct set exactly)
    const isCorrect =
      selected.length === correctOptionIds.size &&
      selected.every((id) => correctOptionIds.has(id));

    const pointsEarned = isCorrect ? Number(question.points || 1) : 0;
    earned += pointsEarned;

    answerData.push({
      attemptId,
      questionId: question.id,
      optionId: selected.length > 0 ? selected[0] : null,
      isCorrect,
      pointsEarned,
    });
  }

  const finalStatus: QuizAttemptStatus = expired ? 'TIME_EXPIRED' : 'SUBMITTED';

  // Save answers, update attempt, audit, and notify in one transaction
  const result = await prisma.$transaction(async (tx: any) => {
    // Delete any pre-existing answers (safety for retries)
    await tx.quizAnswer.deleteMany({ where: { attemptId } });
    if (answerData.length > 0) {
      await tx.quizAnswer.createMany({ data: answerData });
    }

    const updated = await tx.quizAttempt.update({
      where: { id: attemptId },
      data: {
        status: finalStatus,
        submittedAt: now,
        score: earned,
        maxScore: total,
      },
      include: {
        quiz: { include: { course: true } },
        answers: true,
      },
    });

    await writeAuditLog(
      {
        actorId,
        action: 'QUIZ_ATTEMPT_SUBMITTED',
        entity: 'QuizAttempt',
        entityId: attemptId,
        metadata: {
          quizId: attempt.quizId,
          expired,
          score: earned,
          maxScore: total,
        },
        ipAddress,
      },
      tx
    );

    // Notify the student of their quiz result
    await createNotification(
      {
        userId: actorId,
        title: 'Quiz submitted',
        message: `Your quiz "${attempt.quiz.title}" scored ${earned}/${total}`,
        type: 'QUIZ_RESULT',
        metadata: {
          quizId: attempt.quizId,
          attemptId,
          score: earned,
          maxScore: total,
        },
      },
      tx
    );

    return updated;
  });

  return {
    attempt: result,
    score: earned,
    maxScore: total,
    status: finalStatus,
    expired,
  };
}

// ---------------------------------------------------------------
// Results
// ---------------------------------------------------------------

interface GetQuizResultsParams {
  quizId: string;
  role: string;
  userId: string;
}

/**
 * Teacher/admin view of all attempts with student info.
 * Student view of their own attempt history.
 */
async function getQuizResults({ quizId, role, userId }: GetQuizResultsParams) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { course: true },
  });
  if (!quiz) throw new NotFoundError('Quiz not found');

  // Teacher must own the course
  if (role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({ where: { userId } });
    if (!teacher || teacher.id !== quiz.course.teacherId) {
      throw new ForbiddenError('You can only view results for quizzes in your own courses');
    }
    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId },
      include: {
        student: { include: { user: { select: userInfoSelect } } },
        answers: { include: { question: true, option: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
    return { quiz, attempts };
  }

  // Student sees only their own results
  if (role === 'STUDENT') {
    const student = await prisma.student.findUnique({ where: { userId } });
    if (!student) throw new NotFoundError('Student profile not found');
    const enrolled = await prisma.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId: quiz.courseId, studentId: student.id } },
    });
    if (!enrolled || enrolled.status !== 'ACTIVE') {
      throw new ForbiddenError('You are not enrolled in this course');
    }
    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId, studentId: student.id },
      orderBy: { startedAt: 'desc' },
    });
    return { quiz, attempts };
  }

  // Admin sees all
  if (role === 'ADMIN') {
    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId },
      include: {
        student: { include: { user: { select: userInfoSelect } } },
        answers: true,
      },
      orderBy: { startedAt: 'desc' },
    });
    return { quiz, attempts };
  }

  throw new ForbiddenError('You do not have access to these results');
}

// ---------------------------------------------------------------
// Get single attempt (for resuming IN_PROGRESS attempts or viewing)
// ---------------------------------------------------------------

interface GetAttemptParams {
  attemptId: string;
  role: string;
  userId: string;
}

async function getAttemptDetail({ attemptId, role, userId }: GetAttemptParams) {
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: { include: { course: true } },
      answers: true,
    },
  });
  if (!attempt) throw new NotFoundError('Attempt not found');

  // Admin can view any attempt
  if (role === 'ADMIN') {
    return { attempt };
  }

  // Teacher can view attempts only on owned courses
  if (role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({ where: { userId } });
    if (!teacher || teacher.id !== attempt.quiz.course.teacherId) {
      throw new ForbiddenError('You can only view attempts in your own courses');
    }
    return { attempt };
  }

  // Student can only view their own attempts
  if (role === 'STUDENT') {
    const student = await prisma.student.findUnique({ where: { userId } });
    if (!student || student.id !== attempt.studentId) {
      throw new ForbiddenError('You can only view your own attempts');
    }
    return { attempt };
  }

  throw new ForbiddenError('You do not have access to this attempt');
}

export {
  listCourseQuizzes,
  getQuizDetails,
  createQuiz,
  updateQuiz,
  archiveQuiz,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  startAttempt,
  submitAttempt,
  getQuizResults,
  getAttemptDetail,
};