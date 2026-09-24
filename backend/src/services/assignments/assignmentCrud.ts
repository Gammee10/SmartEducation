// Assignment CRUD (REFACTORING_PLAN Stage 3). Submissions and grading live
// in sibling modules; this file owns assignment records only.
import prisma from '../../prisma/client';
import { Prisma } from '@prisma/client';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../../utils/errors';
import { writeAuditLog } from '../auditService';
import { assertValidDate } from '../../shared/validation';
import { isAdminRole, adminOverrideMeta, requireCourseAccess } from '../../shared/accessPolicy';
import { assertStatusCode, buildPagination, userInfoSelect } from './shared';

interface PaginationParams {
  page?: number;
  pageSize?: number;
}

interface ListCourseAssignmentsParams extends PaginationParams {
  courseId: string;
  role: string;
  userId: string;
  status?: string;
}

async function listCourseAssignments({ courseId, role, userId, status, page = 1, pageSize = 20 }: ListCourseAssignmentsParams) {
  // Enforce course access (teacher owner, enrolled student, or admin)
  await requireCourseAccess({ courseId, role, userId });

  const where: Prisma.AssignmentWhereInput = { courseId };
  if (status) {
    // H8: students must never enumerate non-published titles via ?status=.
    // Invalid values are rejected with 422 (never a raw Prisma 500).
    const validated = assertStatusCode(status);
    if (role === 'STUDENT' && validated !== 'PUBLISHED') {
      throw new ForbiddenError('Students can only list published assignments');
    }
    where.status = validated;
  } else if (role === 'STUDENT') {
    where.status = 'PUBLISHED';
  } else {
    where.status = { not: 'ARCHIVED' };
  }

  // Students also get their own submission included
  let studentId: string | undefined;
  if (role === 'STUDENT') {
    const student = await prisma.student.findUnique({ where: { userId } });
    if (student) studentId = student.id;
  }

  const include: Prisma.AssignmentInclude = {
    _count: { select: { submissions: true } },
  };
  if (studentId) {
    include.submissions = { where: { studentId } };
  }

  const [assignments, total] = await Promise.all([
    prisma.assignment.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.assignment.count({ where }),
  ]);

  return { assignments, pagination: buildPagination(total, page, pageSize) };
}

interface GetAssignmentParams {
  assignmentId: string;
  role: string;
  userId: string;
}

/**
 * Loads an assignment with access control. Students only see published
 * assignments on active courses and only their own submission.
 */
async function getAssignmentDetails({ assignmentId, role, userId }: GetAssignmentParams) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      course: {
        include: {
          teacher: { include: { user: { select: userInfoSelect } } },
        },
      },
    },
  });
  if (!assignment) throw new NotFoundError('Assignment not found');

  const submissionsInclude = {
    student: { include: { user: { select: userInfoSelect } } },
  };

  // Admin can view everything
  if (role === 'ADMIN') {
    const submissions = await prisma.assignmentSubmission.findMany({
      where: { assignmentId },
      include: submissionsInclude,
      orderBy: { submittedAt: 'desc' },
    });
    return { assignment, submissions };
  }

  // Teacher must own the course
  if (role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({ where: { userId } });
    if (!teacher || teacher.id !== assignment.course.teacherId) {
      throw new ForbiddenError('You can only view assignments in your own courses');
    }
    const submissions = await prisma.assignmentSubmission.findMany({
      where: { assignmentId },
      include: submissionsInclude,
      orderBy: { submittedAt: 'desc' },
    });
    return { assignment, submissions };
  }

  // Student must be enrolled and the assignment must be published
  if (role === 'STUDENT') {
    if (assignment.course.status !== 'ACTIVE' || assignment.status !== 'PUBLISHED') {
      throw new ForbiddenError('This assignment is not available yet');
    }
    const student = await prisma.student.findUnique({ where: { userId } });
    if (!student) throw new NotFoundError('Student profile not found');
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId: assignment.courseId, studentId: student.id } },
    });
    if (!enrollment || enrollment.status !== 'ACTIVE') {
      throw new ForbiddenError('You are not enrolled in this course');
    }
    const submissions = await prisma.assignmentSubmission.findMany({
      where: { assignmentId, studentId: student.id },
      include: submissionsInclude,
      orderBy: { submittedAt: 'desc' },
    });
    return { assignment, submissions };
  }

  throw new ForbiddenError('You do not have access to this assignment');
}

interface CreateAssignmentParams {
  actorId: string;
  courseId: string;
  data: {
    title: string;
    instructions?: string;
    maxScore: number | string;
    dueDate?: string | Date | null;
    status?: string;
  };
  ipAddress?: string | null;
}

async function createAssignment({ actorId, courseId, data, ipAddress }: CreateAssignmentParams) {
  const title = (data.title || '').trim();
  if (!title) {
    throw new ValidationError('Assignment title is required');
  }
  const maxScore = Number(data.maxScore);
  if (!Number.isInteger(maxScore) || maxScore < 1) {
    throw new ValidationError('Max score must be a positive whole number');
  }
  const status = assertStatusCode(data.status);
  let dueDate: Date | null = null;
  if (data.dueDate !== undefined && data.dueDate !== null && data.dueDate !== '') {
    dueDate = assertValidDate(data.dueDate, 'Due date');
  }

  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!teacher) throw new NotFoundError('Teacher profile not found');

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new NotFoundError('Course not found');
  if (course.teacherId !== teacher.id) {
    throw new ForbiddenError('You can only create assignments in your own courses');
  }

  const assignment = await prisma.assignment.create({
    data: {
      courseId,
      title,
      instructions: data.instructions || null,
      maxScore,
      dueDate,
      status,
      createdById: actorId,
    },
    include: {
      course: { include: { teacher: { include: { user: { select: userInfoSelect } } } } },
    },
  });

  await writeAuditLog({
    actorId,
    action: 'ASSIGNMENT_CREATED',
    entity: 'Assignment',
    entityId: assignment.id,
    metadata: { courseId, title, maxScore, dueDate: dueDate ? dueDate.toISOString() : null, status },
    ipAddress,
  });

  return assignment;
}

interface UpdateAssignmentParams {
  actorId: string;
  actorRole?: string;
  assignmentId: string;
  data: {
    title?: string;
    instructions?: string | null;
    maxScore?: number | string;
    dueDate?: string | Date | null;
    status?: string;
  };
  ipAddress?: string | null;
}

async function updateAssignment({ actorId, actorRole, assignmentId, data, ipAddress }: UpdateAssignmentParams) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { course: true },
  });
  if (!assignment) throw new NotFoundError('Assignment not found');

  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!isAdminRole(actorRole) && (!teacher || teacher.id !== assignment.course.teacherId)) {
    throw new ForbiddenError('You can only manage assignments in your own courses');
  }

  const updateData: Prisma.AssignmentUpdateInput = {};

  if (data.title !== undefined) {
    const title = (data.title || '').trim();
    if (!title) throw new ValidationError('Assignment title cannot be empty');
    updateData.title = title;
  }

  if (data.instructions !== undefined) {
    updateData.instructions = data.instructions || null;
  }

  if (data.maxScore !== undefined) {
    const maxScore = Number(data.maxScore);
    if (!Number.isInteger(maxScore) || maxScore < 1) {
      throw new ValidationError('Max score must be a positive whole number');
    }
    // H9: never lower maxScore below an already-awarded score (would create
    // score > maxScore states and retroactively change averages). Raising is
    // allowed and audited old->new below.
    if (maxScore < assignment.maxScore) {
      const top = await prisma.assignmentSubmission.aggregate({
        where: { assignmentId },
        _max: { score: true },
      });
      const maxAwarded = top._max.score;
      if (maxAwarded != null && maxScore < maxAwarded) {
        throw new ConflictError(
          `Cannot lower max score below the highest awarded score (${maxAwarded})`
        );
      }
    }
    updateData.maxScore = maxScore;
  }

  if (data.dueDate !== undefined) {
    if (data.dueDate === null || data.dueDate === '') {
      updateData.dueDate = null;
    } else {
      updateData.dueDate = assertValidDate(data.dueDate, 'Due date');
    }
  }

  if (data.status !== undefined) {
    updateData.status = assertStatusCode(data.status);
  }

  const updated = await prisma.assignment.update({
    where: { id: assignmentId },
    data: updateData,
    include: {
      course: { include: { teacher: { include: { user: { select: userInfoSelect } } } } },
    },
  });

  await writeAuditLog({
    actorId,
    action: 'ASSIGNMENT_UPDATED',
    entity: 'Assignment',
    entityId: assignmentId,
    metadata: {
      courseId: assignment.courseId,
      title: updated.title,
      status: updated.status,
      ...(updateData.maxScore !== undefined && updateData.maxScore !== assignment.maxScore
        ? { maxScore: { from: assignment.maxScore, to: updateData.maxScore } }
        : {}),
      ...adminOverrideMeta(actorRole, assignment.course.teacherId),
    },
    ipAddress,
  });

  return updated;
}

interface ArchiveAssignmentParams {
  actorId: string;
  actorRole?: string;
  assignmentId: string;
  ipAddress?: string | null;
}

async function archiveAssignment({ actorId, actorRole, assignmentId, ipAddress }: ArchiveAssignmentParams) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { course: true },
  });
  if (!assignment) throw new NotFoundError('Assignment not found');

  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!isAdminRole(actorRole) && (!teacher || teacher.id !== assignment.course.teacherId)) {
    throw new ForbiddenError('You can only archive assignments in your own courses');
  }

  const updated = await prisma.assignment.update({
    where: { id: assignmentId },
    data: { status: 'ARCHIVED' },
  });

  await writeAuditLog({
    actorId,
    action: 'ASSIGNMENT_ARCHIVED',
    entity: 'Assignment',
    entityId: assignmentId,
    metadata: {
      courseId: assignment.courseId,
      title: assignment.title,
      ...adminOverrideMeta(actorRole, assignment.course.teacherId),
    },
    ipAddress,
  });

  return updated;
}

export { listCourseAssignments, getAssignmentDetails, createAssignment, updateAssignment, archiveAssignment };
