// Course service - course CRUD, enrollment, and content management.
import prismaModule from '../prisma/client';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../utils/errors';
import { assertHttpUrl, assertOptionalHttpUrl } from '../utils/url';
import { writeAuditLog } from './auditService';

// Cast to any to work around Prisma type resolution in monorepo
const prisma = prismaModule as any;

type CourseStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
type ContentTypeEnum = 'VIDEO' | 'DOCUMENT' | 'PDF' | 'IMAGE' | 'LINK' | 'OTHER';
type CourseWhereInput = Record<string, unknown>;
type ContentItemWhereInput = Record<string, unknown>;

// Known enum values - validated on write so bad inputs produce a 422 instead
// of a raw Prisma validation error (500).
const COURSE_STATUSES: CourseStatus[] = ['DRAFT', 'ACTIVE', 'ARCHIVED'];
const CONTENT_TYPES: ContentTypeEnum[] = ['VIDEO', 'DOCUMENT', 'PDF', 'IMAGE', 'LINK', 'OTHER'];

function assertCourseStatus(status: string | undefined): CourseStatus {
  if (status !== undefined && !COURSE_STATUSES.includes(status as CourseStatus)) {
    throw new ValidationError('Invalid course status');
  }
  return (status || 'DRAFT') as CourseStatus;
}

function assertContentType(type: string | undefined): ContentTypeEnum {
  if (type !== undefined && !CONTENT_TYPES.includes(type as ContentTypeEnum)) {
    throw new ValidationError('Invalid content type');
  }
  return (type || 'OTHER') as ContentTypeEnum;
}

// ---------------------------------------------------------------
// Courses
// ---------------------------------------------------------------

interface ListCoursesParams {
  role: string;
  userId: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

async function listCourses({ role, userId, status, page = 1, pageSize = 20 }: ListCoursesParams) {
  let where: CourseWhereInput = {};

  if (status) {
    if (!COURSE_STATUSES.includes(status as CourseStatus)) {
      throw new ValidationError('Invalid course status');
    }
    where.status = status;
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
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      teacher: { include: { user: { select: { id: true, fullName: true, email: true } } } },
      enrollments: {
        include: {
          student: { include: { user: { select: { id: true, fullName: true, email: true } } } },
        },
      },
      _count: { select: { enrollments: true, content: true } },
    },
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

async function updateCourse({ actorId, courseId, data, ipAddress }: UpdateCourseParams) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new NotFoundError('Course not found');

  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!teacher || teacher.id !== course.teacherId) {
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
    metadata: { title: updated.title },
    ipAddress,
  });

  return updated;
}

// ---------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------

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

  const enrollment = await prisma.courseEnrollment.create({
    data: {
      courseId,
      studentId,
      enrolledById: actorId,
    },
    include: {
      student: { include: { user: { select: { id: true, fullName: true, email: true } } } },
    },
  });

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

// ---------------------------------------------------------------
// Content
// ---------------------------------------------------------------

interface ListContentParams {
  courseId: string;
  role: string;
  userId: string;
  page?: number;
  pageSize?: number;
}

async function listContent({ courseId, role, userId, page = 1, pageSize = 20 }: ListContentParams) {
  // Verify course exists and access
  await getCourse({ courseId, role, userId });

  const where: ContentItemWhereInput = { courseId, isArchived: false };

  const [items, total] = await Promise.all([
    prisma.contentItem.findMany({
      where,
      include: {
        uploadedBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.contentItem.count({ where }),
  ]);

  return {
    items,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

interface UploadContentParams {
  actorId: string;
  courseId: string;
  data: {
    title: string;
    description?: string;
    url?: string;
    publicId?: string;
    mimeType?: string;
    sizeBytes?: number;
    type?: string;
  };
  ipAddress?: string | null;
}

async function uploadContent({ actorId, courseId, data, ipAddress }: UploadContentParams) {
  const { title, description, url, publicId, mimeType, sizeBytes } = data;

  if (!title || !url) {
    throw new ValidationError('Title and URL are required');
  }
  const validatedUrl = assertHttpUrl(url, 'URL');

  // Verify teacher owns the course
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new NotFoundError('Course not found');
  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!teacher || teacher.id !== course.teacherId) {
    throw new ForbiddenError('You can only upload content to your own courses');
  }

  const item = await prisma.contentItem.create({
    data: {
      courseId,
      title,
      description: description || null,
      url: validatedUrl,
      publicId: publicId || null,
      mimeType: mimeType || null,
      sizeBytes: sizeBytes || null,
      type: assertContentType(data.type),
      uploadedById: actorId,
    },
    include: {
      uploadedBy: { select: { id: true, fullName: true } },
    },
  });

  await writeAuditLog({
    actorId,
    action: 'CONTENT_UPLOADED',
    entity: 'ContentItem',
    entityId: item.id,
    metadata: { courseId, title },
    ipAddress,
  });

  return item;
}

interface ArchiveContentParams {
  actorId: string;
  contentId: string;
  ipAddress?: string | null;
}

async function archiveContent({ actorId, contentId, ipAddress }: ArchiveContentParams) {
  const item = await prisma.contentItem.findUnique({ where: { id: contentId } });
  if (!item) throw new NotFoundError('Content item not found');

  // Verify teacher owns the course
  const course = await prisma.course.findUnique({ where: { id: item.courseId } });
  if (!course) throw new NotFoundError('Course not found');
  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!teacher || teacher.id !== course.teacherId) {
    throw new ForbiddenError('You can only archive content in your own courses');
  }

  const updated = await prisma.contentItem.update({
    where: { id: contentId },
    data: { isArchived: true },
  });

  await writeAuditLog({
    actorId,
    action: 'CONTENT_ARCHIVED',
    entity: 'ContentItem',
    entityId: contentId,
    metadata: { courseId: item.courseId, title: item.title },
    ipAddress,
  });

  return updated;
}

export {
  listCourses,
  getCourse,
  createCourse,
  updateCourse,
  enrollStudent,
  unenrollStudent,
  listContent,
  uploadContent,
  archiveContent,
};