import { parsePagination } from '../utils/pagination';
// Notification controller - inbox, unread count, read state (Member 6).
import { Request, Response, NextFunction } from 'express';
import * as notificationService from '../services/notificationService';
import { success } from '../utils/response';

export async function listNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { unreadOnly } = req.query;
    const result = await notificationService.listNotifications({
      userId: req.user!.id,
      unreadOnly: unreadOnly === 'true',
      ...parsePagination(req.query),
    });
    success(res, result, 'Notifications retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await notificationService.getUnreadCount(req.user!.id);
    success(res, result, 'Unread count retrieved');
  } catch (err) {
    next(err);
  }
}

export async function markNotificationRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await notificationService.markNotificationRead({
      userId: req.user!.id,
      notificationId: req.params.id as string,
    });
    success(res, { notification: result }, 'Notification marked as read');
  } catch (err) {
    next(err);
  }
}

export async function markAllNotificationsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await notificationService.markAllNotificationsRead(req.user!.id);
    success(res, result, 'All notifications marked as read');
  } catch (err) {
    next(err);
  }
}