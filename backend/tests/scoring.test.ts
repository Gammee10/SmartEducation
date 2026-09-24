// Tests for the extracted pure quiz scoring (REFACTORING_PLAN Stage 3).
// Locks exact-set grading, foreign-option rejection, and dedup outside the
// attempt lifecycle.
import { test } from 'node:test';
import assert from 'node:assert';
import { scoreAttempt } from '../src/services/quizzes/scoring';

const question = (id: string, points: number, correct: string[], all?: string[]) => ({
  id,
  points,
  options: (all ?? correct).map((oid) => ({ id: oid, isCorrect: correct.includes(oid) })),
});

test('scoring: exact set earns full points', () => {
  const q = [question('q1', 2, ['o2'], ['o1', 'o2'])];
  const { earned, total, answerData } = scoreAttempt('a1', q, [{ questionId: 'q1', optionIds: ['o2'] }]);
  assert.strictEqual(earned, 2);
  assert.strictEqual(total, 2);
  assert.strictEqual(answerData[0].isCorrect, true);
  assert.strictEqual(answerData[0].pointsEarned, 2);
});

test('scoring: partial multi-select earns zero (exact match required)', () => {
  const q = [question('q1', 3, ['o1', 'o2'], ['o1', 'o2', 'o3'])];
  const { earned, answerData } = scoreAttempt('a1', q, [{ questionId: 'q1', optionIds: ['o1'] }]);
  assert.strictEqual(earned, 0);
  assert.strictEqual(answerData[0].isCorrect, false);
});

test('scoring: foreign option ids are dropped before grading', () => {
  const q = [question('q1', 2, ['o1'], ['o1', 'o2'])];
  const { earned } = scoreAttempt('a1', q, [{ questionId: 'q1', optionIds: ['o1', 'foreign'] }]);
  assert.strictEqual(earned, 2, 'foreign id must not break an otherwise-correct set');
});

test('scoring: duplicate selections are deduplicated', () => {
  const q = [question('q1', 2, ['o1'], ['o1', 'o2'])];
  const { earned, answerData } = scoreAttempt('a1', q, [{ questionId: 'q1', optionIds: ['o1', 'o1'] }]);
  assert.strictEqual(earned, 2);
  assert.deepStrictEqual(answerData[0].selection, ['o1']);
});

test('scoring: unanswered questions still count toward total', () => {
  const q = [question('q1', 2, ['o1']), question('q2', 4, ['o2'])];
  const { earned, total, answerData } = scoreAttempt('a1', q, [{ questionId: 'q1', optionIds: ['o1'] }]);
  assert.strictEqual(earned, 2);
  assert.strictEqual(total, 6);
  assert.strictEqual(answerData.length, 1);
});

test('scoring: defaults points to 1 when unset', () => {
  const q = [{ id: 'q1', points: null, options: [{ id: 'o1', isCorrect: true }] }];
  const { earned, total } = scoreAttempt('a1', q, [{ questionId: 'q1', optionIds: ['o1'] }]);
  assert.strictEqual(earned, 1);
  assert.strictEqual(total, 1);
});
