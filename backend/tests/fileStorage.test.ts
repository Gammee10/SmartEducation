// Tests for the upload text hardening (M10) - pure validator only.
// uploadFile/deleteFile touch Cloudinary and are covered by the mocked
// assignment-service tests, never against the live API here.
import { test } from 'node:test';
import assert from 'node:assert';

const storage = require('../src/services/fileStorageService');

test('containsActiveMarkup rejects leading markup documents', () => {
  assert.strictEqual(storage.containsActiveMarkup('<html><body>hi</body></html>'), true);
  assert.strictEqual(storage.containsActiveMarkup('  <script>alert(1)</script>'), true);
  assert.strictEqual(storage.containsActiveMarkup('<SVG onload=x>'), true);
  assert.strictEqual(storage.containsActiveMarkup('\uFEFF<html>bom first</html>'), true);
});

test('containsActiveMarkup rejects embedded active elements', () => {
  assert.strictEqual(storage.containsActiveMarkup('hello <iframe src="x"></iframe> world'), true);
  assert.strictEqual(storage.containsActiveMarkup('see <object data="x"> below'), true);
  assert.strictEqual(storage.containsActiveMarkup('a <embed src="x"> b'), true);
});

test('containsActiveMarkup allows genuine plain text and CSV', () => {
  assert.strictEqual(storage.containsActiveMarkup('plain essay text, no tags at all'), false);
  assert.strictEqual(storage.containsActiveMarkup('a < b and 5 > 3, math is fine'), false);
  assert.strictEqual(storage.containsActiveMarkup('name,grade\nHanna,10\nDawit,9'), false);
  assert.strictEqual(storage.containsActiveMarkup('discusses html tags like <html> in prose'), false);
});
