import { parsePagination } from '../utils/pagination';
// Quiz controller - handles quiz, question, attempt, and result HTTP requests.
import { Request, Response, NextFunction } from 'express';
import * as quizService from '../services/quizService';
import { success, created, paginated } from '../utils/response';
import { ForbiddenError } from '../utils/errors';

function getIp(req: Request): string | null {
  return req.ip || req.socket?.remoteAddress || null;
}

// ---------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------

async function listCourseQuizzes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await quizService.listCourseQuizzes({
      courseId: req.params.id as string,
      role: req.user!.role,
      userId: req.user!.id,
      ...parsePagination(req.query),
    });
    paginated(res, result.quizzes, result.pagination, 'Quizzes retrieved');
  } catch (err) {
    next(err);
  }
}

async function createQuiz(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'TEACHER') {
      next(new ForbiddenError('Only teachers can create quizzes'));
      return;
    }
    const quiz = await quizService.createQuiz({
      actorId: req.user!.id,
      courseId: req.params.id as string,
      data: req.body,
      ipAddress: getIp(req),
    });
    created(res, { quiz }, 'Quiz created');
  } catch (err) {
    next(err);
  }
}

async function getQuiz(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await quizService.getQuizDetails({
      quizId: req.params.id as string,
      role: req.user!.role,
      userId: req.user!.id,
    });
    success(res, result, 'Quiz retrieved');
  } catch (err) {
    next(err);
  }
}

async function updateQuiz(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const quiz = await quizService.updateQuiz({
      actorId: req.user!.id,
      quizId: req.params.id as string,
      data: req.body,
      ipAddress: getIp(req),
    });
    success(res, { quiz }, 'Quiz updated');
  } catch (err) {
    next(err);
  }
}

async function archiveQuiz(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const quiz = await quizService.archiveQuiz({
      actorId: req.user!.id,
      quizId: req.params.id as string,
      ipAddress: getIp(req),
    });
    success(res, { quiz }, 'Quiz archived');
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------
// Questions
// ---------------------------------------------------------------

async function addQuestion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const question = await quizService.addQuestion({
      actorId: req.user!.id,
      quizId: req.params.id as string,
      data: req.body,
      ipAddress: getIp(req),
    });
    created(res, { question }, 'Question added');
  } catch (err) {
    next(err);
  }
}

async function updateQuestion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const question = await quizService.updateQuestion({
      actorId: req.user!.id,
      questionId: req.params.questionId as string,
      data: req.body,
      ipAddress: getIp(req),
    });
    success(res, { question }, 'Question updated');
  } catch (err) {
    next(err);
  }
}

async function deleteQuestion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await quizService.deleteQuestion({
      actorId: req.user!.id,
      questionId: req.params.questionId as string,
      ipAddress: getIp(req),
    });
    success(res, result, 'Question deleted');
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------
// Attempts
// ---------------------------------------------------------------

async function startAttempt(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'STUDENT') {
      next(new ForbiddenError('Only students can take quizzes'));
      return;
    }
    const result = await quizService.startAttempt({
      actorId: req.user!.id,
      quizId: req.params.id as string,
      ipAddress: getIp(req),
    });
    created(res, result, 'Quiz attempt started');
  } catch (err) {
    next(err);
  }
}

async function submitAttempt(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'STUDENT') {
      next(new ForbiddenError('Only students can submit quiz attempts'));
      return;
    }
    const result = await quizService.submitAttempt({
      actorId: req.user!.id,
      attemptId: req.params.id as string,
      answers: Array.isArray(req.body.answers) ? req.body.answers : [],
      ipAddress: getIp(req),
    });
    success(res, result, 'Quiz attempt submitted');
  } catch (err) {
    next(err);
  }
}

async function getAttempt(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await quizService.getAttemptDetail({
      attemptId: req.params.id as string,
      role: req.user!.role,
      userId: req.user!.id,
    });
    success(res, result, 'Attempt retrieved');
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------
// Results
// ---------------------------------------------------------------

async function getQuizResults(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await quizService.getQuizResults({
      quizId: req.params.id as string,
      role: req.user!.role,
      userId: req.user!.id,
    });
    success(res, result, 'Quiz results retrieved');
  } catch (err) {
    next(err);
  }
}

export {
  listCourseQuizzes,
  createQuiz,
  getQuiz,
  updateQuiz,
  archiveQuiz,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  startAttempt,
  submitAttempt,
  getAttempt,
  getQuizResults,
};