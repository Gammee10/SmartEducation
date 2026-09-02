// Standardized API error extraction - replaces the
// `err.response?.data?.message || 'Fallback'` chains repeated in every page.
export function getApiError(err: unknown, fallback = 'Something went wrong'): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: { message?: unknown } } }).response;
    const message = response?.data?.message;
    if (typeof message === 'string' && message) return message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
