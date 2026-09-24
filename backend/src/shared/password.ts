// Shared kernel: password rules. Moved verbatim from authService so
// user-admin (CSV import, create/reset) shares them without importing
// auth internals.
import { ValidationError } from '../utils/errors';

// bcrypt silently truncates at 72 bytes - a longer password would not
// actually protect the account, so reject it with a clear error (M12).
const MAX_PASSWORD_BYTES = 72;

function assertPasswordBytes(value: string, field = 'Password'): void {
  if (Buffer.byteLength(value, 'utf8') > MAX_PASSWORD_BYTES) {
    throw new ValidationError(`${field} must be at most ${MAX_PASSWORD_BYTES} bytes`);
  }
}

export { assertPasswordBytes, MAX_PASSWORD_BYTES };
