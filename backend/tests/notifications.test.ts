// Tests for the notification service - inbox, unread count, read state (Member 6).
import { test } from 'node:test';
import assert from 'node:assert';

const state: any = {
  notifications: [
    { id: 'n-1', userId: 'user-1', title: 'Grade posted', message: 'You scored 8/10', type: 'GRADE', isRead: false, createdAt: new Date('2026-08-20') },
    { id: 'n-2', userId: 'user-1', title: 'Welcome', message: 'Hello!', type: 'GENERAL', isRead: true, createdAt: new Date('2026-08-19') },
    { id: 'n-3', userId: 'user-2', title: 'Other user', message: 'Not yours', type: 'GENERAL', isRead: false, createdAt: new Date('2026-08-18') },
  ],
};

const mockPrisma = {
  notification: {
    findMany: async ({ where }: any) => {
      let result = state.notifications;
      if (where?.userId) result = result.filter((n: any) => n.userId === where.userId);
      if (where?.isRead !== undefined) result = result.filter((n: any) => n.isRead === where.isRead);
      return [...result].sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    count: async ({ where }: any) => {
      let result = state.notifications;
      if (where?.userId) result = result.filter((n: any) => n.userId === where.userId);
      if (where?.isRead !== undefined) result = result.filter((n: any) => n.isRead === where.isRead);
      return result.length;
    },
    findUnique: async ({ where }: any) => state.notifications.find((n: any) => n.id === where.id) || null,
    update: async ({ where, data }: any) => {
      const idx = state.notifications.findIndex((n: any) => n.id === where.id);
      state.notifications[idx] = { ...state.notifications[idx], ...data };
      return state.notifications[idx];
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0;
      for (const n of state.notifications) {
        if (n.userId === where.userId && n.isRead === where.isRead) {
          Object.assign(n, data);
          count++;
        }
      }
      return { count };
    },
    createMany: async ({ data }: any) => ({ count: data.length }),
  },
};

const prismaClientPath = require.resolve('../src/prisma/client');
require.cache[prismaClientPath] = { id: prismaClientPath, filename: prismaClientPath, loaded: true, exports: mockPrisma } as any;

const notificationService = require('../src/services/notificationService');
const { ForbiddenError, ValidationError } = require('../src/utils/errors');

test('listNotifications returns only own notifications newest first', async () => {
  const result = await notificationService.listNotifications({ userId: 'user-1' });
  assert.strictEqual(result.notifications.length, 2);
  assert.strictEqual(result.notifications[0].id, 'n-1');
  assert.strictEqual(result.pagination.total, 2);
});

test('listNotifications filters unread only', async () => {
  const result = await notificationService.listNotifications({ userId: 'user-1', unreadOnly: true });
  assert.strictEqual(result.notifications.length, 1);
  assert.strictEqual(result.notifications[0].id, 'n-1');
});

test('getUnreadCount counts own unread', async () => {
  const result = await notificationService.getUnreadCount('user-1');
  assert.strictEqual(result.count, 1);
});

test('markNotificationRead marks own notification read', async () => {
  const result = await notificationService.markNotificationRead({ userId: 'user-1', notificationId: 'n-1' });
  assert.strictEqual(result.isRead, true);
});

test('markNotificationRead rejects another user notification', async () => {
  await assert.rejects(
    notificationService.markNotificationRead({ userId: 'user-1', notificationId: 'n-3' }),
    ForbiddenError
  );
});

test('markAllNotificationsRead updates all own unread', async () => {
  // Reset n-1 to unread first
  state.notifications[0].isRead = false;
  const result = await notificationService.markAllNotificationsRead('user-1');
  assert.strictEqual(result.updated, 1);
  assert.strictEqual(state.notifications.find((n: any) => n.id === 'n-1').isRead, true);
});

test('notifyUsers validates title and message', async () => {
  await assert.rejects(
    notificationService.notifyUsers({ userIds: ['user-1'], title: '', message: 'x' }),
    ValidationError
  );
});

test('notifyUsers returns zero for empty recipient list', async () => {
  const result = await notificationService.notifyUsers({ userIds: [], title: 't', message: 'm' });
  assert.strictEqual(result.count, 0);
});