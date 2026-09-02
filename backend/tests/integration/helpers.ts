// Integration test setup - runs the real Express app against a throwaway
// PostgreSQL database (prisma migrate deploy before the suite).
// If no test database is reachable, the whole suite skips so `npm test`
// keeps passing on machines without the DB.
import { execSync } from 'child_process';
import { createServer, Server } from 'http';
import { Socket } from 'net';
import type { AddressInfo } from 'net';

// Test DB coordinates - a throwaway local Postgres (never the configured
// pilot database). Override with TEST_DATABASE_URL.
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:testpw@localhost:5434/ses_test?schema=public';

// Must be set before importing app/env (dotenv does not override existing).
process.env.DATABASE_URL = TEST_DB_URL;
process.env.DIRECT_URL = TEST_DB_URL;
process.env.JWT_SECRET = 'test-secret-for-integration-tests';
process.env.NODE_ENV = 'test';

let baseUrl: string | null = null;
let server: Server | null = null;

export async function isDatabaseAvailable(): Promise<boolean> {
  // Plain TCP reachability check - no container runtime required. Point
  // TEST_DATABASE_URL at any local Postgres to run this suite.
  try {
    const url = new URL(TEST_DB_URL);
    const port = Number(url.port || 5432);
    await new Promise<void>((resolve, reject) => {
      const socket = new Socket();
      const done = (err?: Error) => {
        socket.destroy();
        err ? reject(err) : resolve();
      };
      socket.setTimeout(2000);
      socket.once('connect', () => done());
      socket.once('timeout', () => done(new Error('timeout')));
      socket.once('error', (err) => done(err));
      socket.connect(port, url.hostname);
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Migrate the throwaway DB and boot the app on an ephemeral port.
 * Returns the base URL for supertest-style requests, or null to skip.
 */
export async function startTestApp(): Promise<string | null> {
  if (!(await isDatabaseAvailable())) return null;

  execSync('npx prisma migrate deploy', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: 'ignore',
    timeout: 120000,
  });

  const { default: app } = await import('../../src/app');
  const { default: prisma } = await import('../../src/prisma/client');
  await prisma.$connect();
  // Clean any leftovers from a previous run
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "audit_logs", "notifications", "import_errors", "import_batches",
      "quiz_answers", "quiz_attempts", "quiz_options", "quiz_questions", "quizzes",
      "assignment_submissions", "assignments", "content_items", "timetable_slots",
      "attendances", "library_loans", "library_borrow_requests", "library_book_copies",
      "library_books", "events", "announcements", "course_enrollments", "courses",
      "students", "teachers", "users" CASCADE`
  );

  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, () => resolve()));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
  return baseUrl;
}

export async function stopTestApp(): Promise<void> {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
  }
  const { default: prisma } = await import('../../src/prisma/client');
  await prisma.$disconnect().catch(() => undefined);
}
