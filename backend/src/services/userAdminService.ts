// User admin service - admin user management and CSV bulk import (Member 6).
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import { writeAuditLog } from './auditService';
import { sanitizeUser } from './authService';
import env from '../config/env';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['ADMIN', 'TEACHER', 'STUDENT'];
// Fallback initial password for users created without an explicit one.
// Deployments should override it via DEFAULT_USER_PASSWORD so imported
// accounts do not all share a publicly-known secret.
const DEFAULT_PASSWORD = env.defaultUserPassword || 'Password123!';

function assertEmail(email: unknown): string {
  const value = String(email || '').toLowerCase().trim();
  if (!EMAIL_RE.test(value)) throw new ValidationError('A valid email is required');
  return value;
}

function assertPassword(password: unknown): string {
  const value = String(password || '');
  if (value && value.length < 8) throw new ValidationError('Password must be at least 8 characters');
  return value || DEFAULT_PASSWORD;
}

// Generate sequential codes like STU-0007 / TCH-0003.
async function generateCode(prefix: 'STU' | 'TCH'): Promise<string> {
  const count =
    prefix === 'STU'
      ? await prisma.student.count()
      : await prisma.teacher.count();
  let n = count + 1;
  // Guard against collisions when rows were deleted/reused.
  for (;;) {
    const code = `${prefix}-${String(n).padStart(4, '0')}`;
    const existing =
      prefix === 'STU'
        ? await prisma.student.findUnique({ where: { studentCode: code } })
        : await prisma.teacher.findUnique({ where: { employeeCode: code } });
    if (!existing) return code;
    n += 1;
  }
}

// ---------------------------------------------------------------
// List users
// ---------------------------------------------------------------

async function listUsers(opts: {
  role?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const { role, status, search, page = 1, pageSize = 20 } = opts;
  if (role && !ROLES.includes(role)) throw new ValidationError('Invalid role filter');
  if (status && !['ACTIVE', 'SUSPENDED', 'ARCHIVED'].includes(status)) {
    throw new ValidationError('Invalid status filter');
  }

  const where: Record<string, unknown> = {};
  if (role) where.role = role;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { student: true, teacher: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: users.map((u: any) => sanitizeUser(u)),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

// ---------------------------------------------------------------
// Create user (student/teacher/admin) - admin only
// ---------------------------------------------------------------

async function createUser(opts: {
  actorId: string;
  data: {
    email?: string;
    fullName?: string;
    role?: string;
    password?: string;
    phone?: string;
    gradeLevel?: string;
    section?: string;
    subject?: string;
  };
  ipAddress?: string | null;
}) {
  const { actorId, data, ipAddress } = opts;
  const email = assertEmail(data.email);
  const fullName = (data.fullName || '').trim();
  if (!fullName) throw new ValidationError('Full name is required');
  const role = (data.role || '').toUpperCase();
  if (!ROLES.includes(role)) throw new ValidationError('role must be ADMIN, TEACHER, or STUDENT');
  const passwordHash = await bcrypt.hash(assertPassword(data.password), 10);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ConflictError('A user with this email already exists');

  let user;
  // A concurrent createUser can generate the same sequential code
  // (count-based generation is check-then-use). Retry with a regenerated
  // code; the unique constraint is the authoritative guard.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      user = await prisma.$transaction(async (tx: any) => {
      const created = await tx.user.create({
        data: { email, fullName, role, phone: data.phone || null, passwordHash },
      });
      if (role === 'STUDENT') {
        if (!data.gradeLevel) throw new ValidationError('gradeLevel is required for students');
        const studentCode = await generateCode('STU');
        await tx.student.create({
          data: {
            userId: created.id,
            studentCode,
            gradeLevel: data.gradeLevel,
            section: data.section || null,
          },
        });
      } else if (role === 'TEACHER') {
        const employeeCode = await generateCode('TCH');
        await tx.teacher.create({
          data: { userId: created.id, employeeCode, subject: data.subject || null },
        });
      }
      return tx.user.findUnique({
        where: { id: created.id },
        include: { student: true, teacher: true },
      });
    });
    break;
  } catch (err: any) {
    // Concurrent creations with the same email race past the pre-check.
    // A duplicate code (studentCode/employeeCode) is retried with a freshly
    // generated one; distinguishable because the email pre-check already
    // filtered exact email duplicates and the profile create is what fails.
    if (err?.code === 'P2002') {
      const target = JSON.stringify(err?.meta?.target || '');
      if (target.includes('email') || attempt === 2) {
        throw new ConflictError('A user with this email already exists');
      }
      continue; // duplicate generated code - regenerate and retry
    }
    throw err;
  }
  }

  await writeAuditLog({
    actorId,
    action: 'USER_CREATED',
    entity: 'User',
    entityId: user!.id,
    metadata: { email, role },
    ipAddress,
  });

  return sanitizeUser(user);
}

// ---------------------------------------------------------------
// Update user
// ---------------------------------------------------------------

async function updateUser(opts: {
  actorId: string;
  userId: string;
  data: {
    fullName?: string;
    phone?: string;
    status?: string;
    gradeLevel?: string;
    section?: string;
    subject?: string;
  };
  ipAddress?: string | null;
}) {
  const { actorId, userId, data, ipAddress } = opts;
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: { student: true, teacher: true },
  });
  if (!existing) throw new NotFoundError('User not found');

  if (data.status && !['ACTIVE', 'SUSPENDED', 'ARCHIVED'].includes(data.status)) {
    throw new ValidationError('Invalid status');
  }

  const user = await prisma.$transaction(async (tx: any) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        ...(data.fullName !== undefined ? { fullName: data.fullName.trim() } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });
    if (existing.student && (data.gradeLevel !== undefined || data.section !== undefined)) {
      await tx.student.update({
        where: { id: existing.student.id },
        data: {
          ...(data.gradeLevel !== undefined ? { gradeLevel: data.gradeLevel } : {}),
          ...(data.section !== undefined ? { section: data.section } : {}),
        },
      });
    }
    if (existing.teacher && data.subject !== undefined) {
      await tx.teacher.update({
        where: { id: existing.teacher.id },
        data: { subject: data.subject },
      });
    }
    return tx.user.findUnique({
      where: { id: updated.id },
      include: { student: true, teacher: true },
    });
  });

  // Capture before/after values for the audit trail (no sensitive fields
  // exist on User updates).
  const changes: Record<string, { from: string | null; to: string | null }> = {};
  if (data.fullName !== undefined && data.fullName.trim() !== existing.fullName) {
    changes.fullName = { from: existing.fullName, to: data.fullName.trim() };
  }
  if (data.phone !== undefined && data.phone !== existing.phone) {
    changes.phone = { from: existing.phone ?? null, to: data.phone ?? null };
  }
  if (data.status !== undefined && data.status !== existing.status) {
    changes.status = { from: existing.status, to: data.status };
  }
  if (data.gradeLevel !== undefined && existing.student && data.gradeLevel !== existing.student.gradeLevel) {
    changes.gradeLevel = { from: existing.student.gradeLevel, to: data.gradeLevel };
  }
  if (data.section !== undefined && existing.student && data.section !== existing.student.section) {
    changes.section = { from: existing.student.section ?? null, to: data.section ?? null };
  }
  if (data.subject !== undefined && existing.teacher && data.subject !== existing.teacher.subject) {
    changes.subject = { from: existing.teacher.subject ?? null, to: data.subject ?? null };
  }

  await writeAuditLog({
    actorId,
    action: 'USER_UPDATED',
    entity: 'User',
    entityId: userId,
    metadata: { changes },
    ipAddress,
  });

  return sanitizeUser(user);
}

// ---------------------------------------------------------------
// Archive user (soft delete)
// ---------------------------------------------------------------

async function archiveUser(opts: { actorId: string; userId: string; ipAddress?: string | null }) {
  const { actorId, userId, ipAddress } = opts;
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) throw new NotFoundError('User not found');
  if (existing.status === 'ARCHIVED') throw new ConflictError('User is already archived');
  if (existing.id === actorId) throw new ValidationError('You cannot archive your own account');
  if (existing.role === 'ADMIN') {
    // Never allow zero active admins - that would lock out the whole system.
    const otherActiveAdmins = await prisma.user.count({
      where: { role: 'ADMIN', status: 'ACTIVE', id: { not: userId } },
    });
    if (otherActiveAdmins === 0) {
      throw new ConflictError('Cannot archive the last active admin');
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { status: 'ARCHIVED' },
    include: { student: true, teacher: true },
  });

  await writeAuditLog({
    actorId,
    action: 'USER_ARCHIVED',
    entity: 'User',
    entityId: userId,
    metadata: { email: existing.email, role: existing.role },
    ipAddress,
  });

  return sanitizeUser(user);
}

// ---------------------------------------------------------------
// Admin password reset
// ---------------------------------------------------------------

/**
 * Generate a random temporary password, hash it, and return it ONCE to the
 * admin (who hands it to the user offline). The password is never logged or
 * stored in plaintext.
 */
async function resetUserPassword(opts: { actorId: string; userId: string; ipAddress?: string | null }) {
  const { actorId, userId, ipAddress } = opts;
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) throw new NotFoundError('User not found');
  if (existing.status === 'ARCHIVED') {
    throw new ConflictError('Cannot reset the password of an archived user');
  }

  const temporaryPassword = crypto.randomBytes(12).toString('base64url');
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  await writeAuditLog({
    actorId,
    action: 'PASSWORD_RESET',
    entity: 'User',
    entityId: userId,
    metadata: { email: existing.email, role: existing.role },
    ipAddress,
  });

  return { userId, temporaryPassword };
}

// ---------------------------------------------------------------
// CSV bulk import
// Expected header: fullName,email,role,password,gradeLevel,section,subject
// ---------------------------------------------------------------

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

async function importUsersCsv(opts: {
  actorId: string;
  csv: string;
  filename?: string;
  ipAddress?: string | null;
}) {
  const { actorId, csv, filename = 'upload.csv', ipAddress } = opts;
  if (!csv || typeof csv !== 'string' || csv.trim().length === 0) {
    throw new ValidationError('CSV content is required');
  }

  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new ValidationError('CSV must include a header row and at least one data row');
  }
  // Cap rows so a huge import cannot run past the request timeout and leave
  // the batch orphaned as PENDING forever.
  if (lines.length - 1 > 5000) {
    throw new ValidationError('CSV import is limited to 5000 rows per batch');
  }

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const requiredCols = ['fullname', 'email', 'role'];
  for (const col of requiredCols) {
    if (!header.includes(col)) {
      throw new ValidationError(`CSV header must include "${col}"`);
    }
  }
  const colIndex = (name: string) => header.indexOf(name);

  const batch = await prisma.importBatch.create({
    data: {
      filename,
      status: 'PENDING',
      totalRows: lines.length - 1,
      createdById: actorId,
    },
  });

  const errors: Array<{ rowNumber: number; email: string | null; message: string }> = [];
  let successCount = 0;
  const status = () => (successCount === 0 ? 'FAILED' : errors.length > 0 ? 'PARTIAL' : 'COMPLETED');

  // If anything unexpected escapes the per-row handling, mark the batch
  // FAILED so it cannot be orphaned as PENDING forever, then rethrow.
  try {
    for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1; // 1-based including header
    const fields = parseCsvLine(lines[i]);
    const get = (name: string) => {
      const idx = colIndex(name);
      return idx >= 0 ? fields[idx] : '';
    };

    try {
      const email = assertEmail(get('email'));
      const fullName = get('fullname') || get('full_name');
      if (!fullName) throw new ValidationError('fullName is required');
      const role = (get('role') || '').toUpperCase();
      if (!ROLES.includes(role)) throw new ValidationError('role must be ADMIN, TEACHER, or STUDENT');

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) throw new ConflictError(`Duplicate email ${email}`);

      const passwordHash = await bcrypt.hash(assertPassword(get('password')), 10);

      await prisma.$transaction(async (tx: any) => {
        const created = await tx.user.create({
          data: {
            email,
            fullName,
            role,
            phone: get('phone') || null,
            passwordHash,
          },
        });
        if (role === 'STUDENT') {
          const gradeLevel = get('gradelevel') || get('grade_level');
          if (!gradeLevel) throw new ValidationError('gradeLevel is required for students');
          const studentCode = await generateCode('STU');
          await tx.student.create({
            data: {
              userId: created.id,
              studentCode,
              gradeLevel,
              section: get('section') || null,
            },
          });
        } else if (role === 'TEACHER') {
          const employeeCode = await generateCode('TCH');
          await tx.teacher.create({
            data: {
              userId: created.id,
              employeeCode,
              subject: get('subject') || null,
            },
          });
        }
      });
      successCount += 1;
    } catch (err: any) {
      errors.push({
        rowNumber,
        email: (() => {
          try {
            return assertEmail(get('email'));
          } catch {
            return null;
          }
        })(),
        message: err.message || 'Unknown error',
      });
    }
  }

  await prisma.$transaction(async (tx: any) => {
    await tx.importBatch.update({
      where: { id: batch.id },
      data: { status: status(), successCount, errorCount: errors.length },
    });
    for (const e of errors) {
      await tx.importError.create({
        data: { batchId: batch.id, rowNumber: e.rowNumber, email: e.email, message: e.message },
      });
    }
  });
  } catch (err) {
    await prisma.importBatch
      .update({ where: { id: batch.id }, data: { status: 'FAILED', errorCount: errors.length } })
      .catch(() => undefined);
    throw err;
  }

  await writeAuditLog({
    actorId,
    action: 'USERS_IMPORTED',
    entity: 'ImportBatch',
    entityId: batch.id,
    metadata: { filename, totalRows: lines.length - 1, successCount, errorCount: errors.length },
    ipAddress,
  });

  return {
    batchId: batch.id,
    filename,
    totalRows: lines.length - 1,
    successCount,
    errorCount: errors.length,
    status: status(),
    errors,
  };
}

export { listUsers, createUser, updateUser, archiveUser, resetUserPassword, importUsersCsv, parseCsvLine };