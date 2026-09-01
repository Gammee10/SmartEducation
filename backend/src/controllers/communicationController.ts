import { parsePagination } from '../utils/pagination';
// Communication controller - announcements and events (Member 6).
import { Request, Response, NextFunction } from 'express';
import * as communicationService from '../services/communicationService';
import { success, created } from '../utils/response';

function getIp(req: Request): string | null {
  return req.ip || req.socket?.remoteAddress || null;
}

export async function listAnnouncements(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await communicationService.listAnnouncements({
      role: req.user!.role,
      ...parsePagination(req.query),
    });
    success(res, result, 'Announcements retrieved');
  } catch (err) {
    next(err);
  }
}

export async function createAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const announcement = await communicationService.createAnnouncement({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      data: req.body,
      ipAddress: getIp(req),
    });
    created(res, { announcement }, 'Announcement published');
  } catch (err) {
    next(err);
  }
}

export async function deleteAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await communicationService.deleteAnnouncement({
      actorId: req.user!.id,
      announcementId: req.params.id as string,
      ipAddress: getIp(req),
    });
    success(res, result, 'Announcement deleted');
  } catch (err) {
    next(err);
  }
}

export async function listEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await communicationService.listEvents({
      role: req.user!.role,
      ...parsePagination(req.query),
    });
    success(res, result, 'Events retrieved');
  } catch (err) {
    next(err);
  }
}

export async function createEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const event = await communicationService.createEvent({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      data: req.body,
      ipAddress: getIp(req),
    });
    created(res, { event }, 'Event created');
  } catch (err) {
    next(err);
  }
}

export async function deleteEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await communicationService.deleteEvent({
      actorId: req.user!.id,
      eventId: req.params.id as string,
      ipAddress: getIp(req),
    });
    success(res, result, 'Event deleted');
  } catch (err) {
    next(err);
  }
}