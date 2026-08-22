// Dashboard controller - handles dashboard HTTP requests.
import { Request, Response, NextFunction } from 'express';
import * as dashboardService from '../services/dashboardService';
import * as studentSummaryService from '../services/studentSummaryService';
import { success } from '../utils/response';

export async function getAdminDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await dashboardService.getAdminDashboard({ userId: req.user!.id });
    success(res, result, 'Admin dashboard retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getTeacherDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await dashboardService.getTeacherDashboard({ userId: req.user!.id });
    success(res, result, 'Teacher dashboard retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getStudentDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await dashboardService.getStudentDashboard({ userId: req.user!.id });
    success(res, result, 'Student dashboard retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getStudentSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await studentSummaryService.getStudentSummary({
      studentId: req.params.id as string,
      role: req.user!.role,
      userId: req.user!.id,
    });
    success(res, result, 'Student summary retrieved');
  } catch (err) {
    next(err);
  }
}
