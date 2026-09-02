// Assignment service - assignment CRUD, submissions, and grading.
import prisma from '../prisma/client';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../utils/errors';
import { writeAuditLog } from './auditService';
import { createNotification } from './notificationService';
import { uploadFile } from './fileStorageService';
import { getCourse as getCourseWithAccess } from './courseService';



type AssignmentStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';

const ASSIGNMENT_STATUSES: AssignmentStatus[] = ['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'];

interface SubmissionFile {
  path?: string;
  buffer?: Buffer;
  mimetype?: string;
  size?: number;
}

interface PaginationParams {
  page?: number;
  pageSize?: number;
}

const userInfoSelect = { id: true, fullName: true, email: true };

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function assertValidDate(value: string | Date, field = 'Due date'): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`${field} is not a valid date`);
  }
  return date;
}

function assertStatusCode(status: string | undefined): AssignmentStatus {
  if (status !== undefined && !ASSIGNMENT_STATUSES.includes(status as AssignmentStatus)) {
    throw new ValidationError('Invalid assignment status');
  }
  return (status || 'DRAFT') as AssignmentStatus;
}

function buildPagination(total: number, page: number, pageSize: number) {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

// ---------------------------------------------------------------
// Assignment CRUD
// ---------------------------------------------------------------

interface ListCourseAssignmentsParams extends PaginationParams {
  courseId: string;
  role: string;
  userId: string;
  status?: string;
}

async function listCourseAssignments({ courseId, role, userId, status, page = 1, pageSize = 20 }: ListCourseAssignmentsParams) {
  // Enforce course access (teacher owner, enrolled student, or admin)
  await getCourseWithAccess({ courseId, role, userId });

  let where: Record<string, unknown> = { courseId };
  if (status) {
    where.status = status;
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

  const include: Record<string, unknown> = {
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
    dueDate = assertValidDate(data.dueDate);
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

async function updateAssignment({ actorId, assignmentId, data, ipAddress }: UpdateAssignmentParams) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { course: true },
  });
  if (!assignment) throw new NotFoundError('Assignment not found');

  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!teacher || teacher.id !== assignment.course.teacherId) {
    throw new ForbiddenError('You can only manage assignments in your own courses');
  }

  const updateData: Record<string, unknown> = {};

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
    updateData.maxScore = maxScore;
  }

  if (data.dueDate !== undefined) {
    if (data.dueDate === null || data.dueDate === '') {
      updateData.dueDate = null;
    } else {
      updateData.dueDate = assertValidDate(data.dueDate);
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
    metadata: { courseId: assignment.courseId, title: updated.title, status: updated.status },
    ipAddress,
  });

  return updated;
}

interface ArchiveAssignmentParams {
  actorId: string;
  assignmentId: string;
  ipAddress?: string | null;
}

async function archiveAssignment({ actorId, assignmentId, ipAddress }: ArchiveAssignmentParams) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { course: true },
  });
  if (!assignment) throw new NotFoundError('Assignment not found');

  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!teacher || teacher.id !== assignment.course.teacherId) {
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
    metadata: { courseId: assignment.courseId, title: assignment.title },
    ipAddress,
  });

  return updated;
}

// ---------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------

interface SubmitAssignmentParams {
  actorId: string;
  assignmentId: string;
  data: { content?: string };
  file?: SubmissionFile | null;
  ipAddress?: string | null;
}

async function submitAssignment({ actorId, assignmentId, data, file, ipAddress }: SubmitAssignmentParams) {
  const content = (data.content || '').trim();

  const student = await prisma.student.findUnique({ where: { userId: actorId } });
  if (!student) throw new NotFoundError('Student profile not found');

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { course: true },
  });
  if (!assignment) throw new NotFoundError('Assignment not found');

  if (assignment.course.status !== 'ACTIVE' || assignment.status !== 'PUBLISHED') {
    throw new ForbiddenError('This assignment is not open for submissions');
  }

  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { courseId_studentId: { courseId: assignment.courseId, studentId: student.id } },
  });
  if (!enrollment || enrollment.status !== 'ACTIVE') {
    throw new ForbiddenError('You must be enrolled in this course to submit');
  }

  const existing = await prisma.assignmentSubmission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
  });
  if (existing) {
    throw new ConflictError('You have already submitted this assignment');
  }

  if (!content && !file) {
    throw new ValidationError('Submission text or a file is required');
  }

  // Upload submission file through Cloudinary (if provided)
  let fileFields: Record<string, unknown> = {};
  if (file) {
    const upload = await uploadFile(file as never, 'assignment-submissions');
    fileFields = {
      fileUrl: upload.url,
      publicId: upload.publicId,
      mimeType: upload.mimeType,
      sizeBytes: upload.sizeBytes,
    };
  }

  const isLate = assignment.dueDate ? new Date() > new Date(assignment.dueDate) : false;

  let submission;
  try {
    submission = await prisma.assignmentSubmission.create({
      data: {
        assignmentId,
        studentId: student.id,
        content: content || null,
        ...fileFields,
        isLate,
      },
      include: {
        assignment: { include: { course: true } },
      },
    });
  } catch (err: any) {
    // Double-click / retry races pass the pre-check above; the unique
    // constraint is the authoritative guard.
    if (err?.code === 'P2002') {
      throw new ConflictError('You have already submitted this assignment');
    }
    throw err;
  }

  await writeAuditLog({
    actorId,
    action: 'SUBMISSION_SUBMITTED',
    entity: 'AssignmentSubmission',
    entityId: submission.id,
    metadata: { assignmentId, hasFile: Boolean(file), isLate },
    ipAddress,
  });

  return submission;
}

interface ListSubmissionsParams extends PaginationParams {
  actorId: string;
  assignmentId: string;
}

async function listSubmissions({ actorId, assignmentId, page = 1, pageSize = 20 }: ListSubmissionsParams) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { course: true },
  });
  if (!assignment) throw new NotFoundError('Assignment not found');

  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!teacher || teacher.id !== assignment.course.teacherId) {
    throw new ForbiddenError('You can only view submissions in your own courses');
  }

  const where = { assignmentId };
  const [submissions, total] = await Promise.all([
    prisma.assignmentSubmission.findMany({
      where,
      include: {
        student: { include: { user: { select: userInfoSelect } } },
      },
      orderBy: { submittedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.assignmentSubmission.count({ where }),
  ]);

  return { submissions, pagination: buildPagination(total, page, pageSize) };
}

interface GradeSubmissionParams {
  actorId: string;
  submissionId: string;
  data: { score: number | string; feedback?: string };
  ipAddress?: string | null;
}

async function gradeSubmission({ actorId, submissionId, data, ipAddress }: GradeSubmissionParams) {
  if (data.score === undefined || data.score === null || data.score === '') {
    throw new ValidationError('Score is required');
  }
  const score = Number(data.score);
  if (!Number.isFinite(score) || score < 0) {
    throw new ValidationError('Score must be a non-negative number');
  }
  const feedback = data.feedback !== undefined ? (data.feedback || '').trim() : null;

  const submission = await prisma.assignmentSubmission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: true,
      student: { include: { user: { select: userInfoSelect } } },
    },
  });
  if (!submission) throw new NotFoundError('Submission not found');

  const course = await prisma.course.findUnique({ where: { id: submission.assignment.courseId } });
  if (!course) throw new NotFoundError('Course not found');
  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!teacher || teacher.id !== course.teacherId) {
    throw new ForbiddenError('You can only grade submissions in your own courses');
  }

  if (score > submission.assignment.maxScore) {
    throw new ValidationError(`Score cannot exceed max score (${submission.assignment.maxScore})`);
  }

  // Grading, audit, and notification happen in one transaction.
  const graded = await prisma.$transaction(async (tx: any) => {
    const updated = await tx.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'GRADED',
        score,
        feedback,
        gradedById: actorId,
        gradedAt: new Date(),
      },
      include: {
        assignment: true,
        student: { include: { user: { select: userInfoSelect } } },
      },
    });

    await writeAuditLog(
      {
        actorId,
        action: 'SUBMISSION_GRADED',
        entity: 'AssignmentSubmission',
        entityId: submissionId,
        metadata: {
          assignmentId: submission.assignmentId,
          score,
          maxScore: submission.assignment.maxScore,
          previousScore: submission.score ?? null,
          feedback,
        },
        ipAddress,
      },
      tx
    );

    await createNotification(
      {
        userId: submission.student.userId,
        title: 'Assignment graded',
        message: `Your assignment "${submission.assignment.title}" was graded: ${score}/${submission.assignment.maxScore}`,
        type: 'GRADE',
        metadata: {
          assignmentId: submission.assignmentId,
          submissionId,
          score,
          maxScore: submission.assignment.maxScore,
        },
      },
      tx
    );

    return updated;
  });

  return graded;
}

export {
  listCourseAssignments,
  getAssignmentDetails,
  createAssignment,
  updateAssignment,
  archiveAssignment,
  submitAssignment,
  listSubmissions,
  gradeSubmission,
};