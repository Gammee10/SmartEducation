// Assignment submissions (REFACTORING_PLAN Stage 3). Grading lives in
// ./gradingService.ts.
import prisma from '../../prisma/client';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../../utils/errors';
import { writeAuditLog } from '../auditService';
import { uploadFile, deleteFile } from '../fileStorageService';
import { isAdminRole } from '../../shared/accessPolicy';
import { buildPagination, userInfoSelect } from './shared';

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
  let uploadedPublicId: string | null = null;
  if (file) {
    const upload = await uploadFile(file as never, 'assignment-submissions');
    uploadedPublicId = upload.publicId;
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
    // H4: the upload already succeeded and the asset is billable in
    // Cloudinary, but the DB row never persisted (duplicate-submit P2002 or
    // any other insert failure). Compensate by deleting the orphan before
    // rethrowing so retries cannot leak storage objects.
    if (uploadedPublicId) {
      await deleteFile(uploadedPublicId);
    }
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
  actorRole?: string;
  assignmentId: string;
}

async function listSubmissions({ actorId, actorRole, assignmentId, page = 1, pageSize = 20 }: ListSubmissionsParams) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { course: true },
  });
  if (!assignment) throw new NotFoundError('Assignment not found');

  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!isAdminRole(actorRole) && (!teacher || teacher.id !== assignment.course.teacherId)) {
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

export { submitAssignment, listSubmissions };
