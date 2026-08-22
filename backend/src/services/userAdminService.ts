// User admin service - admin user management and CSV bulk import (Member 6).
import bcrypt from 'bcryptjs';
import prisma from '../prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import { writeAuditLog } from './auditService';
import { sanitizeUser } from './authService';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['ADMIN', 'TEACHER', 'STUDENT'];
const DEFAULT_PASSWORD = 'Password123!';

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

  const user = await prisma.$transaction(async (tx: any) => {
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

  await writeAuditLog({
    actorId,
    action: 'USER_UPDATED',
    entity: 'User',
    entityId: userId,
    metadata: { changes: Object.keys(data) },
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

  const status = successCount === 0 ? 'FAILED' : errors.length > 0 ? 'PARTIAL' : 'COMPLETED';

  await prisma.$transaction(async (tx: any) => {
    await tx.importBatch.update({
      where: { id: batch.id },
      data: { status, successCount, errorCount: errors.length },
    });
    for (const e of errors) {
      await tx.importError.create({
        data: { batchId: batch.id, rowNumber: e.rowNumber, email: e.email, message: e.message },
      });
    }
  });

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
    status,
    errors,
  };
}

export { listUsers, createUser, updateUser, archiveUser, importUsersCsv, parseCsvLine };