// Tests for the communication service - announcements and events (Member 6).
import { test } from 'node:test';
import assert from 'node:assert';

const state: any = {
  announcements: [],
  events: [],
  users: [
    { id: 'user-teacher-1', role: 'TEACHER', status: 'ACTIVE' },
    { id: 'user-student-1', role: 'STUDENT', status: 'ACTIVE' },
    { id: 'user-admin-1', role: 'ADMIN', status: 'ACTIVE' },
  ],
  auditLogs: [],
};

let nextId = 1;

const mockPrisma = {
  announcement: {
    create: async ({ data }: any) => {
      const rec = { id: `ann-${nextId++}`, ...data, publishedAt: new Date(), createdAt: new Date(), updatedAt: new Date() };
      state.announcements.push(rec);
      return rec;
    },
    findMany: async ({ where, skip = 0, take = 20 }: any) => {
      let result = state.announcements;
      if (where?.audience?.in) result = result.filter((a: any) => where.audience.in.includes(a.audience));
      return result.slice(skip, skip + take);
    },
    count: async ({ where }: any) => {
      let result = state.announcements;
      if (where?.audience?.in) result = result.filter((a: any) => where.audience.in.includes(a.audience));
      return result.length;
    },
    findUnique: async ({ where }: any) => state.announcements.find((a: any) => a.id === where.id) || null,
    delete: async ({ where }: any) => {
      const idx = state.announcements.findIndex((a: any) => a.id === where.id);
      const [removed] = state.announcements.splice(idx, 1);
      return removed;
    },
  },
  event: {
    create: async ({ data }: any) => {
      const rec = { id: `evt-${nextId++}`, ...data, createdAt: new Date(), updatedAt: new Date() };
      state.events.push(rec);
      return rec;
    },
    findMany: async ({ where, skip = 0, take = 20 }: any) => {
      let result = state.events;
      if (where?.audience?.in) result = result.filter((e: any) => where.audience.in.includes(e.audience));
      return result.slice(skip, skip + take);
    },
    count: async ({ where }: any) => {
      let result = state.events;
      if (where?.audience?.in) result = result.filter((e: any) => where.audience.in.includes(e.audience));
      return result.length;
    },
    findUnique: async ({ where }: any) => state.events.find((e: any) => e.id === where.id) || null,
    delete: async ({ where }: any) => {
      const idx = state.events.findIndex((e: any) => e.id === where.id);
      const [removed] = state.events.splice(idx, 1);
      return removed;
    },
  },
  user: {
    findMany: async ({ where }: any) => {
      let result = state.users;
      if (where?.status) result = result.filter((u: any) => u.status === where.status);
      if (where?.role?.in) result = result.filter((u: any) => where.role.in.includes(u.role));
      return result;
    },
  },
  notification: {
    createMany: async ({ data }: any) => ({ count: data.length }),
  },
  auditLog: {
    create: async ({ data }: any) => {
      const log = { id: `audit-${state.auditLogs.length + 1}`, ...data };
      state.auditLogs.push(log);
      return log;
    },
  },
};

const prismaClientPath = require.resolve('../src/prisma/client');
require.cache[prismaClientPath] = { id: prismaClientPath, filename: prismaClientPath, loaded: true, exports: mockPrisma } as any;

const communicationService = require('../src/services/communicationService');
const { ForbiddenError, ValidationError } = require('../src/utils/errors');

test('createAnnouncement publishes with audience and notifies recipients', async () => {
  const result = await communicationService.createAnnouncement({
    actorId: 'user-teacher-1',
    actorRole: 'TEACHER',
    data: { title: 'Midterm week', body: 'Midterms start Monday', audience: 'STUDENTS' },
  });
  assert.strictEqual(result.title, 'Midterm week');
  assert.strictEqual(result.audience, 'STUDENTS');
  assert.ok(state.auditLogs.some((l: any) => l.action === 'ANNOUNCEMENT_PUBLISHED'));
});

test('createAnnouncement rejects students', async () => {
  await assert.rejects(
    communicationService.createAnnouncement({
      actorId: 'user-student-1',
      actorRole: 'STUDENT',
      data: { title: 'x', body: 'y' },
    }),
    ForbiddenError
  );
});

test('createAnnouncement validates required fields', async () => {
  await assert.rejects(
    communicationService.createAnnouncement({ actorId: 'user-teacher-1', actorRole: 'TEACHER', data: { title: '', body: '' } }),
    ValidationError
  );
  await assert.rejects(
    communicationService.createAnnouncement({ actorId: 'user-teacher-1', actorRole: 'TEACHER', data: { title: 't', body: 'b', audience: 'EVERYONE' } }),
    ValidationError
  );
});

test('listAnnouncements filters audience by role', async () => {
  // Existing announcement targets STUDENTS; add one targeting TEACHERS
  await communicationService.createAnnouncement({
    actorId: 'user-admin-1',
    actorRole: 'ADMIN',
    data: { title: 'Staff meeting', body: 'Friday 3pm', audience: 'TEACHERS' },
  });

  const studentView = await communicationService.listAnnouncements({ role: 'STUDENT' });
  assert.ok(studentView.announcements.every((a: any) => a.audience !== 'TEACHERS'));
  assert.ok(studentView.announcements.length >= 1);

  const teacherView = await communicationService.listAnnouncements({ role: 'TEACHER' });
  assert.ok(teacherView.announcements.some((a: any) => a.audience === 'TEACHERS'));
  assert.ok(teacherView.announcements.every((a: any) => a.audience !== 'STUDENTS'));

  const adminView = await communicationService.listAnnouncements({ role: 'ADMIN' });
  assert.ok(adminView.announcements.length >= 2);
});

test('createEvent validates dates', async () => {
  await assert.rejects(
    communicationService.createEvent({
      actorId: 'user-teacher-1',
      actorRole: 'TEACHER',
      data: { title: 'Sports day', startsAt: 'not-a-date' },
    }),
    ValidationError
  );
  await assert.rejects(
    communicationService.createEvent({
      actorId: 'user-teacher-1',
      actorRole: 'TEACHER',
      data: { title: 'Sports day', startsAt: '2026-09-10T10:00:00Z', endsAt: '2026-09-10T09:00:00Z' },
    }),
    ValidationError
  );
});

test('createEvent creates event with notification fan-out', async () => {
  const result = await communicationService.createEvent({
    actorId: 'user-teacher-1',
    actorRole: 'TEACHER',
    data: { title: 'Science fair', location: 'Main hall', audience: 'ALL', startsAt: '2026-09-15T09:00:00Z' },
  });
  assert.strictEqual(result.title, 'Science fair');
  assert.ok(state.auditLogs.some((l: any) => l.action === 'EVENT_CREATED'));
});

test('deleteAnnouncement removes the record', async () => {
  const created = state.announcements[0];
  const result = await communicationService.deleteAnnouncement({ actorId: 'user-admin-1', announcementId: created.id });
  assert.strictEqual(result.id, created.id);
  assert.ok(!state.announcements.find((a: any) => a.id === created.id));
});

test('deleteEvent throws NotFoundError for missing event', async () => {
  const { NotFoundError } = require('../src/utils/errors');
  await assert.rejects(
    communicationService.deleteEvent({ actorId: 'user-admin-1', eventId: 'missing-id' }),
    NotFoundError
  );
});