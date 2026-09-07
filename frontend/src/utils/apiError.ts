// Standardized API error extraction - replaces the
// `err.response?.data?.message || 'Fallback'` chains repeated in every page.
//
// M18: structured validation errors are joined into the message (capped) so
// forms show WHICH field failed instead of a bare "Something went wrong",
// and CSV import row detail survives to the UI. Use getFieldErrors when a
// form needs per-field inline errors.
function collectParts(data: any, parts: string[]): void {
  if (!data || typeof data !== 'object') return;
  const errors = data.errors ?? data.data?.errors;
  if (Array.isArray(errors)) {
    for (const entry of errors) {
      if (typeof entry === 'string' && entry) {
        parts.push(entry);
      } else if (entry && typeof entry === 'object') {
        const record = entry as Record<string, unknown>;
        if (typeof record.message === 'string' && record.message) {
          const row = typeof record.rowNumber === 'number' ? `Row ${record.rowNumber}: ` : '';
          parts.push(`${row}${record.message}`);
        } else {
          for (const value of Object.values(record)) {
            if (typeof value === 'string' && value) parts.push(value);
          }
        }
      }
    }
  } else if (errors && typeof errors === 'object') {
    for (const value of Object.values(errors as Record<string, unknown>)) {
      if (typeof value === 'string' && value) {
        parts.push(value);
      } else if (Array.isArray(value)) {
        const joined = value.filter((v) => typeof v === 'string').join(', ');
        if (joined) parts.push(joined);
      }
    }
  }
}

export function getApiError(err: unknown, fallback = 'Something went wrong'): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: { message?: unknown } } }).response;
    const message = response?.data?.message;
    const parts: string[] = [];
    if (typeof message === 'string' && message) parts.push(message);
    collectParts(response?.data, parts);
    if (parts.length > 0) return parts.join('; ').slice(0, 300);
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

// Per-field map for inline form errors: { fieldName: message } when the API
// returns an errors object, otherwise {}.
export function getFieldErrors(err: unknown): Record<string, string> {
  if (err && typeof err === 'object' && 'response' in err) {
    const data = (err as { response?: { data?: unknown } }).response?.data as any;
    const errors = data?.errors ?? data?.data?.errors;
    if (errors && typeof errors === 'object' && !Array.isArray(errors)) {
      const fields: Record<string, string> = {};
      for (const [field, value] of Object.entries(errors as Record<string, unknown>)) {
        if (typeof value === 'string' && value) fields[field] = value;
        else if (Array.isArray(value)) {
          const joined = value.filter((v) => typeof v === 'string').join(', ');
          if (joined) fields[field] = joined;
        }
      }
      return fields;
    }
  }
  return {};
}
