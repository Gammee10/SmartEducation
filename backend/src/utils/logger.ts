// Minimal leveled logger with PII redaction (M16).
//
// Console-first (no new dependencies): JSON lines in production, terse
// lines in development. Query strings, emails, and secret-looking fields
// are redacted so request logs cannot accumulate PII or credentials.
// Pair with the optional error tracker (utils/errorTracker.ts) before pilot.
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function minLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL || '').toLowerCase();
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw;
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}/g;
const SECRET_PAIR_RE = /("(?:password|passwd|secret|token|api[_-]?key|authorization)"\s*:\s*")[^"]*(")/gi;
const SENSITIVE_KEY_RE = /password|passwd|secret|token|api[_-]?key|authorization/i;

// URLs may carry emails/search terms in the query string - keep the path,
// drop the query.
export function redactUrl(url: string): string {
  if (typeof url !== 'string') return url;
  const q = url.indexOf('?');
  return q >= 0 ? `${url.slice(0, q)}?<query-redacted>` : url;
}

export function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(EMAIL_RE, '<email>').replace(SECRET_PAIR_RE, '$1<redacted>$2');
  }
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY_RE.test(k) ? '<redacted>' : redactValue(v);
    }
    return out;
  }
  return value;
}

function write(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
  if (ORDER[level] < ORDER[minLevel()]) return;
  const safe = (fields ? redactValue(fields) : {}) as Record<string, unknown>;
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  if (process.env.NODE_ENV === 'production') {
    stream.write(JSON.stringify({ level, msg: message, ...safe }) + '\n');
  } else {
    const extra = fields ? ` ${JSON.stringify(safe)}` : '';
    stream.write(`[${level}] ${message}${extra}\n`);
  }
}

export const logger = {
  debug: (message: string, fields?: Record<string, unknown>): void => write('debug', message, fields),
  info: (message: string, fields?: Record<string, unknown>): void => write('info', message, fields),
  warn: (message: string, fields?: Record<string, unknown>): void => write('warn', message, fields),
  error: (message: string, fields?: Record<string, unknown>): void => write('error', message, fields),
};

export default logger;
