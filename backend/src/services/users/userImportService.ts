// User admin - CSV bulk import. Split out of userAdminService
// (REFACTORING_PLAN Stage 3): the hand-rolled CSV parser and per-row
// validator are isolated from user CRUD. Shared validation rules come from
// ./userCrudService so a row is validated exactly like a single create.
// Expected header: fullName,email,role,password,gradeLevel,section,subject
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import prisma from '../../prisma/client';
import { ValidationError, ConflictError } from '../../utils/errors';
import { writeAuditLog } from '../auditService';
import logger from '../../utils/logger';
import env from '../../config/env';
import { assertEmail, assertPassword, generateCode, ROLES } from './userCrudService';

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
  let warnedFallbackPassword = false;
  const status = () => (successCount === 0 ? 'FAILED' : errors.length > 0 ? 'PARTIAL' : 'COMPLETED');

  // H5: one row, self-contained so rows can run concurrently. Throws on
  // row failure; the caller records it and continues with the next row.
  const processRow = async (rowNumber: number, line: string): Promise<void> => {
    const fields = parseCsvLine(line);
    const get = (name: string) => {
      const idx = colIndex(name);
      return idx >= 0 ? fields[idx] : '';
    };

    const email = assertEmail(get('email'));
    const fullName = get('fullname') || get('full_name');
    if (!fullName) throw new ValidationError('fullName is required');
    const role = (get('role') || '').toUpperCase();
    if (!ROLES.includes(role)) throw new ValidationError('role must be ADMIN, TEACHER, or STUDENT');

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictError(`Duplicate email ${email}`);

    // M12 secret hygiene: rows without an explicit password share the
    // fallback secret. Warn loudly (once per import) so operators set
    // DEFAULT_USER_PASSWORD and rotate these accounts after first login.
    const rowPassword = get('password');
      if (!rowPassword && !env.defaultUserPassword && !warnedFallbackPassword) {
        warnedFallbackPassword = true;
        logger.warn(
          'csv import uses the built-in default password - set DEFAULT_USER_PASSWORD and rotate imported accounts'
        );
      }
    const passwordHash = await bcrypt.hash(assertPassword(rowPassword), 10);

    const phone = get('phone') || null;
    const gradeLevel = get('gradelevel') || get('grade_level');
    const section = get('section') || null;
    const subject = get('subject') || null;

    // H5: count-based generateCode can collide under concurrency (or with a
    // parallel import). Retry code-collision P2002s with a regenerated code,
    // mirroring createUser; email P2002s (pre-check race) are real
    // duplicates and rethrown for the row catch to report.
    let lastCodeCollision: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await prisma.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: { email, fullName, role: role as UserRole, phone, passwordHash },
          });
          if (role === 'STUDENT') {
            if (!gradeLevel) throw new ValidationError('gradeLevel is required for students');
            const studentCode = await generateCode('STU');
            await tx.student.create({
              data: { userId: created.id, studentCode, gradeLevel, section },
            });
          } else if (role === 'TEACHER') {
            const employeeCode = await generateCode('TCH');
            await tx.teacher.create({
              data: { userId: created.id, employeeCode, subject },
            });
          }
        });
        lastCodeCollision = null;
        break;
      } catch (err: any) {
        if (err?.code === 'P2002' && /Code/.test(JSON.stringify(err?.meta?.target || ''))) {
          lastCodeCollision = err;
          continue;
        }
        throw err;
      }
    }
    if (lastCodeCollision) throw lastCodeCollision;
  };

  const safeEmail = (line: string): string | null => {
    try {
      const fields = parseCsvLine(line);
      const idx = colIndex('email');
      return assertEmail(idx >= 0 ? fields[idx] : '');
    } catch {
      return null;
    }
  };

  // If anything unexpected escapes the per-row handling, mark the batch
  // FAILED so it cannot be orphaned as PENDING forever, then rethrow.
  try {
    // H5: bounded concurrency (4 rows at a time). Fully sequential imports
    // cost ~100ms of bcrypt + 3 DB roundtrips per row (5000 rows = many
    // minutes in one request -> gateway timeout); unbounded concurrency
    // would starve the event loop and the pool. Long-term: background queue
    // (BullMQ/pg-boss) + ImportBatch polling.
    const IMPORT_CONCURRENCY = 4;
    for (let i = 1; i < lines.length; i += IMPORT_CONCURRENCY) {
      const chunk = lines.slice(i, i + IMPORT_CONCURRENCY);
      const settled = await Promise.allSettled(
        chunk.map((line, offset) => processRow(i + 1 + offset, line))
      );
      for (let k = 0; k < settled.length; k++) {
        const outcome = settled[k];
        if (outcome.status === 'fulfilled') {
          successCount += 1;
        } else {
          const err: any = (outcome as PromiseRejectedResult).reason;
          const line = chunk[k];
          const email = safeEmail(line);
          errors.push({
            rowNumber: i + 1 + k,
            email,
            message:
              err?.code === 'P2002'
                ? `Duplicate email ${email || '(unknown)'}`
                : err?.message || 'Unknown error',
          });
        }
      }
    }

  await prisma.$transaction(async (tx) => {
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

export { importUsersCsv, parseCsvLine };
