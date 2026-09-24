// Quiz attempts - start, submit, and result reads (REFACTORING_PLAN
// Stage 3). Server timing, attempt limits, exact-set scoring, and
// audit+notify atomicity are preserved verbatim; scoring itself lives in
// ./scoring.ts.
import prisma from '../../prisma/client';
import { Prisma } from '@prisma/client';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../../utils/errors';
import { writeAuditLog } from '../auditService';
import { createNotification } from '../notificationService';
import { buildStudentQuestionPayload, userInfoSelect } from './shared';
import type { QuizAttemptStatus } from './shared';
import { scoreAttempt } from './scoring';

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

  // Reuse an existing IN_PROGRESS attempt instead of creating a new one so the
  // attempt limit cannot be bypassed by repeatedly starting attempts and so
  // the timer is never reset. The frontend resume path handles a returned
  // in-progress attempt.
  const now = new Date();
  let existing = await prisma.quizAttempt.findFirst({
    where: { quizId, studentId: student.id, status: 'IN_PROGRESS' },
    orderBy: { startedAt: 'desc' },
  });

  if (existing && now >= new Date(existing.expiresAt)) {
    // Expired IN_PROGRESS attempts count toward the limit - flip it (guarded
    // so a concurrent submit/flip cannot double-write) and start fresh.
    await prisma.quizAttempt.updateMany({
      where: { id: existing.id, status: 'IN_PROGRESS' },
      data: { status: 'TIME_EXPIRED', submittedAt: now },
    });
    existing = null;
  }

  if (existing) {
    return {
      attempt: {
        id: existing.id,
        startedAt: existing.startedAt,
        expiresAt: existing.expiresAt,
      },
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        timeLimit: quiz.timeLimit,
        shuffleQuestions: quiz.shuffleQuestions,
        shuffleOptions: quiz.shuffleOptions,
        questions: buildStudentQuestionPayload(quiz),
      },
    };
  }

  // Count ALL attempts (including IN_PROGRESS) against the limit
  const attemptCount = await prisma.quizAttempt.count({
    where: { quizId, studentId: student.id },
  });
  if (attemptCount >= quiz.maxAttempts) {
    throw new ConflictError(`You have used all ${quiz.maxAttempts} attempt(s) for this quiz`);
  }

  // Calculate required max score from question points
  const maxScore = quiz.questions.reduce((sum: number, q: any) => sum + Number(q.points || 1), 0);

  const startedAt = now;
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
  const questions = buildStudentQuestionPayload(quiz);

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

  // Reject absurd payloads early (each quiz question is answered at most once)
  if (Array.isArray(answers) && answers.length > 200) {
    throw new ValidationError('Too many answers submitted');
  }

  // Determine if the attempt expired (server-side enforcement)
  const now = new Date();
  const expired = now >= new Date(attempt.expiresAt);

  // Auto-grade all submitted answers (exact-set scoring; foreign option ids
  // dropped, duplicates deduplicated) via the pure scoring module.
  const { answerData, earned, total } = scoreAttempt(attemptId, attempt.quiz.questions, answers || []);

  const finalStatus: QuizAttemptStatus = expired ? 'TIME_EXPIRED' : 'SUBMITTED';

  // Policy: expired attempts are still graded but flagged TIME_EXPIRED so
  // teachers can discount them; they are excluded from dashboard averages
  // (which aggregate SUBMITTED attempts only).
  // Save answers, update attempt, audit, and notify in one transaction
  const result = await prisma.$transaction(async (tx) => {
    // Atomically claim the attempt so concurrent submits (double-click,
    // auto-submit racing manual submit) cannot double-grade. If the attempt
    // was already submitted, roll everything back with a conflict.
    const claimed = await tx.quizAttempt.updateMany({
      where: { id: attemptId, status: 'IN_PROGRESS' },
      data: {
        status: finalStatus,
        submittedAt: now,
        score: earned,
        maxScore: total,
      },
    });
    if (claimed.count === 0) {
      throw new ConflictError('This attempt has already been submitted');
    }

    // Delete any pre-existing answers (safety for retries)
    await tx.quizAnswer.deleteMany({ where: { attemptId } });
    if (answerData.length > 0) {
      await tx.quizAnswer.createMany({ data: answerData as Prisma.QuizAnswerCreateManyInput[] });
    }

    const updated = await tx.quizAttempt.update({
      where: { id: attemptId },
      data: {},
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

export { startAttempt, submitAttempt, getQuizResults, getAttemptDetail };
