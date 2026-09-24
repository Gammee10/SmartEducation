// Course CRUD and the course read shape (REFACTORING_PLAN Stage 3).
// Enrollment and content live in sibling modules. getCourse keeps the
// roster-privacy include shape locked by tests (R8).
import prisma from '../../prisma/client';
import { Prisma } from '@prisma/client';
import { NotFoundError, ForbiddenError, ValidationError } from '../../utils/errors';
import { assertOptionalHttpUrl } from '../../utils/url';
import { writeAuditLog } from '../auditService';
import { isAdminRole, adminOverrideMeta } from '../../shared/accessPolicy';
import { COURSE_STATUSES, assertCourseStatus } from './shared';
import type { CourseStatus } from './shared';

interface ListCoursesParams {
  role: string;
  userId: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

async function listCourses({ role, userId, status, page = 1, pageSize = 20 }: ListCoursesParams) {
  let where: Prisma.CourseWhereInput = {};

  if (status) {
    if (!COURSE_STATUSES.includes(status as CourseStatus)) {
      throw new ValidationError('Invalid course status');
    }
    where.status = status as CourseStatus;
  }

  if (role === 'TEACHER') {
    // Teacher sees owned courses
    const teacher = await prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) throw new NotFoundError('Teacher profile not found');
    where = { ...where, teacherId: teacher.id };
  } else if (role === 'STUDENT') {
    // Student sees enrolled active courses
    const student = await prisma.student.findUnique({ where: { userId } });
    if (!student) throw new NotFoundError('Student profile not found');
    where = {
      ...where,
      status: 'ACTIVE',
      enrollments: { some: { studentId: student.id, status: 'ACTIVE' } },
    };
  }
  // Admin sees all (optionally filtered by status)

  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      where,
      include: {
        teacher: { include: { user: { select: { id: true, fullName: true, email: true } } } },
        _count: { select: { enrollments: true, content: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.course.count({ where }),
  ]);

  return {
    courses,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

interface GetCourseParams {
  courseId: string;
  role: string;
  userId: string;
}

async function getCourse({ courseId, role, userId }: GetCourseParams) {
  // Privacy: students must not receive the roster with classmates' contact
  // details - only staff get the enrollment list with user info.
  const studentUserInfo = { id: true, fullName: true, email: true };
  const include: Prisma.CourseInclude = {
    teacher: { include: { user: { select: studentUserInfo } } },
    ...(role !== 'STUDENT'
      ? {
          enrollments: {
            include: {
              student: { include: { user: { select: studentUserInfo } } },
            },
          },
        }
      : {}),
    _count: { select: { enrollments: true, content: true } },
  };

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include,
  });
  if (!course) throw new NotFoundError('Course not found');

  // Access control
  if (role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({ where: { userId } });
    if (!teacher || teacher.id !== course.teacherId) {
      throw new ForbiddenError('You do not have access to this course');
    }
  } else if (role === 'STUDENT') {
    const student = await prisma.student.findUnique({ where: { userId } });
    if (!student) throw new NotFoundError('Student profile not found');
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId, studentId: student.id } },
    });
    if (!enrollment || enrollment.status !== 'ACTIVE') {
      throw new ForbiddenError('You are not enrolled in this course');
    }
  }

  return course;
}

interface CreateCourseParams {
  actorId: string;
  data: {
    title: string;
    description?: string;
    subject: string;
    gradeLevel: string;
    coverUrl?: string;
    status?: string;
  };
  ipAddress?: string | null;
}

async function createCourse({ actorId, data, ipAddress }: CreateCourseParams) {
  const { title, description, subject, gradeLevel, coverUrl } = data;

  if (!title || !subject || !gradeLevel) {
    throw new ValidationError('Title, subject, and grade level are required');
  }
  const status = assertCourseStatus(data.status);
  const validatedCoverUrl = assertOptionalHttpUrl(coverUrl, 'Cover URL');

  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!teacher) throw new NotFoundError('Teacher profile not found');

  const course = await prisma.course.create({
    data: {
      title,
      description: description || null,
      subject,
      gradeLevel,
      coverUrl: validatedCoverUrl,
      teacherId: teacher.id,
      status,
    },
    include: {
      teacher: { include: { user: { select: { id: true, fullName: true } } } },
    },
  });

  await writeAuditLog({
    actorId,
    action: 'COURSE_CREATED',
    entity: 'Course',
    entityId: course.id,
    metadata: { title, subject, gradeLevel },
    ipAddress,
  });

  return course;
}

interface UpdateCourseParams {
  actorId: string;
  // H6: callers pass the authenticated user's role; ADMIN skips the
  // ownership check (intervention) and is tagged in the audit metadata.
  actorRole?: string;
  courseId: string;
  data: {
    title?: string;
    description?: string;
    subject?: string;
    gradeLevel?: string;
    coverUrl?: string;
    status?: string;
  };
  ipAddress?: string | null;
}

async function updateCourse({ actorId, actorRole, courseId, data, ipAddress }: UpdateCourseParams) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new NotFoundError('Course not found');

  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!isAdminRole(actorRole) && (!teacher || teacher.id !== course.teacherId)) {
    throw new ForbiddenError('You can only manage your own courses');
  }

  const updated = await prisma.course.update({
    where: { id: courseId },
    data: {
      title: data.title ?? course.title,
      description: data.description !== undefined ? data.description : course.description,
      subject: data.subject ?? course.subject,
      gradeLevel: data.gradeLevel ?? course.gradeLevel,
      coverUrl: data.coverUrl !== undefined ? assertOptionalHttpUrl(data.coverUrl, 'Cover URL') : course.coverUrl,
      status: data.status ? assertCourseStatus(data.status) : course.status,
    },
  });

  await writeAuditLog({
    actorId,
    action: 'COURSE_UPDATED',
    entity: 'Course',
    entityId: courseId,
    metadata: { title: updated.title, ...adminOverrideMeta(actorRole, course.teacherId) },
    ipAddress,
  });

  return updated;
}

export { listCourses, getCourse, createCourse, updateCourse };
