// Notification service - in-app notifications (Member 6).
// Shared write path used by other modules (assignments, quizzes, announcements).
import prisma from '../prisma/client';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';

type NotificationType = 'ASSIGNMENT' | 'GRADE' | 'QUIZ_RESULT' | 'ANNOUNCEMENT' | 'EVENT' | 'GENERAL';

const NOTIFICATION_TYPES: NotificationType[] = [
  'ASSIGNMENT',
  'GRADE',
  'QUIZ_RESULT',
  'ANNOUNCEMENT',
  'EVENT',
  'GENERAL',
];

interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  metadata?: Record<string, unknown> | null;
}

/**
 * Create an in-app notification row.
 * Accepts an optional transaction client so notifications can be created
 * inside a Prisma transaction (used by assignment grading).
 */
async function createNotification(
  { userId, title, message, type = 'GENERAL', metadata = null }: CreateNotificationParams,
  client: any = prisma
) {
  return client.notification.create({
    data: {
      userId,
      title,
      message,
      type,
      metadata: metadata || undefined,
    },
  });
}

/**
 * Notify many users at once (fan-out). Used by announcements/events and
 * available to any other module.
 */
async function notifyUsers(params: {
  userIds: string[];
  title: string;
  message: string;
  type?: NotificationType;
  metadata?: Record<string, unknown> | null;
}) {
  const { userIds, title, message, type = 'GENERAL', metadata = null } = params;
  if (!Array.isArray(userIds) || userIds.length === 0) return { count: 0 };
  if (!title || !message) throw new ValidationError('Title and message are required');
  return (prisma.notification.createMany as any)({
    data: userIds.map((userId) => ({
      userId,
      title,
      message,
      type,
      metadata: metadata || undefined,
    })),
  });
}

function assertNotificationType(type: string | undefined): NotificationType {
  if (type !== undefined && !NOTIFICATION_TYPES.includes(type as NotificationType)) {
    throw new ValidationError('Invalid notification type');
  }
  return (type || 'GENERAL') as NotificationType;
}

// List the current user's notifications (newest first).
async function listNotifications(opts: {
  userId: string;
  unreadOnly?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const { userId, unreadOnly, page = 1, pageSize = 20 } = opts;
  const where: Record<string, unknown> = { userId };
  if (unreadOnly) where.isRead = false;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    notifications,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

// Unread count for the notification bell.
async function getUnreadCount(userId: string) {
  const count = await prisma.notification.count({ where: { userId, isRead: false } });
  return { count };
}

// Mark a single notification read - owner only.
async function markNotificationRead(opts: { userId: string; notificationId: string }) {
  const { userId, notificationId } = opts;
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification) throw new NotFoundError('Notification not found');
  if (notification.userId !== userId) {
    throw new ForbiddenError('You can only manage your own notifications');
  }
  if (notification.isRead) return notification;
  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

// Mark all of the current user's notifications read.
async function markAllNotificationsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return { updated: result.count };
}

export {
  createNotification,
  notifyUsers,
  assertNotificationType,
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
};