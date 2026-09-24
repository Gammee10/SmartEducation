// Shared quiz helpers (REFACTORING_PLAN Stage 3). Owns the quiz enums,
// question validation, student payload shaping, and the content-freeze
// guard so the CRUD/question/attempt modules share them without importing
// each other.
import prisma from '../../prisma/client';
import { ConflictError, ValidationError } from '../../utils/errors';

type QuizStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
type QuizQuestionType = 'MULTIPLE_CHOICE' | 'SINGLE_CHOICE';
type QuizAttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'TIME_EXPIRED';

const QUIZ_STATUSES: QuizStatus[] = ['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'];
const QUESTION_TYPES: QuizQuestionType[] = ['MULTIPLE_CHOICE', 'SINGLE_CHOICE'];

const userInfoSelect = { id: true, fullName: true, email: true };

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

/**
 * Content freeze (C4): quiz questions/points are grading keys. Once a quiz
 * leaves DRAFT or collects its first attempt, editing questions would
 * silently rewrite history (QuizAnswer.isCorrect/pointsEarned dangle,
 * optionId nulls via SetNull) and deleting questions throws raw FK errors.
 * Freeze content at that point - create a new quiz to change questions.
 */
async function assertQuizContentMutable(quizId: string, quizStatus: string): Promise<void> {
  if (quizStatus !== 'DRAFT') {
    throw new ConflictError(
      'Quiz content is frozen after publishing - create a new quiz to change questions'
    );
  }
  const attempts = await prisma.quizAttempt.count({ where: { quizId } });
  if (attempts > 0) {
    throw new ConflictError(
      'Quiz content is frozen once attempts exist - create a new quiz to change questions'
    );
  }
}

/**
 * Build the question payload returned to students (no correct answers),
 * applying the quiz's shuffle settings. Used both for new attempts and for
 * resuming an existing IN_PROGRESS attempt.
 */
function buildStudentQuestionPayload(quiz: any) {
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
  return questions;
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

export {
  QUIZ_STATUSES,
  QUESTION_TYPES,
  userInfoSelect,
  buildPagination,
  assertQuizStatus,
  assertQuestionType,
  shuffle,
  assertQuizContentMutable,
  buildStudentQuestionPayload,
  validateQuestion,
  buildQuestionCreateData,
};
export type { QuizStatus, QuizQuestionType, QuizAttemptStatus, QuestionInput };
