// Quiz question management (REFACTORING_PLAN Stage 3). Content is frozen
// once a quiz is published or has attempts (C4).
import prisma from '../../prisma/client';
import { Prisma } from '@prisma/client';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../../utils/errors';
import { writeAuditLog } from '../auditService';
import { isAdminRole, adminOverrideMeta } from '../../shared/accessPolicy';
import { assertQuestionType, assertQuizContentMutable, validateQuestion } from './shared';
import type { QuestionInput } from './shared';

interface AddQuestionParams {
  actorId: string;
  actorRole?: string;
  quizId: string;
  data: QuestionInput;
  ipAddress?: string | null;
}

async function addQuestion({ actorId, actorRole, quizId, data, ipAddress }: AddQuestionParams) {
  validateQuestion(data, 0);

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { course: true, questions: { select: { id: true } } },
  });
  if (!quiz) throw new NotFoundError('Quiz not found');

  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!isAdminRole(actorRole) && (!teacher || teacher.id !== quiz.course.teacherId)) {
    throw new ForbiddenError('You can only manage questions in your own courses');
  }

  // C4 content freeze: no new questions after publishing or first attempt.
  await assertQuizContentMutable(quizId, quiz.status);

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
    metadata: { quizId, ...adminOverrideMeta(actorRole, quiz.course.teacherId) },
    ipAddress,
  });

  return question;
}

interface UpdateQuestionParams {
  actorId: string;
  actorRole?: string;
  questionId: string;
  data: QuestionInput;
  ipAddress?: string | null;
}

async function updateQuestion({ actorId, actorRole, questionId, data, ipAddress }: UpdateQuestionParams) {
  const existing = await prisma.quizQuestion.findUnique({
    where: { id: questionId },
    include: { quiz: { include: { course: true } } },
  });
  if (!existing) throw new NotFoundError('Question not found');

  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!isAdminRole(actorRole) && (!teacher || teacher.id !== existing.quiz.course.teacherId)) {
    throw new ForbiddenError('You can only manage questions in your own courses');
  }

  // C4 content freeze: no edits after publishing or first attempt.
  await assertQuizContentMutable(existing.quizId, existing.quiz.status);

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

  const updateData: Prisma.QuizQuestionUpdateInput = {};
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
    // H9: never lower points below already-awarded scores (would create
    // pointsEarned > points states and retroactively change averages).
    // The C4 freeze above already blocks this for published/attempted
    // quizzes; this is defense-in-depth for the DRAFT race window.
    if (points < existing.points) {
      const maxEarned = await prisma.quizAnswer.aggregate({
        where: { questionId },
        _max: { pointsEarned: true },
      });
      const top = maxEarned._max.pointsEarned;
      if (top != null && points < top) {
        throw new ConflictError(
          `Cannot lower points below the highest awarded score (${top}) - create a new quiz instead`
        );
      }
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
      metadata: { quizId: existing.quizId, ...adminOverrideMeta(actorRole, existing.quiz.course.teacherId) },
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
    metadata: { quizId: existing.quizId, ...adminOverrideMeta(actorRole, existing.quiz.course.teacherId) },
    ipAddress,
  });

  return updated;
}

interface DeleteQuestionParams {
  actorId: string;
  actorRole?: string;
  questionId: string;
  ipAddress?: string | null;
}

async function deleteQuestion({ actorId, actorRole, questionId, ipAddress }: DeleteQuestionParams) {
  const existing = await prisma.quizQuestion.findUnique({
    where: { id: questionId },
    include: { quiz: { include: { course: true } } },
  });
  if (!existing) throw new NotFoundError('Question not found');

  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!isAdminRole(actorRole) && (!teacher || teacher.id !== existing.quiz.course.teacherId)) {
    throw new ForbiddenError('You can only manage questions in your own courses');
  }

  // C4 content freeze: no deletes after publishing or first attempt (a
  // delete with answers would otherwise throw a raw FK error as a 500).
  await assertQuizContentMutable(existing.quizId, existing.quiz.status);

  await prisma.quizQuestion.delete({ where: { id: questionId } });

  await writeAuditLog({
    actorId,
    action: 'QUIZ_QUESTION_DELETED',
    entity: 'QuizQuestion',
    entityId: questionId,
    metadata: { quizId: existing.quizId, ...adminOverrideMeta(actorRole, existing.quiz.course.teacherId) },
    ipAddress,
  });

  return { id: questionId, deleted: true };
}

export { addQuestion, updateQuestion, deleteQuestion };
