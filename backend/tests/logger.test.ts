// Tests for the leveled logger redaction (M16) - pure functions only.
import { test } from 'node:test';
import assert from 'node:assert';

const { redactUrl, redactValue, logger } = require('../src/utils/logger');

test('redactUrl strips query strings but keeps the path', () => {
  assert.strictEqual(redactUrl('/api/users?search=someone@school.edu'), '/api/users?<query-redacted>');
  assert.strictEqual(redactUrl('/api/health'), '/api/health');
});

test('redactValue masks emails and secret pairs in strings', () => {
  assert.strictEqual(
    redactValue('login failed for someone@school.edu from 1.2.3.4'),
    'login failed for <email> from 1.2.3.4'
  );
  assert.strictEqual(
    redactValue('{"password": "hunter2"}'),
    '{"password": "<redacted>"}'
  );
  assert.strictEqual(redactValue('plain message'), 'plain message');
});

test('redactValue masks sensitive object keys without touching the rest', () => {
  const out: any = redactValue({
    email: 'a@school.edu',
    passwordHash: 'hashed',
    tokenVersion: 3,
    temporaryPassword: 'abc',
    status: 'ACTIVE',
    nested: { apiKey: 'k', ok: true },
  });
  assert.strictEqual(out.email, '<email>');
  assert.strictEqual(out.passwordHash, '<redacted>');
  assert.strictEqual(out.tokenVersion, '<redacted>');
  assert.strictEqual(out.temporaryPassword, '<redacted>');
  assert.strictEqual(out.status, 'ACTIVE');
  assert.strictEqual(out.nested.apiKey, '<redacted>');
  assert.strictEqual(out.nested.ok, true);
});

test('logger methods never throw', () => {
  assert.doesNotThrow(() => {
    logger.debug('d', { a: 1 });
    logger.info('i');
    logger.warn('w', { url: '/x?email=a@b.co' });
    logger.error('e', { passwordHash: 'x' });
  });
});
