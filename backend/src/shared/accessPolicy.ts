// Shared kernel: cross-domain access policy.
// Course visibility/ownership is owned here — not by courseService — so
// assignments, quizzes, attendance, and courses share one enforcement
// point. Changing access semantics touches this file only.
import prisma from '../prisma/client';
import { NotFoundError, ForbiddenError } from '../utils/errors';

// Moved verbatim from courseService (H6 admin content-moderation override).
// Teachers own their courses, but an admin must be able to intervene when
// the owner is unavailable - ownership checks skip the teacher match when
// actorRole is ADMIN, and every override is tagged in audit metadata.
function isAdminRole(role: unknown): boolean {
  return role === 'ADMIN';
}

function adminOverrideMeta(actorRole: unknown, ownerTeacherId: unknown): Record<string, unknown> {
  return isAdminRole(actorRole) ? { adminOverride: true, ownerTeacherId: ownerTeacherId ?? null } : {};
}

interface CourseAccessParams {
  courseId: string;
  role: string;
  userId: string;
}

interface CourseAccess {
  id: string;
  teacherId: string;
  status: string;
}

/**
 * Enforce course access (teacher owner, enrolled student, or admin).
 * Same semantics as the `courseService.getCourse` gate, but with a minimal
 * select: callers that need the full read shape use `courseService.getCourse`;
 * this returns only what policy needs. Throws NotFoundError for missing
 * courses, ForbiddenError for teacher/student violations. Like `getCourse`,
 * ADMIN (and any non-teacher/student role, which route wiring never sends)
 * falls through to allow.
 */
async function requireCourseAccess({ courseId, role, userId }: CourseAccessParams): Promise<CourseAccess> {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new NotFoundError('Course not found');

  if (role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({ where: { userId } });
    if (!teacher || teacher.id !== course.teacherId) {
      throw new ForbiddenError('You do not have access to this course');
    }
    return course as CourseAccess;
  }

  if (role === 'STUDENT') {
    const student = await prisma.student.findUnique({ where: { userId } });
    if (!student) throw new NotFoundError('Student profile not found');
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId, studentId: student.id } },
    });
    if (!enrollment || enrollment.status !== 'ACTIVE') {
      throw new ForbiddenError('You are not enrolled in this course');
    }
    return course as CourseAccess;
  }

  return course as CourseAccess;
}

export { isAdminRole, adminOverrideMeta, requireCourseAccess };
export type { CourseAccess, CourseAccessParams };
