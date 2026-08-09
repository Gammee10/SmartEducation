// Course controller - handles course, enrollment, and content HTTP requests.
import { Request, Response, NextFunction } from 'express';
import * as courseService from '../services/courseService';
import { success, created, paginated } from '../utils/response';
import { ForbiddenError } from '../utils/errors';

function getIp(req: Request): string | null {
  return req.ip || req.socket?.remoteAddress || null;
}

// ---------------------------------------------------------------
// Courses
// ---------------------------------------------------------------

async function listCourses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, page = 1, pageSize = 20 } = req.query;
    const result = await courseService.listCourses({
      role: req.user!.role,
      userId: req.user!.id,
      status: status as string | undefined,
      page: parseInt(page as string, 10),
      pageSize: parseInt(pageSize as string, 10),
    });
    paginated(res, result.courses, result.pagination, 'Courses retrieved');
  } catch (err) {
    next(err);
  }
}

async function getCourse(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const course = await courseService.getCourse({
      courseId: req.params.id as string,
      role: req.user!.role,
      userId: req.user!.id,
    });
    success(res, { course }, 'Course retrieved');
  } catch (err) {
    next(err);
  }
}

async function createCourse(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'TEACHER') {
      next(new ForbiddenError('Only teachers can create courses'));
      return;
    }
    const course = await courseService.createCourse({
      actorId: req.user!.id,
      data: req.body,
      ipAddress: getIp(req),
    });
    created(res, { course }, 'Course created');
  } catch (err) {
    next(err);
  }
}

async function updateCourse(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const course = await courseService.updateCourse({
      actorId: req.user!.id,
      courseId: req.params.id as string,
      data: req.body,
      ipAddress: getIp(req),
    });
    success(res, { course }, 'Course updated');
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------

async function enrollStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'ADMIN') {
      next(new ForbiddenError('Only admins can enroll students'));
      return;
    }
    const enrollment = await courseService.enrollStudent({
      actorId: req.user!.id,
      courseId: req.params.id as string,
      studentId: req.body.studentId,
      ipAddress: getIp(req),
    });
    created(res, { enrollment }, 'Student enrolled');
  } catch (err) {
    next(err);
  }
}

async function unenrollStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'ADMIN') {
      next(new ForbiddenError('Only admins can unenroll students'));
      return;
    }
    const enrollment = await courseService.unenrollStudent({
      actorId: req.user!.id,
      courseId: req.params.id as string,
      studentId: req.body.studentId,
      ipAddress: getIp(req),
    });
    success(res, { enrollment }, 'Student unenrolled');
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------
// Content
// ---------------------------------------------------------------

async function listContent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const result = await courseService.listContent({
      courseId: req.params.id as string,
      role: req.user!.role,
      userId: req.user!.id,
      page: parseInt(page as string, 10),
      pageSize: parseInt(pageSize as string, 10),
    });
    paginated(res, result.items, result.pagination, 'Course content retrieved');
  } catch (err) {
    next(err);
  }
}

async function uploadContent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'TEACHER') {
      next(new ForbiddenError('Only teachers can upload content'));
      return;
    }
    const item = await courseService.uploadContent({
      actorId: req.user!.id,
      courseId: req.params.courseId as string,
      data: req.body,
      ipAddress: getIp(req),
    });
    created(res, { item }, 'Content uploaded');
  } catch (err) {
    next(err);
  }
}

async function archiveContent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await courseService.archiveContent({
      actorId: req.user!.id,
      contentId: req.params.id as string,
      ipAddress: getIp(req),
    });
    success(res, { item }, 'Content archived');
  } catch (err) {
    next(err);
  }
}

export {
  listCourses,
  getCourse,
  createCourse,
  updateCourse,
  enrollStudent,
  unenrollStudent,
  listContent,
  uploadContent,
  archiveContent,
};