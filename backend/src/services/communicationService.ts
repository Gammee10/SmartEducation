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

// M6: chunked fan-out. The recipient list is paged (500/chunk) and each
// chunk gets its own createMany, so a 5k-user publish neither loads the
// whole user table into memory nor trips Postgres parameter limits. The
// publish itself stays in the caller's tx (a notify failure still blocks
// publish); chunking only bounds each write.
const FANOUT_CHUNK = 500;

function audienceWhere(audience: AudienceScope): Record<string, unknown> {
  return {
    status: 'ACTIVE',
    ...(audience === 'TEACHERS'
      ? { role: { in: ['TEACHER'] } }
      : audience === 'STUDENTS'
        ? { role: { in: ['STUDENT'] } }
        : { role: { in: ['TEACHER', 'STUDENT'] } }),
  };
}

async function fanOutChunked(
  tx: any,
  where: Record<string, unknown>,
  payload: { title: string; message: string; type: 'ANNOUNCEMENT' | 'EVENT'; metadata: Record<string, unknown> }
): Promise<number> {
  let notified = 0;
  for (let skip = 0; ; skip += FANOUT_CHUNK) {
    const batch = await tx.user.findMany({
      where,
      select: { id: true },
      orderBy: { id: 'asc' },
      skip,
      take: FANOUT_CHUNK,
    });
    if (batch.length === 0) break;
    await notifyUsers({ ...payload, userIds: batch.map((u: any) => u.id) }, tx);
    notified += batch.length;
    if (batch.length < FANOUT_CHUNK) break;
  }
  return notified;
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

    // Fan out in-app notifications to the targeted audience (M6 chunked).
    const notified = await fanOutChunked(tx, audienceWhere(audience), {
      title: `Announcement: ${title}`,
      message: body.slice(0, 200),
      type: 'ANNOUNCEMENT',
      metadata: { announcementId: created.id },
    });

    await writeAuditLog(
      {
        actorId,
        action: 'ANNOUNCEMENT_PUBLISHED',
        entity: 'Announcement',
        entityId: created.id,
        metadata: { title, audience, notified },
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
  actorRole?: string;
  announcementId: string;
  ipAddress?: string | null;
}) {
  const { actorId, actorRole, announcementId, ipAddress } = opts;
  const existing = await prisma.announcement.findUnique({ where: { id: announcementId } });
  if (!existing) throw new NotFoundError('Announcement not found');
  // M8: teachers can delete their own announcements; admins can delete any.
  if (actorRole !== 'ADMIN' && existing.publishedById !== actorId) {
    throw new ForbiddenError('You can only delete your own announcements');
  }
  await prisma.announcement.delete({ where: { id: announcementId } });
  // Cleanup policy (M6/M8): already-delivered inbox notifications are
  // retained as user history - notifications reference the announcement only
  // via metadata (no FK), so no dangling references are possible. The delete
  // audit records the retention choice explicitly.
  await writeAuditLog({
    actorId,
    action: 'ANNOUNCEMENT_DELETED',
    entity: 'Announcement',
    entityId: announcementId,
    metadata: { title: existing.title, notifications: 'retained-as-history' },
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

    // Fan out in-app notifications to the targeted audience (M6 chunked).
    const notified = await fanOutChunked(tx, audienceWhere(audience), {
      title: `Event: ${title}`,
      message: `${startsAt.toISOString()}${data.location ? ` · ${data.location}` : ''}`,
      type: 'EVENT',
      metadata: { eventId: created.id },
    });

    await writeAuditLog(
      {
        actorId,
        action: 'EVENT_CREATED',
        entity: 'Event',
        entityId: created.id,
        metadata: { title, audience, startsAt: startsAt.toISOString(), notified },
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

async function deleteEvent(opts: {
  actorId: string;
  actorRole?: string;
  eventId: string;
  ipAddress?: string | null;
}) {
  const { actorId, actorRole, eventId, ipAddress } = opts;
  const existing = await prisma.event.findUnique({ where: { id: eventId } });
  if (!existing) throw new NotFoundError('Event not found');
  // M8: teachers can delete their own events; admins can delete any.
  if (actorRole !== 'ADMIN' && existing.createdById !== actorId) {
    throw new ForbiddenError('You can only delete your own events');
  }
  await prisma.event.delete({ where: { id: eventId } });
  // Same retention policy as announcements: inbox history is kept.
  await writeAuditLog({
    actorId,
    action: 'EVENT_DELETED',
    entity: 'Event',
    entityId: eventId,
    metadata: { title: existing.title, notifications: 'retained-as-history' },
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