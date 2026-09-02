// Tests for the user admin service - user management and CSV import (Member 6).
import { test } from 'node:test';
import assert from 'node:assert';

const state: any = {
  users: [
    { id: 'user-admin-1', email: 'admin@school.edu', fullName: 'Admin One', role: 'ADMIN', status: 'ACTIVE', phone: null, passwordHash: 'x' },
  ],
  students: [],
  teachers: [],
  importBatches: [],
  importErrors: [],
  auditLogs: [],
};

let nextId = 1;

const mockPrisma = {
  user: {
    findMany: async ({ where, skip = 0, take = 20 }: any) => {
      let result = [...state.users];
      if (where?.role) result = result.filter((u: any) => u.role === where.role);
      if (where?.status) result = result.filter((u: any) => u.status === where.status);
      if (where?.OR) {
        const s = String(where.OR[0].fullName.contains).toLowerCase();
        result = result.filter(
          (u: any) => u.fullName.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)
        );
      }
      return result.slice(skip, skip + take);
    },
    count: async ({ where }: any) => {
      let result = state.users;
      if (where?.role) result = result.filter((u: any) => u.role === where.role);
      if (where?.status) result = result.filter((u: any) => u.status === where.status);
      return result.length;
    },
    findUnique: async ({ where }: any) => {
      if (where.email) return state.users.find((u: any) => u.email === where.email) || null;
      return state.users.find((u: any) => u.id === where.id) || null;
    },
    create: async ({ data }: any) => {
      const rec = { id: `user-${nextId++}`, status: 'ACTIVE', ...data };
      state.users.push(rec);
      return rec;
    },
    update: async ({ where, data }: any) => {
      const idx = state.users.findIndex((u: any) => u.id === where.id);
      state.users[idx] = { ...state.users[idx], ...data };
      return { ...state.users[idx], student: null, teacher: null };
    },
  },
  student: {
    count: async () => state.students.length,
    findUnique: async ({ where }: any) =>
      state.students.find((s: any) => s.studentCode === where.studentCode || s.id === where.id) || null,
    create: async ({ data }: any) => {
      const rec = { id: `stu-${nextId++}`, ...data };
      state.students.push(rec);
      return rec;
    },
  },
  teacher: {
    count: async () => state.teachers.length,
    findUnique: async ({ where }: any) =>
      state.teachers.find((t: any) => t.employeeCode === where.employeeCode || t.id === where.id) || null,
    create: async ({ data }: any) => {
      const rec = { id: `tch-${nextId++}`, ...data };
      state.teachers.push(rec);
      return rec;
    },
  },
  importBatch: {
    create: async ({ data }: any) => {
      const rec = { id: `batch-${nextId++}`, ...data };
      state.importBatches.push(rec);
      return rec;
    },
    update: async ({ where, data }: any) => {
      const idx = state.importBatches.findIndex((b: any) => b.id === where.id);
      state.importBatches[idx] = { ...state.importBatches[idx], ...data };
      return state.importBatches[idx];
    },
  },
  importError: {
    create: async ({ data }: any) => {
      const rec = { id: `ierr-${nextId++}`, ...data };
      state.importErrors.push(rec);
      return rec;
    },
  },
  auditLog: {
    create: async ({ data }: any) => {
      const log = { id: `audit-${state.auditLogs.length + 1}`, ...data };
      state.auditLogs.push(log);
      return log;
    },
  },
  $transaction: async (fn: any) => fn(mockPrisma),
};

const prismaClientPath = require.resolve('../src/prisma/client');
require.cache[prismaClientPath] = { id: prismaClientPath, filename: prismaClientPath, loaded: true, exports: mockPrisma } as any;

const userAdminService = require('../src/services/userAdminService');
const { ValidationError, ConflictError, NotFoundError } = require('../src/utils/errors');

test('createUser creates a student with generated code and audit log', async () => {
  const result = await userAdminService.createUser({
    actorId: 'user-admin-1',
    data: { email: 'abebe@school.edu', fullName: 'Abebe Kebede', role: 'STUDENT', gradeLevel: 'Grade 9', section: 'A' },
  });
  assert.strictEqual(result.email, 'abebe@school.edu');
  assert.strictEqual(result.passwordHash, undefined); // never leak hash
  assert.strictEqual(state.students.length, 1);
  assert.match(state.students[0].studentCode, /^STU-\d{4}$/);
  assert.ok(state.auditLogs.some((l: any) => l.action === 'USER_CREATED'));
});

test('createUser rejects duplicate emails', async () => {
  await assert.rejects(
    userAdminService.createUser({
      actorId: 'user-admin-1',
      data: { email: 'abebe@school.edu', fullName: 'Duplicate', role: 'STUDENT', gradeLevel: 'Grade 9' },
    }),
    ConflictError
  );
});

test('createUser validates email, name, and role', async () => {
  await assert.rejects(
    userAdminService.createUser({ actorId: 'user-admin-1', data: { email: 'not-an-email', fullName: 'X', role: 'STUDENT', gradeLevel: '9' } }),
    ValidationError
  );
  await assert.rejects(
    userAdminService.createUser({ actorId: 'user-admin-1', data: { email: 'a@b.co', fullName: '', role: 'STUDENT', gradeLevel: '9' } }),
    ValidationError
  );
  await assert.rejects(
    userAdminService.createUser({ actorId: 'user-admin-1', data: { email: 'a@b.co', fullName: 'X', role: 'PRINCIPAL' } }),
    ValidationError
  );
});

test('createUser requires gradeLevel for students', async () => {
  await assert.rejects(
    userAdminService.createUser({ actorId: 'user-admin-1', data: { email: 'nograde@school.edu', fullName: 'No Grade', role: 'STUDENT' } }),
    ValidationError
  );
});

test('listUsers filters by role and search', async () => {
  await userAdminService.createUser({
    actorId: 'user-admin-1',
    data: { email: 'teacher2@school.edu', fullName: 'Second Teacher', role: 'TEACHER', subject: 'Physics' },
  });
  const teachers = await userAdminService.listUsers({ role: 'TEACHER' });
  assert.strictEqual(teachers.users.length, 1);
  assert.strictEqual(teachers.users[0].role, 'TEACHER');

  const search = await userAdminService.listUsers({ search: 'Abebe' });
  assert.strictEqual(search.users.length, 1);
});

test('archiveUser soft-deletes and prevents self-archive', async () => {
  const created = state.users.find((u: any) => u.email === 'teacher2@school.edu');
  const result = await userAdminService.archiveUser({ actorId: 'user-admin-1', userId: created.id });
  assert.strictEqual(result.status, 'ARCHIVED');

  await assert.rejects(
    userAdminService.archiveUser({ actorId: 'user-admin-1', userId: 'user-admin-1' }),
    ValidationError
  );
});

test('parseCsvLine handles quoted commas', () => {
  const fields = userAdminService.parseCsvLine('"Doe, Jane",jane@school.edu,STUDENT,,Grade 9,B');
  assert.strictEqual(fields[0], 'Doe, Jane');
  assert.strictEqual(fields[1], 'jane@school.edu');
  assert.strictEqual(fields[4], 'Grade 9');
});

test('importUsersCsv imports valid rows and reports invalid ones', async () => {
  const csv = [
    'fullName,email,role,password,gradeLevel,section,subject',
    'Hanna Tesfaye,hanna@school.edu,STUDENT,Password123!,Grade 10,B',
    'Bad Row,bad-email,STUDENT,,,',
    'Dup Row,hanna@school.edu,STUDENT,,,',
  ].join('\n');

  const result = await userAdminService.importUsersCsv({
    actorId: 'user-admin-1',
    csv,
    filename: 'students.csv',
  });

  assert.strictEqual(result.totalRows, 3);
  assert.strictEqual(result.successCount, 1);
  assert.strictEqual(result.errorCount, 2);
  assert.strictEqual(result.status, 'PARTIAL');
  assert.ok(state.importErrors.length >= 2);
  assert.ok(state.auditLogs.some((l: any) => l.action === 'USERS_IMPORTED'));
});

test('importUsersCsv rejects CSV without required header', async () => {
  await assert.rejects(
    userAdminService.importUsersCsv({ actorId: 'user-admin-1', csv: 'name,mail\nX,x@y.z' }),
    ValidationError
  );
});

test('resetUserPassword generates a temporary password and audits without logging it', async () => {
  const auditsBefore = state.auditLogs.length;
  const result = await userAdminService.resetUserPassword({
    actorId: 'user-admin-1',
    userId: 'user-admin-1',
  });

  assert.ok(result.temporaryPassword, 'temporary password returned once to the admin');
  assert.ok(result.temporaryPassword.length >= 16);
  const audit = state.auditLogs.slice(auditsBefore).find((l: any) => l.action === 'PASSWORD_RESET');
  assert.ok(audit, 'PASSWORD_RESET audit written');
  assert.ok(!JSON.stringify(audit).includes(result.temporaryPassword), 'password must not be logged');
});

test('resetUserPassword rejects missing users', async () => {
  await assert.rejects(
    () => userAdminService.resetUserPassword({ actorId: 'user-admin-1', userId: 'missing' }),
    NotFoundError
  );
});
