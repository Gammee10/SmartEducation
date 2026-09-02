// Timetable service - slot CRUD with conflict detection.
import prismaModule from '../prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import { writeAuditLog } from './auditService';
const prisma = prismaModule as any;
type DayOfWeek = 'MONDAY'|'TUESDAY'|'WEDNESDAY'|'THURSDAY'|'FRIDAY';
const DAYS: DayOfWeek[] = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY'];
const ORDER: Record<string, number> = { MONDAY:0, TUESDAY:1, WEDNESDAY:2, THURSDAY:3, FRIDAY:4 };
function assertDay(v?: string): DayOfWeek {
  if (!v || !DAYS.includes(v as DayOfWeek)) throw new ValidationError('dayOfWeek must be MONDAY..FRIDAY');
  return v as DayOfWeek;
}
function toMin(t: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t);
  if (!m) throw new ValidationError(`Invalid time "${t}"`);
  return parseInt(m[1],10)*60 + parseInt(m[2],10);
}
function assertTimeRange(s: string, e: string): void {
  if (toMin(e) <= toMin(s)) throw new ValidationError('endTime must be after startTime');
  if (toMin(e) - toMin(s) < 15) throw new ValidationError('Slot must be at least 15 minutes');
}
function xover(a1: number, a2: number, b1: number, b2: number): boolean { return a1 < b2 && b1 < a2; }
export async function listTimetableSlots(opts: { role: string; userId: string; dayOfWeek?: string }): Promise<any> {
  const { role, userId, dayOfWeek } = opts;
  const where: Record<string, unknown> = {};
  if (dayOfWeek) where.dayOfWeek = assertDay(dayOfWeek);
  if (role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) throw new NotFoundError('Teacher profile not found');
    where.teacherId = teacher.id;
  } else if (role === 'STUDENT') {
    const student = await prisma.student.findUnique({ where: { userId } });
    if (!student) throw new NotFoundError('Student profile not found');
    where.course = { enrollments: { some: { studentId: student.id, status: 'ACTIVE' } } };
  }
  const slots = await prisma.timetableSlot.findMany({
    where,
    include: {
      course: { select: { id: true, title: true, subject: true, gradeLevel: true } },
      teacher: { include: { user: { select: { id: true, fullName: true, email: true } } } },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
  slots.sort((a: any, b: any) => ORDER[a.dayOfWeek] - ORDER[b.dayOfWeek] || a.startTime.localeCompare(b.startTime));
  return { slots };
}

export async function createTimetableSlot(opts: { actorId: string; data: any; ipAddress?: string | null }): Promise<any> {
  const { actorId, data, ipAddress } = opts;
  const day = assertDay(data.dayOfWeek);
  assertTimeRange(data.startTime, data.endTime);
  const course = await prisma.course.findUnique({ where: { id: data.courseId } });
  if (!course) throw new NotFoundError('Course not found');
  let teacherId: string | null = data.teacherId || course.teacherId || null;
  if (data.teacherId) {
    const t = await prisma.teacher.findUnique({ where: { id: data.teacherId } });
    if (!t) throw new NotFoundError('Teacher not found');
    teacherId = t.id;
  }

  // Conflict check runs inside the transaction so two concurrent creates
  // cannot both pass the check and double-book a room or teacher.
  const slot = await prisma.$transaction(async (tx: any) => {
    await checkConflicts(tx, day, data.startTime, data.endTime, data.room || null, teacherId, null);
    const created = await tx.timetableSlot.create({
      data: { courseId: data.courseId, teacherId, dayOfWeek: day, startTime: data.startTime, endTime: data.endTime, room: data.room || null },
      include: { course: { select: { id: true, title: true, subject: true, gradeLevel: true } }, teacher: { include: { user: { select: { id: true, fullName: true } } } } },
    });
    await writeAuditLog(
      { actorId, action: 'TIMETABLE_SLOT_CREATED', entity: 'TimetableSlot', entityId: created.id, metadata: { courseId: data.courseId, dayOfWeek: day, startTime: data.startTime, endTime: data.endTime }, ipAddress },
      tx
    );
    return created;
  });
  return slot;
}

export async function updateTimetableSlot(opts: { actorId: string; slotId: string; data: any; ipAddress?: string | null }): Promise<any> {
  const { actorId, slotId, data, ipAddress } = opts;
  const existing = await prisma.timetableSlot.findUnique({ where: { id: slotId } });
  if (!existing) throw new NotFoundError('Timetable slot not found');
  const day = data.dayOfWeek ? assertDay(data.dayOfWeek) : existing.dayOfWeek;
  const start = data.startTime ?? existing.startTime;
  const end = data.endTime ?? existing.endTime;
  const room = data.room !== undefined ? data.room : existing.room;
  const teacherId = data.teacherId !== undefined ? data.teacherId : existing.teacherId;
  if (data.courseId) {
    const c = await prisma.course.findUnique({ where: { id: data.courseId } });
    if (!c) throw new NotFoundError('Course not found');
  }
  if (data.teacherId) {
    const t = await prisma.teacher.findUnique({ where: { id: data.teacherId } });
    if (!t) throw new NotFoundError('Teacher not found');
  }
  assertTimeRange(start, end);

  const slot = await prisma.$transaction(async (tx: any) => {
    await checkConflicts(tx, day, start, end, room || null, teacherId || null, slotId);
    const updated = await tx.timetableSlot.update({
      where: { id: slotId },
      data: { ...(data.courseId ? { courseId: data.courseId } : {}), teacherId: teacherId, dayOfWeek: day, startTime: start, endTime: end, room: room },
      include: { course: { select: { id: true, title: true, subject: true, gradeLevel: true } }, teacher: { include: { user: { select: { id: true, fullName: true } } } } },
    });
    await writeAuditLog(
      { actorId, action: 'TIMETABLE_SLOT_UPDATED', entity: 'TimetableSlot', entityId: slotId, metadata: { courseId: updated.courseId, dayOfWeek: day, startTime: start, endTime: end }, ipAddress },
      tx
    );
    return updated;
  });
  return slot;
}

export async function deleteTimetableSlot(opts: { actorId: string; slotId: string; ipAddress?: string | null }): Promise<any> {
  const { actorId, slotId, ipAddress } = opts;
  const existing = await prisma.timetableSlot.findUnique({ where: { id: slotId } });
  if (!existing) throw new NotFoundError('Timetable slot not found');

  await prisma.$transaction(async (tx: any) => {
    await tx.timetableSlot.delete({ where: { id: slotId } });
    await writeAuditLog(
      { actorId, action: 'TIMETABLE_SLOT_DELETED', entity: 'TimetableSlot', entityId: slotId, metadata: { courseId: existing.courseId, dayOfWeek: existing.dayOfWeek, startTime: existing.startTime }, ipAddress },
      tx
    );
  });
  return { id: slotId };
}

// Accepts a prisma/tx client so the check can run inside the creating
// transaction (closing the check-then-insert race).
async function checkConflicts(tx: any, day: DayOfWeek, startTime: string, endTime: string, room: string | null, teacherId: string | null, excludeId: string | null): Promise<void> {
  const s = toMin(startTime);
  const e = toMin(endTime);
  if (room) {
    const slots = await tx.timetableSlot.findMany({ where: { dayOfWeek: day, room, NOT: excludeId ? { id: excludeId } : undefined } });
    for (const x of slots) {
      if (xover(s, e, toMin(x.startTime), toMin(x.endTime))) throw new ConflictError(`Room "${room}" is already booked ${x.startTime}-${x.endTime} on ${day}`);
    }
  }
  if (teacherId) {
    const slots = await tx.timetableSlot.findMany({ where: { teacherId, dayOfWeek: day, NOT: excludeId ? { id: excludeId } : undefined } });
    for (const x of slots) {
      if (xover(s, e, toMin(x.startTime), toMin(x.endTime))) throw new ConflictError(`Teacher already has a class ${x.startTime}-${x.endTime} on ${day}`);
    }
  }
}
