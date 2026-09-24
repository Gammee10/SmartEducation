// Assignment grading (REFACTORING_PLAN Stage 3). Grading, audit, and the
// student notification happen in one transaction.
import prisma from '../../prisma/client';
import { NotFoundError, ForbiddenError, ValidationError } from '../../utils/errors';
import { writeAuditLog } from '../auditService';
import { createNotification } from '../notificationService';
import { isAdminRole, adminOverrideMeta } from '../../shared/accessPolicy';
import { userInfoSelect } from './shared';

interface GradeSubmissionParams {
  actorId: string;
  actorRole?: string;
  submissionId: string;
  data: { score: number | string; feedback?: string };
  ipAddress?: string | null;
}

async function gradeSubmission({ actorId, actorRole, submissionId, data, ipAddress }: GradeSubmissionParams) {
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
  if (!isAdminRole(actorRole) && (!teacher || teacher.id !== course.teacherId)) {
    throw new ForbiddenError('You can only grade submissions in your own courses');
  }

  if (score > submission.assignment.maxScore) {
    throw new ValidationError(`Score cannot exceed max score (${submission.assignment.maxScore})`);
  }

  // Grading, audit, and notification happen in one transaction.
  const graded = await prisma.$transaction(async (tx) => {
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
          ...adminOverrideMeta(actorRole, course.teacherId),
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

export { gradeSubmission };
