// Attendance service - attendance marking, corrections, and history.
import prismaModule from '../prisma/client';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../utils/errors';
import { writeAuditLog } from './auditService';

const prisma = prismaModule as any;

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
const ATTENDANCE_STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
const userInfoSelect = { id: true, fullName: true, email: true };

function assertAttendanceStatus(status: string | undefined): AttendanceStatus {
  if (status !== undefined && !ATTENDANCE_STATUSES.includes(status as AttendanceStatus)) {
    throw new ValidationError('Invalid attendance status');
  }
  return (status || 'PRESENT') as AttendanceStatus;
}

function assertValidDate(value: string | Date, field = 'Date'): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`${field} is not a valid date`);
  }
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function assertTeacherOwnsCourse(actorId: string, courseId: string) {
  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!teacher) throw new NotFoundError('Teacher profile not found');
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new NotFoundError('Course not found');
  if (course.teacherId !== teacher.id) {
    throw new ForbiddenError('You can only manage attendance in your own courses');
  }
  return { teacher, course };
}

async function assertStudentEnrolled(studentId: string, courseId: string) {
  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { courseId_studentId: { courseId, studentId } },
  });
  if (!enrollment || enrollment.status !== 'ACTIVE') {
    throw new ValidationError('Student is not actively enrolled in this course');
  }
}

export { assertTeacherOwnsCourse, assertStudentEnrolled, userInfoSelect };

// ---------------------------------------------------------------
// List course attendance
// ---------------------------------------------------------------

export async function listCourseAttendance({
  courseId,
  role,
  userId,
  date,
  page = 1,
  pageSize = 50,
}: {
  courseId: string;
  role: string;
  userId: string;
  date?: string;
  page?: number;
  pageSize?: number;
}) {
  if (role === 'TEACHER') {
    await assertTeacherOwnsCourse(userId, courseId);
  } else if (role === 'STUDENT') {
    const student = await prisma.student.findUnique({ where: { userId } });
    if (!student) throw new NotFoundError('Student profile not found');
    await assertStudentEnrolled(student.id, courseId);
  }

  const where: Record<string, unknown> = { courseId };
  if (date) where.date = assertValidDate(date);

  // Privacy: staff get the roster with contact details (needed for marking);
  // students get the roster names only (no emails), and classmate emails are
  // stripped from the attendance records themselves.
  const isStaff = role === 'TEACHER' || role === 'ADMIN';
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      enrollments: {
        where: { status: 'ACTIVE' },
        select: {
          student: {
            include: {
              user: { select: isStaff ? userInfoSelect : { id: true, fullName: true } },
            },
          },
        },
      },
    },
  });
  if (!course) throw new NotFoundError('Course not found');

  const [attendance, total] = await Promise.all([
    prisma.attendance.findMany({
      where,
      include: {
        student: { include: { user: { select: userInfoSelect } } },
        markedBy: { select: userInfoSelect },
        course: { select: { id: true, title: true, subject: true } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.attendance.count({ where }),
  ]);

  const attendanceForRole = isStaff
    ? attendance
    : attendance.map((record: any) => ({
        ...record,
        student: record.student
          ? { ...record.student, user: { id: record.student.user.id, fullName: record.student.user.fullName } }
          : record.student,
      }));

  return {
    course: { id: course.id, title: course.title, subject: course.subject, gradeLevel: course.gradeLevel },
    enrolledStudents: course.enrollments.map((e: any) => e.student),
    attendance: attendanceForRole,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

// ---------------------------------------------------------------
// Upsert attendance (bulk or single)
// ---------------------------------------------------------------

export interface AttendanceRecordInput {
  studentId: string;
  courseId: string;
  date: string | Date;
  status: string;
  comment?: string;
}

export async function upsertAttendance({
  actorId,
  records,
  ipAddress,
}: {
  actorId: string;
  records: AttendanceRecordInput[];
  ipAddress?: string | null;
}): Promise<any[]> {
  if (!Array.isArray(records) || records.length === 0) {
    throw new ValidationError('At least one attendance record is required');
  }
  if (records.length > 200) {
    throw new ValidationError('Cannot mark more than 200 records at once');
  }

  const first = records[0];
  if (!first || !first.courseId) {
    throw new ValidationError('courseId is required on every record');
  }
  if (records.some((r) => r.courseId !== first.courseId)) {
    throw new ValidationError('All records must belong to the same course');
  }

  await assertTeacherOwnsCourse(actorId, first.courseId);

  const date = assertValidDate(first.date, 'Date');

  const processed = await prisma.$transaction(async (tx: any) => {
    // Batch validation reads (one query per table instead of 3 per record)
    const studentIds = [...new Set(records.map((r) => r.studentId))];
    const recordDates = [...new Set(records.map((r) => assertValidDate(r.date, 'Date')))];
    const [students, enrollments, existingRecords] = await Promise.all([
      tx.student.findMany({ where: { id: { in: studentIds } } }),
      tx.courseEnrollment.findMany({
        where: { studentId: { in: studentIds }, courseId: first.courseId, status: 'ACTIVE' },
      }),
      tx.attendance.findMany({
        where: { studentId: { in: studentIds }, courseId: first.courseId, date: { in: recordDates } },
      }),
    ]);

    const studentIdsFound = new Set(students.map((s: any) => s.id));
    const enrolledStudentIds = new Set(enrollments.map((e: any) => e.studentId));
    const existingKey = (studentId: string, d: Date) => `${studentId}|${new Date(d).toISOString().slice(0, 10)}`;
    const existingByStudentDate = new Map<string, any>(existingRecords.map((a: any) => [existingKey(a.studentId, a.date), a] as [string, any]));

    const results: any[] = [];
    for (const rec of records) {
      const recordDate = assertValidDate(rec.date, 'Date');
      const status = assertAttendanceStatus(rec.status);

      if (!studentIdsFound.has(rec.studentId)) throw new NotFoundError('Student not found');
      if (!enrolledStudentIds.has(rec.studentId)) {
        throw new ValidationError('Student is not actively enrolled in this course');
      }

      const existing = existingByStudentDate.get(existingKey(rec.studentId, recordDate));

      let saved;
      if (existing) {
        saved = await tx.attendance.update({
          where: { id: existing.id },
          data: {
            status,
            comment: rec.comment !== undefined ? rec.comment || null : existing.comment,
          },
          include: { student: { include: { user: { select: userInfoSelect } } }, course: true },
        });
      } else {
        saved = await tx.attendance.create({
          data: {
            studentId: rec.studentId,
            courseId: first.courseId,
            date: recordDate,
            status,
            comment: rec.comment || null,
            markedById: actorId,
          },
          include: { student: { include: { user: { select: userInfoSelect } } }, course: true },
        });
      }
      results.push(saved);
    }

    await writeAuditLog(
      {
        actorId,
        action: 'ATTENDANCE_MARKED',
        entity: 'Attendance',
        entityId: results.length === 1 ? results[0]?.id : null,
        metadata: {
          courseId: first.courseId,
          date: date.toISOString(),
          count: results.length,
          statuses: results.map((r: any) => r.status),
        },
        ipAddress,
      },
      tx
    );

    return results;
  });

  return processed;
}

// Correct attendance (audited) - teacher owner or admin
export async function correctAttendance(opts: {
  actorId: string; attendanceId: string; data: { status: string; comment?: string }; ipAddress?: string | null;
}) {
  const { actorId, attendanceId, data, ipAddress } = opts;
  const existing = await prisma.attendance.findUnique({
    where: { id: attendanceId },
    include: { course: true },
  });
  if (!existing) throw new NotFoundError('Attendance record not found');

  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!teacher || teacher.id !== existing.course.teacherId) {
    const user = await prisma.user.findUnique({ where: { id: actorId } });
    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenError('You can only correct attendance in your own courses');
    }
  }

  const status = assertAttendanceStatus(data.status);
  if (status === existing.status && data.comment === undefined) {
    throw new ConflictError('No changes to apply');
  }

  const updated = await prisma.attendance.update({
    where: { id: attendanceId },
    data: {
      status,
      comment: data.comment !== undefined ? data.comment || null : existing.comment,
      markedById: actorId,
      markedAt: new Date(),
    },
    include: { student: { include: { user: { select: userInfoSelect } } }, course: true },
  });

  await writeAuditLog({
    actorId,
    action: 'ATTENDANCE_CORRECTED',
    entity: 'Attendance',
    entityId: attendanceId,
    metadata: {
      before: { status: existing.status, comment: existing.comment },
      after: { status: updated.status, comment: updated.comment },
    },
    ipAddress,
  });

  return updated;
}

// Student attendance history - own / teacher / admin
export async function listStudentAttendance(opts: {
  studentId: string; role: string; userId: string; courseId?: string; page?: number; pageSize?: number;
}) {
  const { studentId, role, userId, courseId, page = 1, pageSize = 20 } = opts;
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new NotFoundError('Student not found');

  if (role === 'STUDENT') {
    if (student.userId !== userId) throw new ForbiddenError('You can only view your own attendance');
  } else if (role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) throw new NotFoundError('Teacher profile not found');
    const teachingCourses = await prisma.course.findMany({ where: { teacherId: teacher.id }, select: { id: true } });
    if (teachingCourses.length === 0) throw new ForbiddenError('You do not have access to this student attendance');
    const shared = await prisma.courseEnrollment.findFirst({
      where: { studentId, courseId: { in: teachingCourses.map((c: any) => c.id) } },
      select: { id: true },
    });
    if (!shared) throw new ForbiddenError('You do not teach this student');
  }

  const where: Record<string, unknown> = { studentId };
  if (courseId) {
    if (role === 'TEACHER') await assertTeacherOwnsCourse(userId, courseId);
    where.courseId = courseId;
  }

  const [attendance, total] = await Promise.all([
    prisma.attendance.findMany({
      where,
      include: { course: { select: { id: true, title: true, subject: true, gradeLevel: true } }, markedBy: { select: userInfoSelect } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize, take: pageSize,
    }),
    prisma.attendance.count({ where }),
  ]);

  return {
    student: { id: student.id, studentCode: student.studentCode, gradeLevel: student.gradeLevel, section: student.section },
    attendance,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}
