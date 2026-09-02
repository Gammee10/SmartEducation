// Communication service - announcements and events with audience targeting.
import prisma from '../prisma/client';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';
import { writeAuditLog } from './auditService';
import { notifyUsers } from './notificationService';

type AudienceScope = 'ALL' | 'TEACHERS' | 'STUDENTS';
const AUDIENCES: AudienceScope[] = ['ALL', 'TEACHERS', 'STUDENTS'];

function assertAudience(audience: string | undefined): AudienceScope {
  if (audience !== undefined && !AUDIENCES.includes(audience as AudienceScope)) {
    throw new ValidationError('audience must be ALL, TEACHERS, or STUDENTS');
  }
  return (audience || 'ALL') as AudienceScope;
}

// Backend-side audience filtering - users only see what targets them.
function audienceMatches(audience: string, role: string): boolean {
  if (audience === 'ALL') return true;
  if (audience === 'TEACHERS') return role === 'TEACHER' || role === 'ADMIN';
  if (audience === 'STUDENTS') return role === 'STUDENT' || role === 'ADMIN';
  return false;
}

// ---------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------

async function createAnnouncement(opts: {
  actorId: string;
  actorRole: string;
  data: { title?: string; body?: string; audience?: string };
  ipAddress?: string | null;
}) {
  const { actorId, actorRole, data, ipAddress } = opts;
  if (actorRole !== 'ADMIN' && actorRole !== 'TEACHER') {
    throw new ForbiddenError('Only admins and teachers can publish announcements');
  }
  const title = (data.title || '').trim();
  const body = (data.body || '').trim();
  if (!title) throw new ValidationError('Title is required');
  if (!body) throw new ValidationError('Body is required');
  const audience = assertAudience(data.audience);

  // Create + fan-out + audit in one transaction: a notify failure must not
  // leave a published announcement that nobody was notified about.
  const announcement = await prisma.$transaction(async (tx: any) => {
    const created = await tx.announcement.create({
      data: { title, body, audience, publishedById: actorId },
      include: {
        publishedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    // Fan out in-app notifications to the targeted audience.
    const recipients = await tx.user.findMany({
      where: {
        status: 'ACTIVE',
        ...(audience === 'TEACHERS'
          ? { role: { in: ['TEACHER'] } }
          : audience === 'STUDENTS'
            ? { role: { in: ['STUDENT'] } }
            : { role: { in: ['TEACHER', 'STUDENT'] } }),
      },
      select: { id: true },
    });
    await notifyUsers(
      {
        userIds: recipients.map((u: any) => u.id),
        title: `Announcement: ${title}`,
        message: body.slice(0, 200),
        type: 'ANNOUNCEMENT',
        metadata: { announcementId: created.id },
      },
      tx
    );

    await writeAuditLog(
      {
        actorId,
        action: 'ANNOUNCEMENT_PUBLISHED',
        entity: 'Announcement',
        entityId: created.id,
        metadata: { title, audience, notified: recipients.length },
        ipAddress,
      },
      tx
    );

    return created;
  });

  return announcement;
}

async function listAnnouncements(opts: { role: string; page?: number; pageSize?: number }) {
  const { role, page = 1, pageSize = 20 } = opts;
  const audiences: AudienceScope[] =
    role === 'STUDENT'
      ? ['ALL', 'STUDENTS']
      : role === 'TEACHER'
        ? ['ALL', 'TEACHERS']
        : ['ALL', 'TEACHERS', 'STUDENTS']; // admins see everything

  const where = { audience: { in: audiences } };
  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      include: { publishedBy: { select: { id: true, fullName: true, email: true } } },
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.announcement.count({ where }),
  ]);

  return {
    announcements,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

async function deleteAnnouncement(opts: {
  actorId: string;
  announcementId: string;
  ipAddress?: string | null;
}) {
  const { actorId, announcementId, ipAddress } = opts;
  const existing = await prisma.announcement.findUnique({ where: { id: announcementId } });
  if (!existing) throw new NotFoundError('Announcement not found');
  await prisma.announcement.delete({ where: { id: announcementId } });
  await writeAuditLog({
    actorId,
    action: 'ANNOUNCEMENT_DELETED',
    entity: 'Announcement',
    entityId: announcementId,
    metadata: { title: existing.title },
    ipAddress,
  });
  return { id: announcementId };
}

// ---------------------------------------------------------------
// Events
// ---------------------------------------------------------------

function assertValidDate(value: unknown, field: string): Date {
  const date = new Date(value as string);
  if (!value || Number.isNaN(date.getTime())) {
    throw new ValidationError(`${field} is not a valid date`);
  }
  return date;
}

async function createEvent(opts: {
  actorId: string;
  actorRole: string;
  data: {
    title?: string;
    description?: string;
    location?: string;
    audience?: string;
    startsAt?: string;
    endsAt?: string;
  };
  ipAddress?: string | null;
}) {
  const { actorId, actorRole, data, ipAddress } = opts;
  if (actorRole !== 'ADMIN' && actorRole !== 'TEACHER') {
    throw new ForbiddenError('Only admins and teachers can create events');
  }
  const title = (data.title || '').trim();
  if (!title) throw new ValidationError('Title is required');
  const startsAt = assertValidDate(data.startsAt, 'startsAt');
  let endsAt: Date | null = null;
  if (data.endsAt) {
    endsAt = assertValidDate(data.endsAt, 'endsAt');
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new ValidationError('endsAt must be after startsAt');
    }
  }
  const audience = assertAudience(data.audience);

  const event = await prisma.$transaction(async (tx: any) => {
    const created = await tx.event.create({
      data: {
        title,
        description: data.description || null,
        location: data.location || null,
        audience,
        startsAt,
        endsAt,
        createdById: actorId,
      },
      include: { createdBy: { select: { id: true, fullName: true, email: true } } },
    });

    const recipients = await tx.user.findMany({
      where: {
        status: 'ACTIVE',
        ...(audience === 'TEACHERS'
          ? { role: { in: ['TEACHER'] } }
          : audience === 'STUDENTS'
            ? { role: { in: ['STUDENT'] } }
            : { role: { in: ['TEACHER', 'STUDENT'] } }),
      },
      select: { id: true },
    });
    await notifyUsers(
      {
        userIds: recipients.map((u: any) => u.id),
        title: `Event: ${title}`,
        message: `${startsAt.toISOString()}${data.location ? ` · ${data.location}` : ''}`,
        type: 'EVENT',
        metadata: { eventId: created.id },
      },
      tx
    );

    await writeAuditLog(
      {
        actorId,
        action: 'EVENT_CREATED',
        entity: 'Event',
        entityId: created.id,
        metadata: { title, audience, startsAt: startsAt.toISOString() },
        ipAddress,
      },
      tx
    );

    return created;
  });

  return event;
}

async function listEvents(opts: { role: string; page?: number; pageSize?: number; upcoming?: boolean }) {
  const { role, page = 1, pageSize = 20, upcoming } = opts;
  const audiences: AudienceScope[] =
    role === 'STUDENT'
      ? ['ALL', 'STUDENTS']
      : role === 'TEACHER'
        ? ['ALL', 'TEACHERS']
        : ['ALL', 'TEACHERS', 'STUDENTS'];

  // Default to upcoming events; ?upcoming=false lists everything.
  const where: Record<string, unknown> = { audience: { in: audiences } };
  if (upcoming !== false) {
    where.startsAt = { gte: new Date() };
  }
  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      include: { createdBy: { select: { id: true, fullName: true, email: true } } },
      orderBy: { startsAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.event.count({ where }),
  ]);

  return {
    events,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

async function deleteEvent(opts: { actorId: string; eventId: string; ipAddress?: string | null }) {
  const { actorId, eventId, ipAddress } = opts;
  const existing = await prisma.event.findUnique({ where: { id: eventId } });
  if (!existing) throw new NotFoundError('Event not found');
  await prisma.event.delete({ where: { id: eventId } });
  await writeAuditLog({
    actorId,
    action: 'EVENT_DELETED',
    entity: 'Event',
    entityId: eventId,
    metadata: { title: existing.title },
    ipAddress,
  });
  return { id: eventId };
}

export {
  audienceMatches,
  createAnnouncement,
  listAnnouncements,
  deleteAnnouncement,
  createEvent,
  listEvents,
  deleteEvent,
};