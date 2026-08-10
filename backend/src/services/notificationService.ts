// Notification service - minimal in-app notification helper.
// Member 3 contract: grading triggers notifications for students.
// Member 6 owns the full notification feature (bell, inbox, read/unread);
// this service is the shared write path it can build on.
import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';

interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type?: 'ASSIGNMENT' | 'GRADE' | 'QUIZ_RESULT' | 'ANNOUNCEMENT' | 'EVENT' | 'GENERAL';
  metadata?: Prisma.InputJsonValue | null;
}

/**
 * Create an in-app notification row.
 * Accepts an optional transaction client so notifications can be created
 * inside a Prisma transaction (used by assignment grading).
 */
async function createNotification(
  { userId, title, message, type = 'GENERAL', metadata = null }: CreateNotificationParams,
  client: { notification: { create: (args: unknown) => Promise<unknown> } } = prisma as {
    notification: { create: (args: unknown) => Promise<unknown> };
  }
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

export { createNotification };