// Course content (REFACTORING_PLAN Stage 3). URL-based content upload and
// archival; reads gate through courseCrud.getCourse for roster privacy.
import prisma from '../../prisma/client';
import { Prisma } from '@prisma/client';
import { NotFoundError, ForbiddenError, ValidationError } from '../../utils/errors';
import { assertHttpUrl } from '../../utils/url';
import { writeAuditLog } from '../auditService';
import { isAdminRole, adminOverrideMeta } from '../../shared/accessPolicy';
import { getCourse } from './courseCrud';
import { assertContentType } from './shared';

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

  const where: Prisma.ContentItemWhereInput = { courseId, isArchived: false };

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
  actorRole?: string;
  contentId: string;
  ipAddress?: string | null;
}

async function archiveContent({ actorId, actorRole, contentId, ipAddress }: ArchiveContentParams) {
  const item = await prisma.contentItem.findUnique({ where: { id: contentId } });
  if (!item) throw new NotFoundError('Content item not found');

  // Verify teacher owns the course
  const course = await prisma.course.findUnique({ where: { id: item.courseId } });
  if (!course) throw new NotFoundError('Course not found');
  const teacher = await prisma.teacher.findUnique({ where: { userId: actorId } });
  if (!isAdminRole(actorRole) && (!teacher || teacher.id !== course.teacherId)) {
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
    metadata: { courseId: item.courseId, title: item.title, ...adminOverrideMeta(actorRole, course.teacherId) },
    ipAddress,
  });

  return updated;
}

export { listContent, uploadContent, archiveContent };
