// Timetable controller - handles timetable slot HTTP requests.
import { Request, Response, NextFunction } from 'express';
import * as timetableService from '../services/timetableService';
import { success, created } from '../utils/response';

function getIp(req: Request): string | null {
  return req.ip || req.socket?.remoteAddress || null;
}

export async function listTimetableSlots(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { dayOfWeek } = req.query;
    const result = await timetableService.listTimetableSlots({
      role: req.user!.role,
      userId: req.user!.id,
      dayOfWeek: dayOfWeek as string | undefined,
    });
    success(res, result, 'Timetable retrieved');
  } catch (err) {
    next(err);
  }
}

export async function createTimetableSlot(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const slot = await timetableService.createTimetableSlot({
      actorId: req.user!.id,
      data: req.body,
      ipAddress: getIp(req),
    });
    created(res, { slot }, 'Timetable slot created');
  } catch (err) {
    next(err);
  }
}

export async function updateTimetableSlot(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const slot = await timetableService.updateTimetableSlot({
      actorId: req.user!.id,
      slotId: req.params.id as string,
      data: req.body,
      ipAddress: getIp(req),
    });
    success(res, { slot }, 'Timetable slot updated');
  } catch (err) {
    next(err);
  }
}

export async function deleteTimetableSlot(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await timetableService.deleteTimetableSlot({
      actorId: req.user!.id,
      slotId: req.params.id as string,
      ipAddress: getIp(req),
    });
    success(res, result, 'Timetable slot deleted');
  } catch (err) {
    next(err);
  }
}
