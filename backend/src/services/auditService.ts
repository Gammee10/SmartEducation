// Audit service - reusable audit logging for sensitive operations.
import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';

interface AuditLogParams {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
}

/**
 * Write an audit log entry.
 * Accepts an optional transaction client so callers can audit writes
 * inside a Prisma transaction (used by assignment grading).
 */
async function writeAuditLog(
  {
    actorId = null,
    action,
    entity,
    entityId = null,
    metadata = null,
    ipAddress = null,
  }: AuditLogParams,
  client: { auditLog: { create: (args: unknown) => Promise<unknown> } } = prisma as {
    auditLog: { create: (args: unknown) => Promise<unknown> };
  }
) {
  return client.auditLog.create({
    data: {
      actorId,
      action,
      entity,
      entityId,
      metadata: metadata || undefined,
      ipAddress,
    },
  });
}

/**
 * Convenience wrapper for library actions.
 */
async function auditLibraryAction(params: AuditLogParams) {
  return writeAuditLog(params);
}

export { writeAuditLog, auditLibraryAction };