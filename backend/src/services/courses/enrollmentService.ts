// Course enrollment (REFACTORING_PLAN Stage 3). Admin-controlled enroll and
// unenroll, each audited.
import prisma from '../../prisma/client';
import { NotFoundError, ConflictError } from '../../utils/errors';
import { writeAuditLog } from '../auditService';

interface EnrollStudentParams {
  actorId: string;
  courseId: string;
  studentId: string;
  ipAddress?: string | null;
}

async function enrollStudent({ actorId, courseId, studentId, ipAddress }: EnrollStudentParams) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new NotFoundError('Course not found');

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new NotFoundError('Student not found');

  // Check for existing enrollment
  const existing = await prisma.courseEnrollment.findUnique({
    where: { courseId_studentId: { courseId, studentId } },
  });
  if (existing) {
    if (existing.status === 'ACTIVE') {
      throw new ConflictError('Student is already enrolled in this course');
    }
    // Re-activate dropped/completed enrollment
    const reactivated = await prisma.courseEnrollment.update({
      where: { id: existing.id },
      data: { status: 'ACTIVE', enrolledById: actorId },
    });
    await writeAuditLog({
      actorId,
      action: 'COURSE_ENROLLMENT_REACTIVATED',
      entity: 'CourseEnrollment',
      entityId: reactivated.id,
      metadata: { courseId, studentId },
      ipAddress,
    });
    return reactivated;
  }

  let enrollment;
  try {
    enrollment = await prisma.courseEnrollment.create({
      data: {
        courseId,
        studentId,
        enrolledById: actorId,
      },
      include: {
        student: { include: { user: { select: { id: true, fullName: true, email: true } } } },
      },
    });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw new ConflictError('Student is already enrolled in this course');
    }
    throw err;
  }

  await writeAuditLog({
    actorId,
    action: 'COURSE_ENROLLED',
    entity: 'CourseEnrollment',
    entityId: enrollment.id,
    metadata: { courseId, studentId },
    ipAddress,
  });

  return enrollment;
}

interface UnenrollStudentParams {
  actorId: string;
  courseId: string;
  studentId: string;
  ipAddress?: string | null;
}

async function unenrollStudent({ actorId, courseId, studentId, ipAddress }: UnenrollStudentParams) {
  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { courseId_studentId: { courseId, studentId } },
  });
  if (!enrollment) throw new NotFoundError('Enrollment not found');

  const updated = await prisma.courseEnrollment.update({
    where: { id: enrollment.id },
    data: { status: 'DROPPED' },
  });

  await writeAuditLog({
    actorId,
    action: 'COURSE_UNENROLLED',
    entity: 'CourseEnrollment',
    entityId: enrollment.id,
    metadata: { courseId, studentId },
    ipAddress,
  });

  return updated;
}

export { enrollStudent, unenrollStudent };
