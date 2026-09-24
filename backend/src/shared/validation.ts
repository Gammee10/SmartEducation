// Shared kernel: generic input validation. Consolidates the hand-rolled
// `assertValidDate` copies previously spread across assignment, attendance,
// and communication services. Domain-specific asserts (status enums,
// gradeLevel, audiences) stay in their services until the DTO stage.
import { ValidationError } from '../utils/errors';

function assertValidDate(value: string | Date | unknown, field = 'Date'): Date {
  const date = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`${field} is not a valid date`);
  }
  return date;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function assertEmailFormat(email: unknown, field = 'Email'): string {
  const value = String(email || '').toLowerCase().trim();
  if (!EMAIL_RE.test(value)) throw new ValidationError(`A valid ${field.toLowerCase()} is required`);
  return value;
}

export { assertValidDate, assertEmailFormat, EMAIL_RE };
