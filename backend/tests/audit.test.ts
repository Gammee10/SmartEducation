// Tests for the audit service.
import { test } from 'node:test';
import assert from 'node:assert';

// Create a mock prisma client and inject it via require cache
const mockAuditLogCreate = async (args: any) => ({ id: 'audit-1', ...args.data });
const mockPrisma = {
  auditLog: { create: mockAuditLogCreate },
};

// Override the shared prisma client module in the require cache
const prismaClientPath = require.resolve('../src/prisma/client');
require.cache[prismaClientPath] = {
  id: prismaClientPath,
  filename: prismaClientPath,
  loaded: true,
  exports: mockPrisma,
} as any;

const { writeAuditLog, auditLibraryAction } = require('../src/services/auditService');

test('writeAuditLog creates an audit entry', async () => {
  const result = await writeAuditLog({
    actorId: 'user-1',
    action: 'TEST_ACTION',
    entity: 'TestEntity',
    entityId: 'entity-1',
    metadata: { key: 'value' },
    ipAddress: '127.0.0.1',
  });

  assert.strictEqual(result.id, 'audit-1');
  assert.strictEqual(result.actorId, 'user-1');
  assert.strictEqual(result.action, 'TEST_ACTION');
  assert.strictEqual(result.entity, 'TestEntity');
  assert.strictEqual(result.entityId, 'entity-1');
  assert.deepStrictEqual(result.metadata, { key: 'value' });
  assert.strictEqual(result.ipAddress, '127.0.0.1');
});

test('writeAuditLog works with minimal fields', async () => {
  const result = await writeAuditLog({
    action: 'MINIMAL_ACTION',
    entity: 'MinimalEntity',
  });

  assert.strictEqual(result.id, 'audit-1');
  assert.strictEqual(result.actorId, null);
  assert.strictEqual(result.entityId, null);
  assert.strictEqual(result.metadata, undefined);
  assert.strictEqual(result.ipAddress, null);
});

test('auditLibraryAction is a convenience wrapper', async () => {
  const result = await auditLibraryAction({
    actorId: 'admin-1',
    action: 'LIBRARY_BORROW_APPROVED',
    entity: 'LibraryBorrowRequest',
    entityId: 'req-1',
    metadata: { loanId: 'loan-1' },
    ipAddress: '10.0.0.1',
  });

  assert.strictEqual(result.id, 'audit-1');
  assert.strictEqual(result.action, 'LIBRARY_BORROW_APPROVED');
  assert.strictEqual(result.entity, 'LibraryBorrowRequest');
  assert.strictEqual(result.actorId, 'admin-1');
});