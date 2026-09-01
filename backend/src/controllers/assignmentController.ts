import { parsePagination } from '../utils/pagination';
// Assignment controller - handles assignment, submission, and grading HTTP requests.
import { Request, Response, NextFunction } from 'express';
import * as assignmentService from '../services/assignmentService';
import { success, created, paginated } from '../utils/response';
import { ForbiddenError } from '../utils/errors';

function getIp(req: Request): string | null {
  return req.ip || req.socket?.remoteAddress || null;
}

// ---------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------

async function listCourseAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status } = req.query;
    const result = await assignmentService.listCourseAssignments({
      courseId: req.params.id as string,
      role: req.user!.role,
      userId: req.user!.id,
      status: status as string | undefined,
      ...parsePagination(req.query),
    });
    paginated(res, result.assignments, result.pagination, 'Assignments retrieved');
  } catch (err) {
    next(err);
  }
}

async function createAssignment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'TEACHER') {
      next(new ForbiddenError('Only teachers can create assignments'));
      return;
    }
    const assignment = await assignmentService.createAssignment({
      actorId: req.user!.id,
      courseId: req.params.id as string,
      data: req.body,
      ipAddress: getIp(req),
    });
    created(res, { assignment }, 'Assignment created');
  } catch (err) {
    next(err);
  }
}

async function getAssignment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await assignmentService.getAssignmentDetails({
      assignmentId: req.params.id as string,
      role: req.user!.role,
      userId: req.user!.id,
    });
    success(res, result, 'Assignment retrieved');
  } catch (err) {
    next(err);
  }
}

async function updateAssignment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const assignment = await assignmentService.updateAssignment({
      actorId: req.user!.id,
      assignmentId: req.params.id as string,
      data: req.body,
      ipAddress: getIp(req),
    });
    success(res, { assignment }, 'Assignment updated');
  } catch (err) {
    next(err);
  }
}

async function archiveAssignment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const assignment = await assignmentService.archiveAssignment({
      actorId: req.user!.id,
      assignmentId: req.params.id as string,
      ipAddress: getIp(req),
    });
    success(res, { assignment }, 'Assignment archived');
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------

async function submitAssignment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'STUDENT') {
      next(new ForbiddenError('Only students can submit assignments'));
      return;
    }
    const submission = await assignmentService.submitAssignment({
      actorId: req.user!.id,
      assignmentId: req.params.id as string,
      data: { content: req.body.content as string | undefined },
      file: req.file
        ? {
            buffer: req.file.buffer,
            mimetype: req.file.mimetype,
            size: req.file.size,
          }
        : null,
      ipAddress: getIp(req),
    });
    created(res, { submission }, 'Assignment submitted');
  } catch (err) {
    next(err);
  }
}

async function listSubmissions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await assignmentService.listSubmissions({
      actorId: req.user!.id,
      assignmentId: req.params.id as string,
      ...parsePagination(req.query),
    });
    paginated(res, result.submissions, result.pagination, 'Submissions retrieved');
  } catch (err) {
    next(err);
  }
}

async function gradeSubmission(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'TEACHER') {
      next(new ForbiddenError('Only teachers can grade submissions'));
      return;
    }
    const submission = await assignmentService.gradeSubmission({
      actorId: req.user!.id,
      submissionId: req.params.id as string,
      data: req.body,
      ipAddress: getIp(req),
    });
    success(res, { submission }, 'Submission graded');
  } catch (err) {
    next(err);
  }
}

export {
  listCourseAssignments,
  createAssignment,
  getAssignment,
  updateAssignment,
  archiveAssignment,
  submitAssignment,
  listSubmissions,
  gradeSubmission,
};