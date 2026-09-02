import { parsePagination } from '../utils/pagination';
// Attendance controller - handles attendance HTTP requests.
import { Request, Response, NextFunction } from 'express';
import * as attendanceService from '../services/attendanceService';
import { success, created } from '../utils/response';
import { ForbiddenError } from '../utils/errors';

function getIp(req: Request): string | null {
  return req.ip || req.socket?.remoteAddress || null;
}

export async function listCourseAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { date } = req.query;
    const result = await attendanceService.listCourseAttendance({
      courseId: req.params.id as string,
      role: req.user!.role,
      userId: req.user!.id,
      date: date as string | undefined,
      ...parsePagination(req.query),
    });
    success(res, result, 'Attendance retrieved');
  } catch (err) {
    next(err);
  }
}

export async function upsertAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'TEACHER') {
      next(new ForbiddenError('Only teachers can mark attendance'));
      return;
    }
    const records = Array.isArray(req.body.records) ? req.body.records : [req.body];
    const result = await attendanceService.upsertAttendance({
      actorId: req.user!.id,
      records,
      ipAddress: getIp(req),
    });
    created(res, { attendance: result }, 'Attendance marked');
  } catch (err) {
    next(err);
  }
}

export async function correctAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await attendanceService.correctAttendance({
      actorId: req.user!.id,
      attendanceId: req.params.id as string,
      data: req.body,
      ipAddress: getIp(req),
    });
    success(res, { attendance: result }, 'Attendance corrected');
  } catch (err) {
    next(err);
  }
}

export async function listStudentAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { courseId } = req.query;
    const result = await attendanceService.listStudentAttendance({
      studentId: req.params.id as string,
      role: req.user!.role,
      userId: req.user!.id,
      courseId: courseId as string | undefined,
      ...parsePagination(req.query),
    });
    success(res, result, 'Student attendance retrieved');
  } catch (err) {
    next(err);
  }
}
