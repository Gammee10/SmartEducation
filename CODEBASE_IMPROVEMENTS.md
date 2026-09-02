# Codebase Improvement Audit — Smart Education System

**Audit date:** 2026-09-02
**Scope:** Full repository — backend (`backend/src`, `backend/prisma`), frontend (`frontend/src`), configuration, dependencies, tests, and deployment readiness.

---

## Executive Summary

The codebase is well organized for a modular monolith: consistent controller → service layering, a shared Prisma client, standard API response shape, RBAC middleware, audit logging on most sensitive writes, and a polished Tailwind frontend. However, there are **real correctness bugs in the quiz and library flows**, several **race conditions**, **production-readiness gaps** (rate limiting behind a proxy, no graceful shutdown, no CI, no linting), **privacy over-exposure of student emails/phones**, and **systemic input-validation gaps** (enums, pagination bounds, URLs, file contents).

| Priority | Count |
|---|---|
| **Critical** | 3 |
| **High** | 12 |
| **Medium** | 18 |
| **Low** | 10 |
| **Optional** | 6 |
| **Total** | **49** |

**Most important areas requiring attention:**

1. **Quiz integrity (Critical #1, #2, High #3)** — the attempt limit can be bypassed entirely, submits race, and expired attempts earn full credit.
2. **Production rate limiting (Critical #3)** — in-memory limiter + no `trust proxy` will either lock out the whole school or be trivially bypassed.
3. **Concurrency races in library approvals and timetable conflict checks (High #4, Medium #9).**
4. **Privacy: student emails/phones exposed to classmates (High #5).**
5. **Missing password management (High #7)** — no change-password or reset flow; imported users share one default password forever.
6. **Validation gaps (High #6, Medium #11–14)** — unbounded pagination, unvalidated enum inputs, unvalidated URLs, mimetype-only file checks.

---

# 1. Critical

## 1.1 Quiz `maxAttempts` limit is bypassable — unlimited attempts with timer reset

- **Status: Completed**

- **Category:** Backend / Academic Integrity
- **Severity:** Critical
- **Location:** `backend/src/services/quizService.ts:663–689` (`startAttempt`)
- **Current Problem:**
  The attempt limit counts only finished attempts:

  ```ts
  const attemptCount = await prisma.quizAttempt.count({
    where: { quizId, studentId: student.id, status: { in: ['SUBMITTED', 'TIME_EXPIRED'] } },
  });
  if (attemptCount >= quiz.maxAttempts) { ... }
  ```

  A student can call `POST /quizzes/:id/attempt` repeatedly **without ever submitting**. Each call creates a new `IN_PROGRESS` attempt, returns the full question set, and issues a **fresh timer**. Consequences:
  - The `maxAttempts` cap is completely unenforceable.
  - The expiry timer is meaningless — on expiry, just start a new attempt.
  - Unbounded `IN_PROGRESS` rows accumulate in `quiz_attempts` (data growth + noise in teacher result views).
- **Recommended Improvement:**
  Count **all** attempts (including `IN_PROGRESS`) against `maxAttempts`, and reuse an existing `IN_PROGRESS` attempt instead of creating a new one (which the frontend already supports via the resume path in `QuizDetailPage.tsx:125–136`).
- **Implementation Guidance:**
  1. In `startAttempt`, first look for an existing attempt: `prisma.quizAttempt.findFirst({ where: { quizId, studentId: student.id, status: 'IN_PROGRESS' }, orderBy: { startedAt: 'desc' } })`.
  2. If an `IN_PROGRESS` attempt exists **and** `expiresAt > now`, return it (regenerate the question payload from the current quiz, applying shuffle) instead of creating a new row. Do not reset `expiresAt`.
  3. If the `IN_PROGRESS` attempt exists but is expired, mark it `TIME_EXPIRED` (counts toward the limit) before counting.
  4. Change the count query to count **all** attempts of the student for this quiz: `where: { quizId, studentId }` (remove the status filter). Check `attemptCount >= quiz.maxAttempts` before creating.
  5. Keep the existing return shape (`attempt`, `quiz`) so `QuizDetailPage` needs no changes — the resume effect already handles a returned in-progress attempt.
- **Suggested Validation:**
  - Unit test: start attempt → start again → same attempt id returned and second row not created.
  - Unit test: with `maxAttempts = 1`, after submitting, a new start is rejected with 409.
  - Unit test: expired `IN_PROGRESS` attempt is flipped to `TIME_EXPIRED` and consumes an attempt.

## 1.2 Quiz submission is not atomic — double-submission and re-grading race

- **Status: Completed**

- **Category:** Backend / Reliability
- **Severity:** Critical
- **Location:** `backend/src/services/quizService.ts:764–836` (`submitAttempt`)
- **Current Problem:**
  The status check `if (attempt.status !== 'IN_PROGRESS')` runs **outside** the transaction, and the final update is an unconditional `tx.quizAttempt.update({ where: { id: attemptId }, ... })`. Two concurrent submits (double-click, retry, auto-submit racing manual submit) both pass the check; both grade, both write audit logs, and both create "Quiz submitted" notifications. The same pattern means a submit racing the expiry flip can overwrite `TIME_EXPIRED`.
- **Recommended Improvement:**
  Make the transition atomic with a conditional update (`updateMany` guarded on `status: 'IN_PROGRESS'`) and treat "0 rows updated" as an already-submitted conflict.
- **Implementation Guidance:**
  1. Inside `prisma.$transaction`, first run:
     `const claimed = await tx.quizAttempt.updateMany({ where: { id: attemptId, status: 'IN_PROGRESS' }, data: { status: finalStatus, submittedAt: now, score: earned, maxScore: total } });`
  2. If `claimed.count === 0`, throw `new ConflictError('This attempt has already been submitted')` — the transaction rolls back (no duplicate answers/audit/notification).
  3. Only then `createMany` answers, write the audit log, and create the notification.
  4. Keep the existing post-transaction `include` query to build the response, or use `update` after the successful `updateMany` to get the populated attempt.
- **Suggested Validation:**
  - Unit test simulating two concurrent submits (call the service twice with the same attempt; second must reject).
  - Manual test: disable the submit button remains, but backend no longer double-scores.

## 1.3 Rate limiting breaks or is bypassable behind the production reverse proxy

- **Status: Completed**

- **Category:** Security / Reliability / DevOps
- **Severity:** Critical
- **Location:** `backend/src/app.ts:22–25`, `backend/src/middleware/rateLimit.ts:5–28`, `backend/src/index.ts`
- **Current Problem:**
  The app is designed for deployment behind a platform proxy (Supabase/Render-style deployment is referenced in `prisma/client.ts` comments and `.env.example`), but:
  1. `app.set('trust proxy', ...)` is never configured. `req.ip` therefore resolves to the **proxy's IP**, so `express-rate-limit` buckets **all users behind one key**. The global limiter (`1000 req / 15 min`) and login limiter (`10 / 15 min`) become a school-wide shared quota — a whole-school lockout is one busy morning away, and `req.ip` recorded in audit logs is the proxy IP, not the client's.
  2. The limiter uses the default **in-memory store**, which resets on every deploy/restart and does not work across multiple instances.
  3. If someone "fixes" lockouts by blindly setting `trust proxy: true`, `X-Forwarded-For` becomes client-controlled → rate limits are bypassable and audit IPs forgeable.
- **Recommended Improvement:**
  Configure trust proxy explicitly for the deployment topology, key the limiters by authenticated user when available, and move to a shared store if/when running >1 instance.
- **Implementation Guidance:**
  1. Add an env var `TRUST_PROXY` (e.g., `1` for one proxy hop) and set `app.set('trust proxy', Number(env.trustProxy))` only when the value is provided. Document it in `.env.example` and the deployment docs — never default to `true`.
  2. In `rateLimit.ts`, pass a `keyGenerator` that prefers the authenticated user id when present: `(req) => (req as any).user?.id ?? req.ip`. This keeps authenticated traffic fair even behind shared NATs.
  3. Loosen the global limiter for authenticated requests (e.g., 1000/15min per user) and keep `authLimiter` IP-based (login has no user yet) — with `trust proxy` correctly set this is per-client.
  4. Note in code comments: if the backend is ever scaled horizontally, swap to `rate-limit-redis` (or similar) — not needed for a single instance.
  5. Audit-log `ipAddress` will then record real client IPs.
- **Suggested Validation:**
  - Deploy to staging with one proxy hop; confirm `req.ip` is the client address (log it) and that the login limiter trips per-client, not globally.
  - Negative test: send a forged `X-Forwarded-For` from a direct (unproxied) request and confirm it is ignored.

---

# 2. High

## 2.1 Teacher/Admin quiz results are never loaded

- **Status: Completed** — results UI is permanently empty

- **Category:** Frontend / Functional Bug
- **Severity:** High
- **Location:** `frontend/src/pages/QuizDetailPage.tsx:104–116` (`fetchData`), teacher results section `:810–844`, admin section `:849–881`; backend `backend/src/services/quizService.ts:898–953` (`getQuizResults`)
- **Current Problem:**
  `fetchData` calls `GET /quizzes/:id`. For teachers/admins, `getQuizDetails` returns `{ quiz }` **only** — no `attempts` key. The page does `setAttempts(response.data.data.attempts || [])`, so `attempts` is always `[]` for teachers and admins. The "Results" panels render "No attempts yet" forever. The backend endpoint `GET /quizzes/:id/results` exists but is never called anywhere in the frontend (verified by grep).
- **Recommended Improvement:**
  For teacher/admin roles, fetch `/quizzes/:id/results` and populate `attempts` from that response.
- **Implementation Guidance:**
  In `fetchData`, after the first fetch: `if (user?.role !== 'STUDENT') { const r = await api.get(`/quizzes/${quizId}/results`); setAttempts(r.data.data.attempts || []); }`. The results response's `attempts` include `student.user.fullName`, matching the render code (`attempt.student?.user?.fullName`). Keep error handling non-fatal (a results failure shouldn't blank the page).
- **Suggested Validation:** Log in as teacher, open a quiz with a submitted attempt → the Results panel lists students and scores.

## 2.2 Library approval race

- **Status: Completed** — two pending requests can both be approved, creating two loans for one copy

- **Category:** Backend / Concurrency
- **Severity:** High
- **Location:** `backend/src/services/libraryService.ts:329–389` (`decideBorrowRequest`)
- **Current Problem:**
  The `request.bookCopy.status !== 'AVAILABLE'` check runs **outside** the transaction. Two admins approving two different pending requests for the same copy concurrently both pass the check; both transactions create a loan and both set the copy to `BORROWED`. Result: two active loans for one physical book.
- **Recommended Improvement:**
  Move the availability check inside the transaction and make the copy status flip conditional.
- **Implementation Guidance:**
  1. Inside `prisma.$transaction`, first run `const claimed = await tx.libraryBookCopy.updateMany({ where: { id: request.bookCopyId, status: 'AVAILABLE' }, data: { status: 'BORROWED' } });`
  2. If `claimed.count === 0`, throw `new ConflictError('This book copy is no longer available')` — rolls back everything.
  3. Then update the request and create the loan (loan creation also guards duplicates via `borrowReqId @unique`).
  4. Similarly guard `returnLoan` (`:480–522`) with `updateMany({ where: { id: loanId, status: { not: 'RETURNED' } } })` to make double-returns idempotent under concurrency.
- **Suggested Validation:** Unit test: approve two requests for the same copy → second rejects with 409; double return → second is a no-op/conflict.

## 2.3 Student PII over-exposure: classmates' emails and phone numbers returned to students

- **Status: Completed**

- **Category:** Security / Privacy
- **Severity:** High
- **Location:**
  - `backend/src/services/courseService.ts:74–107` (`getCourse` — includes **all** enrollments with `user.email` for every enrolled student; returned to any enrolled student)
  - `backend/src/services/attendanceService.ts:81–112` (`listCourseAttendance` — returns full `enrolledStudents` list with emails to any authenticated course member, including students)
  - `backend/src/services/studentSummaryService.ts:8–11` (returns `user.phone` and `user.email` of a student to any teacher who shares one course)
- **Current Problem:**
  Any student can enumerate the full roster of their class — names and email addresses of every classmate — via `GET /api/courses/:id` and `GET /api/courses/:id/attendance`. `getCourse` also returns **all** enrollments (including `DROPPED`/`COMPLETED`) with no pagination. Emails are login identifiers; leaking the full roster enables harassment and targeted phishing. Phone numbers are even more sensitive.
- **Recommended Improvement:**
  Shape responses per role. Students should never receive other students' contact details.
- **Implementation Guidance:**
  1. In `getCourse`, only include `enrollments` (with user info) when `role !== 'STUDENT'`; for students return only `_count.enrollments` (the frontend student view only needs counts/titles). Prisma tip: build the `include` object conditionally before the query.
  2. In `listCourseAttendance`, keep `enrolledStudents` for `TEACHER`/`ADMIN` only (teachers need it to mark attendance). For students, omit it entirely.
  3. In `getStudentSummary`, restrict the `user` object to `{ id, fullName }` for `TEACHER` (drop `email`, `phone`); students already only access their own summary.
  4. Cross-check the frontend pages that consume these endpoints (CourseDetailPage, AttendancePage, StudentProfilePage) — none of the student-facing UI renders classmates' emails, so trimming is safe.
- **Suggested Validation:** As a student: `GET /courses/:id` and `/courses/:id/attendance` responses contain no other student's `email`. As a teacher: roster/attendance marking still works end-to-end.

## 2.4 No password change / reset flow — imported users keep the shared default password indefinitely

- **Category:** Authentication / Missing Feature
- **Severity:** High
- **Location:** `backend/src/routes/authRoutes.ts` (no `/auth/password` routes), `backend/src/services/userAdminService.ts:22–26` (`assertPassword` falls back to the shared `DEFAULT_PASSWORD`), `backend/prisma/seed.ts:18` (`Password123!`)
- **Current Problem:**
  Users created by admin or CSV import without an explicit password all receive the **same** fallback password. There is no endpoint for a user to change their own password, no admin "reset password" action, and no self-service reset. Every such account is permanently bridged to a shared secret that likely circulates in chat groups at a school. AGENTS.md requires admin-controlled user creation — but without a change-password flow this design forces credential sharing.
- **Recommended Improvement:**
  Add two endpoints and one admin action:
  1. `PUT /api/auth/password` (authenticated): body `{ currentPassword, newPassword }`. Verify current password, enforce policy (min 8 chars; reject if equal to current), re-hash with bcrypt, audit `PASSWORD_CHANGED`.
  2. `POST /api/users/:id/reset-password` (admin): generates a random temporary password (e.g., `crypto.randomBytes`), hashes it, returns it once in the response (admin hands it to the user), audits `PASSWORD_RESET` (never log the password itself).
  3. Optionally set a `mustChangePassword` flag later; for the pilot, the two endpoints above are sufficient.
- **Implementation Guidance:**
  - Add handlers to `authController.ts` / `userAdminController.ts`, logic in `authService.ts` / `userAdminService.ts`, routes in `authRoutes.ts` (authenticated) and `userAdminRoutes.ts` (admin-gated).
  - Frontend: add a "Change password" form (e.g., in the user menu / a small settings page) and a "Reset password" button on `AdminUsersPage`.
- **Suggested Validation:** Unit tests: wrong current password → 401/422; correct flow → old password no longer works, new one does; audit rows written.

## 2.5 Unbounded pagination parameters across every list endpoint

- **Status: Completed**

- **Category:** Backend / API / Performance
- **Severity:** High
- **Location:** Every controller, e.g. `backend/src/controllers/courseController.ts:17–24`, `libraryController.ts:17–23`, `userAdminController.ts:12–19`, `notificationController.ts:8–14`, and all services' `skip/take` usage
- **Current Problem:**
  `parseInt(req.query.pageSize)` is passed straight to Prisma `take` with **no bounds**:
  - `?pageSize=1000000` dumps up to a million rows (plus their `include` joins) in one response — memory and bandwidth DoS with a valid token.
  - `?pageSize=abc` → `NaN` → Prisma throws a raw validation error → 500 instead of 422.
  - `?page=0` or negative → `skip: -20` → Prisma error → 500.
- **Recommended Improvement:**
  Add one shared helper and use it in every controller that reads `page`/`pageSize`.
- **Implementation Guidance:**
  1. In `backend/src/utils/` create `pagination.ts`:
     ```ts
     export function parsePagination(query: { page?: unknown; pageSize?: unknown }, defaultSize = 20, maxSize = 100) {
       let page = parseInt(String(query.page ?? '1'), 10);
       let pageSize = parseInt(String(query.pageSize ?? String(defaultSize)), 10);
       if (!Number.isFinite(page) || page < 1) page = 1;
       if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = defaultSize;
       if (pageSize > maxSize) pageSize = maxSize;
       return { page, pageSize };
     }
     ```
  2. Replace every `parseInt(page as string, 10)` / `parseInt(pageSize as string, 10)` pair across the 10 controllers with this helper.
- **Suggested Validation:** `?pageSize=999999` returns at most `maxSize` rows; `?page=abc` returns page 1 (or a 422) — never a 500.

## 2.6 File upload pipeline: 50 MB buffered in RAM, base64-doubled, mimetype-only validation

- **Status: Completed**

- **Category:** Security / Performance
- **Severity:** High
- **Location:** `backend/src/routes/assignmentRoutes.ts:27–44` (multer memoryStorage, 50 MB), `backend/src/services/fileStorageService.ts:51` (`file.buffer.toString('base64')`), `backend/src/services/assignmentService.ts:402–412`
- **Current Problem:**
  1. Every upload allocates up to 50 MB in memory, then `uploadFile` builds a base64 string (~67 MB) of it **per concurrent request**. A handful of parallel 50 MB uploads can exhaust the Node heap (OOM crash) — a trivially scriptable DoS with any student token.
  2. `fileFilter` trusts the client-supplied `Content-Type`. A `.exe` renamed to `.pdf` passes; the declared mimetype is then stored verbatim (`mimeType: file.mimetype`), and the file is served later from Cloudinary with that type.
- **Recommended Improvement:**
  Cap concurrent upload memory, lower the practical limit for submissions, and validate actual bytes.
- **Implementation Guidance:**
  1. Reduce `fileSize` for student submissions to something realistic (e.g., 20 MB) and keep 50 MB only if video content upload is actually supported (it isn't today — content upload is URL-based, so 50 MB is only reachable via assignment submissions; 20 MB is plenty for documents).
  2. Sniff magic bytes in `fileStorageService.uploadFile` before uploading: PDF `%PDF`, PNG `\x89PNG`, JPEG `\xFF\xD8\xFF`, ZIP/OOXML `PK\x03\x04` — reject when the sniffed type contradicts an allowlist. A tiny hand-rolled header check avoids a new dependency.
  3. Optionally add a module-level semaphore (e.g., simple counter rejecting when >5 uploads are in flight) to bound memory: `if (activeUploads >= 5) throw new AppError('Too many uploads in progress, retry shortly', 503)`.
- **Suggested Validation:** Upload a text file renamed to `.pdf` → 422; parallel-upload test does not OOM a small instance.

## 2.7 Admin dashboard computes aggregates by loading entire tables into memory

- **Status: Completed**

- **Category:** Performance / Scalability
- **Severity:** High
- **Location:** `backend/src/services/dashboardService.ts:21–38` (`getAdminDashboard` — `findMany` of **all** graded submissions, then **all** submitted quiz attempts, summed in JS)
- **Current Problem:**
  Two unbounded `findMany` calls fetch every graded submission and quiz attempt ever recorded just to compute two averages. This works at pilot scale and degrades linearly with every school term — the admin dashboard is also likely the most-visited page.
- **Recommended Improvement:**
  Use Prisma `aggregate` (SQL-level computation).
- **Implementation Guidance:**
  ```ts
  const [subAgg, attempts] = await Promise.all([
    prisma.assignmentSubmission.aggregate({ where: { status: 'GRADED', score: { not: null } }, _avg: { score: true } }),
    prisma.quizAttempt.findMany({ where: { status: 'SUBMITTED', score: { not: null } }, select: { score: true, maxScore: true } }),
  ]);
  const avgAssignmentScore = subAgg._avg.score ? Math.round(subAgg._avg.score * 100) / 100 : 0;
  ```
  (Quiz average needs the per-row ratio; if ratio-average precision matters, keep the query but select only two int columns — or compute `SUM(score)/SUM(maxScore)` via `aggregate` on `quizAttempt` as a simpler, defensible metric. Note the current code averages *percentages*; switching to aggregate changes the metric slightly — document the choice.)
- **Suggested Validation:** Values match previous implementation on a seeded dataset; query time no longer grows with table size (check with `EXPLAIN` or timing on a large table).

## 2.8 No structured logging, no request IDs, no graceful shutdown

- **Status: Completed**

- **Category:** Reliability / DevOps
- **Severity:** High
- **Location:** `backend/src/index.ts:6–18` (no SIGTERM/SIGINT handling, no `server.close()`, no `prisma.$disconnect()`), `backend/src/app.ts:28–35` (console.log line logging, no request id, no user id, no IP)
- **Current Problem:**
  1. On platform deploys (SIGTERM), in-flight requests are killed abruptly and DB connections aren't drained — intermittent 502s and dropped writes during every deploy.
  2. Request logs have no correlation id and no actor, so tracing "who did what" across a console-only pipeline is guesswork; `errorHandler` (`errorHandler.ts:67`) logs raw errors with no request context.
- **Recommended Improvement:**
  Add graceful shutdown and minimal structured request logging (no new dependencies required — but `pino` is a reasonable choice if the team prefers).
- **Implementation Guidance:**
  1. In `index.ts`, capture the server: `const server = app.listen(...)`, then:
     ```ts
     const shutdown = async (signal: string) => {
       console.log(`${signal} received, shutting down`);
       server.close(async () => { await prisma.$disconnect(); process.exit(0); });
       setTimeout(() => process.exit(1), 10000).unref();
     };
     process.on('SIGTERM', () => shutdown('SIGTERM'));
     process.on('SIGINT', () => shutdown('SIGINT'));
     ```
  2. In `app.ts`, generate `req.id = crypto.randomUUID()` early, log JSON lines `{ id, method, url, status, durationMs, userId: req.user?.id ?? null }`, and include `x-request-id` in error logs from `errorHandler`.
  3. Enrich the `/api/health` endpoint to also ping the DB (`await prisma.$queryRaw\`SELECT 1\``) with a 5s timeout — deploy health checks currently pass even when the DB is unreachable.
- **Suggested Validation:** Deploy kill test: SIGTERM → server stops accepting, finishes in-flight, exits 0. Health check returns 503 when DB creds are wrong.

## 2.9 Unvalidated enum-ish inputs cause raw Prisma 500s (course status, content type, filter params)

- **Status: Completed**

- **Category:** Backend / Data Validation
- **Severity:** High
- **Location:**
  - `backend/src/services/courseService.ts:123–141` (`createCourse` — `status as CourseStatus` cast without validation), `:190` (`updateCourse` same), `:377` (`uploadContent` — `type: (data.type || 'OTHER') as ContentTypeEnum` unvalidated)
  - `backend/src/controllers/courseController.ts:21` (`status` query filter passed through unchecked → Prisma error on bad value → 500)
  - `backend/src/controllers/libraryController.ts:105–110` (`status` filter for borrow requests/loans unchecked)
- **Current Problem:**
  `POST /api/courses { "status": "LIVE" }` produces a Prisma `PrismaClientValidationError` → generic 500. Same for `?status=banana` on list endpoints. These are trivially reachable 500s and make client-side debugging miserable.
- **Recommended Improvement:**
  Validate against the known enum value arrays (several already exist, e.g., `assignmentService` `ASSIGNMENT_STATUSES`, `attendanceService` `ATTENDANCE_STATUSES` — follow that established pattern).
- **Implementation Guidance:**
  1. In `courseService`, add `const COURSE_STATUSES = ['DRAFT','ACTIVE','ARCHIVED']` and `const CONTENT_TYPES = ['VIDEO','DOCUMENT','PDF','IMAGE','LINK','OTHER']` with `assertCourseStatus` / `assertContentType` helpers mirroring `assertStatusCode` in `assignmentService.ts:42–47`.
  2. Apply in `createCourse`, `updateCourse`, `uploadContent`; filter params in `listCourses` (`courseController`/`courseService`) and `listBorrowRequests`/`listLoans` (`libraryService`) should validate or ignore invalid values.
- **Suggested Validation:** POST invalid status → 422 `ValidationError`; `?status=banana` → empty result or 422, never 500.

## 2.10 Stored-XSS-ready: content/upload URLs accepted without validation

- **Status: Completed**

- **Category:** Security / Data Validation
- **Severity:** High
- **Location:** `backend/src/services/courseService.ts:353–358` (`uploadContent` accepts any `url` string), `libraryService.ts:87–113` (`coverUrl`), `userAdminService.ts` / schema `coverUrl` fields generally
- **Current Problem:**
  `url` is stored verbatim and rendered as course content links in the frontend. A teacher can store `javascript:alert(document.cookie)` or a `data:text/html` URL; any student clicking the content link executes script in the app's origin. (Frontend renders these as `href` — React does not sanitize `href` schemes.)
- **Recommended Improvement:**
  Allowlist URL schemes at write time.
- **Implementation Guidance:**
  1. Helper in `utils` (or inside `courseService`): parse with `new URL(value)`; require `protocol === 'https:' || protocol === 'http:'`; reject anything that fails to parse. For `coverUrl` fields, same check. Optionally also block `http://localhost`-style hosts for hygiene.
  2. Apply to `uploadContent` (`url`), `createCourse`/`updateCourse` (`coverUrl`), `createBook`/`updateBook` (`coverUrl`).
  3. Return 422 `ValidationError('URL must be a valid http(s) link')`.
- **Suggested Validation:** `POST content { url: "javascript:alert(1)" }` → 422; existing https links continue to work.

## 2.11 Expired quiz attempts still earn full credit

- **Status: Completed**

- **Category:** Backend / Business Logic
- **Severity:** High
- **Location:** `backend/src/services/quizService.ts:768–814` (`submitAttempt` — expiry sets `TIME_EXPIRED` but answers are still fully scored)
- **Current Problem:**
  When `expired === true`, the attempt is marked `TIME_EXPIRED` **and graded at full value**. A student who leaves the tab open after time runs out gets everything they select counted; combined with Critical #1 (before its fix), expiry was meaningless. Even after fixing #1, "expired" attempts scoring identically to on-time attempts undermines the timer.
- **Recommended Improvement:**
  Decide and enforce a policy; recommended: auto-submit **at expiry time server-side** scores answers submitted before expiry only, or zero-out expired submissions.
- **Implementation Guidance (simplest defensible policy):**
  1. If `expired`, grade as today but flag it (already done via `TIME_EXPIRED`), **and** surface the flag in the teacher results UI so the teacher can discount it. This preserves current behavior but makes it visible.
  2. Alternative stricter policy: when `expired`, accept the answers but mark the attempt score with a `TIME_EXPIRED` badge and exclude it from dashboard averages (dashboard already filters `status: 'SUBMITTED'` only — verify consistency: `dashboardService.ts:29–31` uses `status: 'SUBMITTED'`, so expired attempts are already excluded from averages — keep that).
  3. Document the chosen policy in the API response (`expired: true` is already returned) and in `QuizDetailPage` result banner (already shown).
- **Suggested Validation:** Unit test: expired submit → `status === 'TIME_EXPIRED'`, excluded from `avgQuizScore` dashboard aggregation.

## 2.12 Assignment submit-to-unique race yields confusing 409

- **Status: Completed** "A record with this value already exists"

- **Category:** Backend / API
- **Severity:** High
- **Location:** `backend/src/services/assignmentService.ts:391–396` (pre-check) + `backend/src/middleware/errorHandler.ts:8–16` (P2002 → generic message)
- **Current Problem:**
  Double-clicking "Submit" (or a retry after a network blip) can pass the `existing` check in both requests; the loser hits the P2002 unique constraint and receives the generic 409 message *"A record with this value already exists"*, which confuses students. Same generic message applies to every unique violation in the system.
- **Recommended Improvement:**
  Catch P2002 locally where context is known and raise a domain `ConflictError` with a specific message.
- **Implementation Guidance:**
  1. In `submitAssignment`, wrap `prisma.assignmentSubmission.create` in try/catch; if `(err as any).code === 'P2002'`, throw `new ConflictError('You have already submitted this assignment')`.
  2. Repeat for other high-traffic uniques: `courseService.enrollStudent` (create path), `libraryService.createBorrowRequest`, `userAdminService.createUser` (email duplicate).
- **Suggested Validation:** Fire two parallel submits → exactly one 201, one 409 with the specific message.

---

# 3. Medium

## 3.1 Quiz answers lose multiple-choice data and don''t validate option ownership

- **Status: Completed**

- **Category:** Backend / Data Integrity
- **Severity:** Medium
- **Location:** `backend/src/services/quizService.ts:805–811`
- **Current Problem:**
  For `MULTIPLE_CHOICE` questions, only `selected[0]` is persisted (`optionId: selected.length > 0 ? selected[0] : null`) — the rest of the student's selections are discarded, so results/answers views cannot show what else they picked. Also, submitted `optionIds` are never validated to belong to the question; an id from a *different* question is stored (FK valid → silent data corruption).
- **Recommended Improvement:** Validate each `optionId` against the question's options before scoring; store all selections.
- **Implementation Guidance:**
  1. Build a `Map<questionId, Set<optionId>>` from `attempt.quiz.questions`.
  2. Filter submitted ids through the set; drop unknown ids before scoring (this also neutralizes forgery).
  3. For persistence of multi-select: add a `QuizAnswerOption` join table (`answerId`, `optionId`, `@@unique([answerId, optionId])`) via a new Prisma migration, or simpler for the pilot: store the full selection as JSON (`selection Json?` column on `QuizAnswer`). Recommended for now: the JSON column — one nullable field, no join complexity; keep `optionId` for the primary/first selection for backward compatibility.
- **Suggested Validation:** Submit a multi-select answer → stored selection round-trips; foreign option id is rejected/ignored and does not affect score.

## 3.2 Timetable conflict detection is check-then-insert (race) and writes are never audited

- **Status: Completed**

- **Category:** Backend / Concurrency / Audit
- **Severity:** Medium
- **Location:** `backend/src/services/timetableService.ts:47–64` (`createTimetableSlot`), `:100–115` (`checkConflicts`); note `ipAddress` params are accepted but `writeAuditLog` is **never called** in this service
- **Current Problem:**
  1. Two admins creating overlapping slots concurrently both pass `checkConflicts` → double-booked room/teacher. AGENTS.md marks scheduling data as non-sensitive, but conflicts silently corrupt the timetable.
  2. Unlike every other write service, timetable creates/updates/deletes leave **no audit trail** despite accepting `ipAddress` — inconsistent with the rest of the codebase.
- **Recommended Improvement:**
  1. Wrap conflict check + create in a `prisma.$transaction` with a serializable-ish pattern: re-check conflicts **inside** the transaction using the tx client. (A true DB-level exclusion constraint needs a Postgres `EXCLUDE` constraint on a time range — overkill for the pilot; transactional re-check removes the practical race.)
  2. Add `writeAuditLog` for `TIMETABLE_SLOT_CREATED/UPDATED/DELETED` inside the same transaction.
- **Implementation Guidance:** Move `checkConflicts` to accept a `tx` client (like `writeAuditLog` does) and call it within the transaction in create/update.
- **Suggested Validation:** Unit test with mocked tx verifying conflict query runs on the tx client and audit rows are created.

## 3.3 Library loans never transition to OVERDUE

- **Status: Completed** — status is dead schema

- **Category:** Backend / Missing Feature
- **Severity:** Medium
- **Location:** `backend/prisma/schema.prisma:45–49` (`LibraryLoanStatus.OVERDUE`), no code sets it (grep: only `ACTIVE`, `RETURNED` used in `libraryService.ts`)
- **Current Problem:**
  The schema defines `OVERDUE` but nothing ever computes or marks it. Admin loan lists can't filter overdue books; no notification fires for overdue returns; "overdue" doesn't exist operationally even though a `dueDate` is captured.
- **Recommended Improvement:**
  Compute overdue lazily (pilot-appropriate): derive overdue at read time instead of a cron job.
- **Implementation Guidance:**
  1. In `listLoans`/`listMyLoans`, for `status: 'ACTIVE'` filters, treat `dueDate < now` as overdue: either add `dueDate: { lt: new Date() }` to the where when the client asks for `status=OVERDUE`, or annotate returned rows: `status: loan.status === 'ACTIVE' && loan.dueDate < now ? 'OVERDUE' : loan.status`.
  2. Optional: a small daily job (node-cron in-process) flipping `ACTIVE` loans past due to `OVERDUE` and creating a notification per student — only if background jobs are acceptable in the deployment target. Prefer the read-time approach for the pilot.
- **Suggested Validation:** Create a loan with yesterday's dueDate → appears under `status=OVERDUE` filter and is flagged in the response.

## 3.4 `decideBorrowRequest` accepts invalid/past due dates

- **Category:** Backend / Data Validation
- **Severity:** Medium
- **Location:** `backend/src/services/libraryService.ts:339–367`
- **Current Problem:**
  `dueDate` is only checked for presence; `new Date('garbage')` → Invalid Date → Prisma throws → 500. A past `dueDate` is accepted silently. There is also no cap on loan duration.
- **Recommended Improvement:** Validate like `assertValidDate` in `attendanceService.ts:19–27`, require `dueDate > now`, and cap (e.g., ≤ 90 days).
- **Implementation Guidance:** Reuse/duplicate the `assertValidDate` helper; add `if (due.getTime() <= Date.now()) throw new ValidationError('Due date must be in the future')`.
- **Suggested Validation:** `dueDate: "not-a-date"` → 422; `dueDate: yesterday` → 422.

## 3.5 CSV import: unbounded size/rows, runs inside a single JSON body, batch can be orphaned as PENDING

- **Status: Completed**

- **Category:** Backend / Reliability
- **Severity:** Medium
- **Location:** `backend/src/controllers/userAdminController.ts:66–76` (CSV as JSON string field), `backend/src/app.ts:23` (`express.json()` default 100 KB body limit), `backend/src/services/userAdminService.ts:287–425` (`importUsersCsv` — no row cap; `importBatch` created first, marked COMPLETED only at the end)
- **Current Problem:**
  1. `express.json()` default limit is 100 KB — a CSV of more than roughly 1–2k users **fails at the body parser** with an HTML-ish 413, before any of the friendly per-row error reporting exists.
  2. No row-count cap → a huge CSV runs for minutes in one request (per-row: findUnique + bcrypt hash + transaction) → request timeout, batch stuck `PENDING` forever.
  3. If the process dies mid-import, the batch is never finalized.
- **Recommended Improvement:**
  Cap rows explicitly, raise the JSON limit for this route only, and guard the batch lifecycle.
- **Implementation Guidance:**
  1. `express.json({ limit: '2mb' })` globally (still small), which comfortably covers a ~5k-row CSV.
  2. In `importUsersCsv`: reject `lines.length - 1 > 5000` with a `ValidationError`.
  3. On any thrown error inside the loop-heavy section, wrap the whole import in try/catch and mark the batch `FAILED` with the error message before rethrowing (so no orphaned `PENDING` batches).
- **Suggested Validation:** 300-row CSV imports with per-row error detail; 10001-row CSV rejected with 422 quickly.

## 3.6 `generateCode` student/employee code generation races on concurrent user creation

- **Status: Completed**

- **Category:** Backend / Concurrency
- **Severity:** Medium
- **Location:** `backend/src/services/userAdminService.ts:29–45`
- **Current Problem:**
  Code = `count + n`, then check-then-use. Two concurrent `createUser`/CSV rows can generate the same `STU-0007`; the second insert violates the unique constraint → P2002 → for CSV that row is silently marked failed with a confusing message; for `createUser` it's a 409 "A record with this value already exists" (misleading).
- **Recommended Improvement:**
  Retry on P2002 inside `createUser` (catch → recompute code → retry up to 3 times). The count-based approach is fine at school scale once serialized by retry.
- **Implementation Guidance:** Wrap the `tx.user.create` + profile create in a small `for (let attempt = 0; attempt < 3; attempt++)` retry loop that catches `code === 'P2002'` and re-runs `generateCode`.
- **Suggested Validation:** Parallel `createUser` calls (10 concurrent) → all succeed with distinct codes.

## 3.7 Attendance marking loop is N+1 (up to ~800 queries per request)

- **Status: Completed**

- **Category:** Backend / Performance
- **Severity:** Medium
- **Location:** `backend/src/services/attendanceService.ts:155–219` (`upsertAttendance` — per record: `student.findUnique` + `assertStudentEnrolled` (1 query) + `attendance.findUnique` + create/update)
- **Current Problem:**
  Marking a class of 60 students issues ~240 queries inside one transaction. Works, but slow on Supabase pooler latency (each query is a round trip).
- **Recommended Improvement:**
  Batch the reads: one `student.findMany({ where: { id: { in: ids } } })`, one `courseEnrollment.findMany({ where: { studentId: { in: ids }, courseId, status: 'ACTIVE' } })`, one `attendance.findMany({ where: { studentId: { in: ids }, courseId, date } })`, then issue per-row writes only where needed (Prisma has no bulk upsert; per-row `upsert` calls are acceptable after batched validation).
- **Suggested Validation:** Timing log on a 60-record upsert drops from ~240 to <70 queries.

## 3.8 Announcement/event fan-out is non-transactional and notify failures are invisible

- **Status: Completed**

- **Category:** Backend / Reliability
- **Severity:** Medium
- **Location:** `backend/src/services/communicationService.ts:45–70` (`createAnnouncement` — announcement created, then `notifyUsers` runs as a separate unguarded write), `:172–202` (same for events)
- **Current Problem:**
  If `notifyUsers` fails (transient DB error), the announcement exists but nobody is notified, and no log/audit records the failure. The request also fails **after** the announcement was created, returning a 500 for an operation that actually half-succeeded.
- **Recommended Improvement:**
  Wrap announcement create + fan-out + audit in one `prisma.$transaction` (pass `tx` into `notifyUsers` — extend it to accept an optional client like `createNotification` already does).
- **Implementation Guidance:** Mirror the pattern in `assignmentService.gradeSubmission` (`:513–564`): add `client: any = prisma` param to `notifyUsers`, use it inside a transaction.
- **Suggested Validation:** Forced `notifyUsers` failure (test double) → announcement row is rolled back.

## 3.9 Audit gaps: student borrow requests are logged with `actorId: null`; user updates log keys only

- **Status: Completed**

- **Category:** Backend / Auditability
- **Severity:** Medium
- **Location:** `backend/src/services/libraryService.ts:250–257` (`writeAuditLog({ actorId: null, ... })` for `LIBRARY_BORROW_REQUESTED`), `backend/src/services/userAdminService.ts:217–224` (`USER_UPDATED` metadata logs only `Object.keys(data)`)
- **Current Problem:**
  1. Borrow requests are student-initiated sensitive actions, but the actor is recorded as `null` — the `studentId` is only in metadata and the `AuditLog.actor` relation is unused. AGENTS.md explicitly requires borrowing history changes to be auditable.
  2. `USER_UPDATED` doesn't record **what** changed (before/after), only field names — insufficient to answer "who changed this user's status and what was it before?"
- **Recommended Improvement:**
  1. Resolve the acting user id in `libraryController.createBorrowRequest` (`req.user!.id`) and pass it through; keep `studentId` in metadata.
  2. In `updateUser`, capture `before` values for changed fields and store `{ changes: { field: { from, to } } }` in metadata (exclude `password`-type fields — none exist here).
- **Suggested Validation:** Audit log query for a borrow request shows the student's user id; user status change audit shows previous status.

## 3.10 Backend tests are service-unit tests with `require.cache` mocks; no integration tests; `supertest` unused

- **Category:** Testing
- **Severity:** Medium
- **Location:** `backend/tests/*.test.ts` (e.g., `auth.test.ts:6–56`), `backend/package.json:39,42` (`supertest` + `@types/supertest` installed but never imported anywhere)
- **Current Problem:**
  1. Mocking via `require.cache[...] = {...}` is fragile (module-load-order dependent, breaks with ESM) and means Prisma query logic, transactions, and unique constraints are never exercised — exactly where recent bugs (#1.1, #2.2) live.
  2. No test hits HTTP handlers or the Express app, so routing/auth middleware bugs are invisible.
  3. Coverage is decent per service but `fileStorageService`, `studentSummaryService`, and CSV error paths have no tests.
- **Recommended Improvement:**
  1. Keep the unit tests; add a small integration layer using `supertest` against `app.ts` with a dedicated test database (e.g., `DATABASE_URL` pointed at a throwaway Postgres schema, `prisma migrate deploy` in the test setup).
  2. Priority integration tests: auth login flow, quiz attempt lifecycle (start → submit → limit), library borrow/approve/return, RBAC 401/403 matrix.
  3. Remove `supertest` from deps or start using it — don't carry dead dependencies.
- **Suggested Validation:** `npm test` runs both layers in CI; integration tests fail against the bugs fixed in Critical #1/#2.

## 3.11 No linting, formatting, or CI pipeline anywhere

- **Category:** DevOps / Code Quality
- **Severity:** Medium
- **Location:** repo root (no `.eslintrc*`, no `.prettierrc`, no `.github/workflows/`)
- **Current Problem:**
  Neither workspace has ESLint or Prettier, and there is no CI. Formatting drift is already visible (e.g., `dashboardService.ts:4` has `const prisma = prismaModule as any;export async function ...` on one line; `timetableService.ts` uses a very different spacing style from `assignmentService.ts`). Nothing prevents regressions like the teacher-results bug (High #2.1) from being merged.
- **Recommended Improvement:**
  1. Add ESLint (typescript-eslint) + Prettier configs at the root, scoped per workspace.
  2. Add `.github/workflows/ci.yml`: on PR — `npm ci`, `prisma generate`, `npm run typecheck`, `npm test`, `npm run build`.
- **Implementation Guidance:** `npm i -D eslint typescript-eslint prettier eslint-plugin-react-hooks` at root; minimal flat config; start with `eslint --max-warnings 0` on `src/` only.
- **Suggested Validation:** CI runs green on the current tree (fix any newly surfaced lint errors first, or baseline them).

## 3.12 JWT: no algorithm pinning, 7-day tokens, no revocation story

- **Status: Completed**

- **Category:** Authentication
- **Severity:** Medium
- **Location:** `backend/src/services/authService.ts:27–29` (`jwt.sign`), `backend/src/middleware/auth.ts:18` (`jwt.verify` without `algorithms`), `backend/src/config/env.ts:24` (`jwtExpiresIn` default `'7d'`)
- **Current Problem:**
  1. `jwt.verify(token, secret)` accepts any HMAC alg the library supports; pinning `algorithms: ['HS256']` is the standard hardening.
  2. 7-day tokens with no refresh/revocation: a stolen token is valid for a week even after account archival… (mitigated: `authenticate` checks `user.status` in the DB each request — good), but role changes/demotion take effect immediately while *added* privileges also take effect — the real issue is a week-long theft window with no logout mechanism (logout only deletes the client-side token).
- **Recommended Improvement:**
  1. Pass `{ algorithms: ['HS256'] }` to `jwt.verify`.
  2. Shorten default expiry to `'12h'` (or `'1d'`) — acceptable for a pilot without refresh-token machinery since every request re-validates the user row.
  3. Document that logout is client-side token deletion; if true revocation is needed later, add a `tokenVersion` column checked in `authenticate`.
- **Suggested Validation:** Tampered `alg: none`/`HS384` token rejected with 401.

## 3.13 `express.json()` body limits unconfigured; large writes unbounded elsewhere

- **Status: Completed**

- **Category:** Security / Reliability
- **Severity:** Medium
- **Location:** `backend/src/app.ts:23`
- **Current Problem:**
  Default 100 KB JSON limit (see also High-adjacent CSV finding #3.5) is accidental, not chosen. Conversely there is no limit on array sizes in some writes, e.g., `upsertAttendance` caps at 200 (good), but `notifyUsers` fan-out and quiz `answers` arrays are only bounded implicitly.
- **Recommended Improvement:** Set explicit limits: `express.json({ limit: '2mb' })` (covers CSV import), and in `submitAttempt` cap `answers.length` to the quiz's question count (it already iterates only over known questions — just also reject absurd inputs with a 422 if `answers.length > 200`).
- **Suggested Validation:** 3 MB JSON body → 413 with clean JSON error (add a body-limit error branch to `errorHandler` checking `err.type === 'entity.too.large'` → 413 standard shape).

## 3.14 Frontend: duplicated fetch/error boilerplate and card markup in every page

- **Category:** Frontend / Code Quality
- **Severity:** Medium
- **Location:** All 17 pages, e.g. `frontend/src/pages/QuizDetailPage.tsx:104–116,111–112,195–196,223–224,269–270,300–301` (`err.response?.data?.message || '...'` repeated), repeated `rounded-2xl border border-gray-200/70 bg-white shadow-card ...` class strings throughout every page
- **Current Problem:**
  Every page re-implements: loading flag + error/message state + axios try/catch + `err.response?.data?.message || 'Fallback'`. The 100+ char card class string appears dozens of times. Any change to error handling or card styling means editing 17 files — this is precisely how the teacher-results bug (High #2.1) went unnoticed.
- **Recommended Improvement:**
  1. Add a small hook: `useApi<T>(fetcher)` in `frontend/src/hooks/` returning `{ data, loading, error, reload }` with standardized error extraction.
  2. Add an axios response-mapper or `getApiError(err)` util used everywhere instead of inline `?.` chains.
  3. Add a `Card` component to `components/ui.tsx` that owns the shared class string.
  4. Migrate pages incrementally (start with pages being touched anyway).
- **Suggested Validation:** No behavior change; new pages use the hook; grep for `err.response?.data?.message` decreases to the single util.

## 3.15 Quiz-taking: page refresh wipes all student answers; no beforeunload guard

- **Status: Completed**

- **Category:** Frontend / UX
- **Severity:** Medium
- **Location:** `frontend/src/pages/QuizDetailPage.tsx:125–136` (resume effect resets `selections` to empty), no `beforeunload` listener during `takingQuiz`
- **Current Problem:**
  An accidental refresh or navigation mid-quiz resumes the attempt with **all selections lost** (only the timer survives). Also nothing warns the student before leaving with unanswered answers.
- **Recommended Improvement:**
  1. Persist `selections` to `sessionStorage` keyed by attempt id (`sessionStorage.setItem(\`quiz-${attemptId}\`, JSON.stringify(selections))` in the existing `selections` effect; restore in the resume effect). Clear on successful submit.
  2. Add a `beforeunload` handler while `takingQuiz` (`e.preventDefault(); e.returnValue = ''`) with proper cleanup.
- **Suggested Validation:** Answer 3 questions → refresh → selections restored; timer continuity preserved.

## 3.16 Auto-submit retry loop when expiry submit fails

- **Status: Completed**

- **Category:** Frontend / Reliability
- **Severity:** Medium
- **Location:** `frontend/src/pages/QuizDetailPage.tsx:139–152` (countdown effect) and `:300–307` (submit error path resets `submittingRef`)
- **Current Problem:**
  If the auto-submit request fails (network blip), `submittingRef` resets while `secondsLeft` stays 0 — the next 1s tick re-fires submit, forever, once per second until success. Each retry creates a fresh submit attempt against the server; after fix #1.2 the server rejects duplicates cleanly, but the client hammers and re-renders error banners continuously.
- **Recommended Improvement:** Add a `autoSubmitFailedRef`; once auto-submit has failed, stop re-firing automatically, show a persistent "Time expired — please submit manually" banner with a working manual submit button.
- **Suggested Validation:** Simulate submit 500 at expiry → exactly one auto attempt, banner shown, manual submit works.

## 3.17 Token and user object persisted in localStorage (XSS blast radius)

- **Category:** Security / Frontend
- **Severity:** Medium
- **Location:** `frontend/src/context/AuthContext.tsx:20–45`, `frontend/src/api/client.ts:11–17`
- **Current Problem:**
  JWT + cached user in `localStorage` are readable by any injected script. The app renders mostly trusted content today (no raw HTML injection paths found), but the content-URL XSS vector (High #2.10) shows the risk is real, not hypothetical. Also the cached `user` object can go stale (role changed server-side) until the next `/auth/me`.
- **Recommended Improvement:**
  1. Minimum: keep current storage but fix the injection vector (#2.10) and never store anything beyond `{token, user}`.
  2. Better (pilot-plus): switch to an httpOnly, Secure, SameSite=Strict cookie set by `POST /auth/login`, drop the interceptor's localStorage read, and add CSRF protection for state-changing routes (double-submit cookie pattern). This is a cross-cutting change — schedule it deliberately, not opportunistically.
- **Suggested Validation:** If cookie-based: verify login works cross-origin (`credentials: true` already set in CORS) and all mutating requests still succeed.

## 3.18 Race-prone `markNotificationRead` and generic P2002 handling are fine, but user archive lacks last-admin protection

- **Status: Completed**

- **Category:** Authorization / Reliability
- **Severity:** Medium
- **Location:** `backend/src/services/userAdminService.ts:233–256` (`archiveUser` blocks only self-archive)
- **Current Problem:**
  Two admins can archive each other (or one admin can archive the other), leaving **zero active ADMIN accounts** — full system lockout recoverable only via direct DB access.
- **Recommended Improvement:** Before archiving, when `existing.role === 'ADMIN'`, verify at least one other `ACTIVE` admin remains; reject with `ConflictError('Cannot archive the last active admin')`.
- **Suggested Validation:** With two admins, archiving both in sequence → second request 409.

---

# 4. Low

## 4.1 Prisma client is cast to `any` in 7 of 13 services

- **Category:** Code Quality
- **Severity:** Low
- **Location:** `courseService.ts:7`, `assignmentService.ts:10`, `quizService.ts:9`, `attendanceService.ts:6`, `timetableService.ts:4`, `dashboardService.ts:4`, `studentSummaryService.ts:4` (`const prisma = prismaModule as any`)
- **Current Problem:** The cast disables all Prisma type-checking — typos like `prisma.courses` compile fine and fail only at runtime. The comment says it works around "Prisma type resolution in monorepo"; notably `libraryService.ts`, `notificationService.ts`, `communicationService.ts`, `userAdminService.ts`, and `authService.ts` already import the typed client successfully.
- **Recommended Improvement:** Fix the root cause (most likely the backend `tsconfig` needs `prisma generate` output refreshed, or a stale `node_modules` layout) and remove the casts. If the root cause can't be reproduced, at least cast to the real `PrismaClient` type instead of `any` once, in `prisma/client.ts`, and re-export.

## 4.2 Root `typecheck` script runs full builds (emits `dist/`)

- **Category:** DevOps / Code Quality
- **Severity:** Low
- **Location:** root `package.json:14` (`"typecheck": "npm run build --workspace backend && ..."`), `frontend/package.json:9` (`tsc && vite build`)
- **Current Problem:** "Typecheck" compiles and writes build artifacts; slower than needed and conflates concerns.
- **Recommended Improvement:** Backend: `"typecheck": "tsc --noEmit"` (keep `declaration: true` compatible — `--noEmit` works). Frontend: `"typecheck": "tsc --noEmit"`; point root `typecheck` at those.

## 4.3 Dead and misplaced dependencies

- **Category:** Dependency Management
- **Severity:** Low
- **Location:** `backend/package.json:40` (`nodemon` — unused, `tsx watch` is the dev script), `backend/package.json:39,42` (`supertest` unused — see #3.10), `backend/package.json:35` (`@types/express@^5` against `express@^4.21` — major mismatch; works today but can drift)
- **Recommended Improvement:** Remove `nodemon`; either remove `supertest` or adopt it (#3.10); align `@types/express` to `^4.17.x`. Consider `npm outdated` sweep: Prisma 5 → 6 and Vite 5 → 6/7 majors are available but not urgent — schedule as deliberate upgrades with the integration tests in place.

## 4.4 `DIRECT_URL` optional in env validation but mandatory at runtime

- **Category:** Configuration
- **Severity:** Low
- **Location:** `backend/src/config/env.ts:27` (`directUrl: process.env.DIRECT_URL` — no validation), `backend/src/prisma/client.ts:13` (`url: process.env.DIRECT_URL` — `undefined` → runtime datasource error), `backend/.env.example` documents it
- **Recommended Improvement:** Fail fast in `env.ts`: throw if `DIRECT_URL` is missing in **any** environment (the Prisma client hard-requires it), mirroring the existing production checks.

## 4.5 Uncommitted production guard in `env.ts` — ship it

- **Category:** DevOps
- **Severity:** Low
- **Location:** `backend/src/config/env.ts:14–18` (uncommitted `DEFAULT_USER_PASSWORD` production check, visible in `git status`)
- **Current Problem:** The most recent hardening change (require `DEFAULT_USER_PASSWORD` in production) is **not committed** — a fresh clone runs without it.
- **Recommended Improvement:** Commit the change (it is correct), and update `.env.example` to warn against `Password123!`.

## 4.6 Seed data uses publicly-known credentials with no production guard

- **Category:** Security / Configuration
- **Severity:** Low
- **Location:** `backend/prisma/seed.ts:18` (`Password123!`), seeds `admin@school.edu`
- **Current Problem:** Nothing prevents `prisma db seed` against production, creating a known-credential admin.
- **Recommended Improvement:** Refuse to run when `NODE_ENV === 'production'` unless `ALLOW_SEED=1` is set; log a loud warning regardless.

## 4.7 Request/audit logging omits the authenticated actor for most logged requests

- **Category:** Logging
- **Severity:** Low
- **Location:** `backend/src/app.ts:28–35` (no `req.user?.id` — the logging middleware runs before auth populates `req.user`; also logs on `finish` so `req.user` *is* available at log time but unused)
- **Recommended Improvement:** Include `userId: (req as any).user?.id ?? null` in the finish log line — it's available since logging happens on response finish (part of #2.8's structured logging).

## 4.8 Events list shows past events first and never filters them

- **Category:** Backend / API
- **Severity:** Low
- **Location:** `backend/src/services/communicationService.ts:216–241` (`listEvents` — `orderBy: { startsAt: 'asc' }`, no date filter)
- **Recommended Improvement:** Default to upcoming events (`startsAt: { gte: new Date() }`) with an `?upcoming=false` escape hatch; the schema index `@@index([audience, startsAt])` already supports this.

## 4.9 `addCopies` count is unbounded and copy numbering can collide

- **Category:** Backend / Data Validation
- **Severity:** Low
- **Location:** `backend/src/controllers/libraryController.ts:68` (`parseInt(req.body.count, 10) || 1` — `count: 1000000` accepted), `backend/src/services/libraryService.ts:184–197` (max copy number derived from string sort)
- **Recommended Improvement:** Clamp `count` to 1–500; validate `copyNumber` parse (non-numeric copy numbers would make `start` NaN → invalid rows).

## 4.10 Repo clutter: committed handoff packages and stray logs

- **Category:** DevOps / Code Quality
- **Severity:** Low
- **Location:** `member-handoff-packages/` (6 committed markdown files — team-planning artifacts), `vite-build.log` (untracked, already ignored), `cline_overnight_codebase_improvement.md` (ignored)
- **Recommended Improvement:** Move `member-handoff-packages/` to the wiki or `docs/` (or delete — they describe finished work); keep implementation docs under `docs/` only.

---

# 5. Optional Improvements

## 5.1 In-memory notification polling — consider SSE before scaling

- **Category:** Architecture
- **Severity:** Optional
- **Location:** `frontend/src/components/Layout.tsx:129–150` (30s poll with backoff)
- **Note:** The polling implementation is genuinely good (visibility-aware, exponential backoff on failure). If notifications must feel real-time later, Server-Sent Events from a single `/api/notifications/stream` endpoint is the natural upgrade for a modular monolith — no new infra needed.

## 5.2 Per-route request validation with zod

- **Category:** Backend / Code Quality
- **Severity:** Optional
- **Location:** All controllers (manual checks today)
- **Note:** The hand-rolled validation is consistent but verbose and easy to skip (which caused #2.9). A single `validate(schema)` middleware per route (zod + a thin adapter) would replace ~30 inline checks with declarative schemas and produce uniform 422s. Large but mechanical refactor; do it module-by-module after the High fixes.

## 5.3 Consistent 404-vs-403 semantics for cross-tenant resources

- **Category:** Security / API
- **Severity:** Optional
- **Location:** e.g., `quizService.getAttemptDetail` returns 403 for foreign attempts (id existence confirmed)
- **Note:** Returning 403 confirms the resource exists to the probing user. For a school pilot this is acceptable and more debuggable; if hardening is desired, return 404 for foreign-owned resources. Not worth breaking frontend error handling over.

## 5.4 Add `ErrorBoundary` and route-level document titles

- **Category:** Frontend / Reliability / SEO
- **Severity:** Optional
- **Location:** `frontend/src/App.tsx`, `frontend/src/main.tsx`
- **Note:** A render error currently blanks the whole app. Add a top-level React error boundary with a "reload" action, and a `usePageTitle(title)` hook setting `document.title` per route (minor SEO/UX polish; the app is auth-gated so SEO weight is negligible).

## 5.5 Frontend axios timeout and abortable fetches

- **Category:** Frontend / Reliability
- **Severity:** Optional
- **Location:** `frontend/src/api/client.ts:3–8` (no `timeout`), page-level `useEffect` fetches without `AbortController`
- **Note:** Add `timeout: 15000` to the axios instance; wrap page fetches in `AbortController` cleanup to avoid setState-after-unmount warnings on slow networks (low user impact today).

## 5.6 P2002 handler could map constraint targets to friendly messages

- **Category:** API
- **Severity:** Optional
- **Location:** `backend/src/middleware/errorHandler.ts:8–16`
- **Note:** After the local P2002 catches (#2.12), the generic handler remains as fallback. It can read `err.meta?.target` to produce e.g. "Email already registered". Polish only.

---

# 6. Recommended Implementation Order

Ordered to **stop the bleeding first, then harden, then modernize**. Items are grouped; within a group, order matters less.

**Phase 1 — Correctness and integrity bugs (do first, low risk):**
1. #1.1 Quiz attempt limit bypass (gameable core feature)
2. #1.2 Atomic quiz submission
3. #2.1 Teacher/admin quiz results fetch (broken feature, one-line-ish)
4. #2.2 Library double-approval race
5. #2.11 Expired-attempt scoring policy (decide + document)
6. #3.3 OVERDUE loan handling
7. #3.1 Quiz multi-select answer storage (needs small migration)

**Phase 2 — Production safety (before next deploy):**
8. #1.3 `trust proxy` + limiter keying
9. #2.8 Graceful shutdown + structured logs + real health check
10. #2.5 Pagination bounds helper (mechanical sweep)
11. #2.9 / #2.10 Enum + URL validation
12. #2.6 Upload memory cap + magic-byte sniffing
13. #3.5 CSV import limits + body limit (#3.13)
14. #2.12 Local P2002 catches for friendly conflicts

**Phase 3 — Privacy, auth, auditability:**
15. #2.3 PII trimming in course/attendance/summary responses
16. #2.4 Password change + admin reset endpoints (+ frontend)
17. #3.12 JWT algorithm pinning + shorter expiry
18. #3.18 Last-admin archive protection
19. #3.9 Audit actor + before/after metadata
20. #3.2 Timetable transactional conflicts + audits

**Phase 4 — Quality infrastructure:**
21. #3.11 ESLint/Prettier/CI (do this early in phase 4, it protects everything after)
22. #3.10 Integration tests with supertest on a throwaway DB
23. #3.14 Frontend fetch hook + shared Card + error util
24. #4.x dependency/config cleanups (#4.5 commit the env.ts guard immediately — it's free)

**Phase 5 — Deliberate modernization (scheduled, not opportunistic):**
25. #3.17 httpOnly cookie auth + CSRF (cross-cutting; needs planning)
26. #5.2 zod validation middleware migration
27. #4.3 dependency majors (Prisma 6, Vite 7) with the new test suite
28. #5.x optional polish (SSE, error boundary, timeouts)

**Cross-cutting cautions for the implementing agent:**
- Findings #1.1, #1.2, #3.1, and #2.11 all touch `quizService.submitAttempt`/`startAttempt` — implement them as **one coordinated change** with the new tests, not four separate passes.
- #2.3 (PII trimming) requires checking `CourseDetailPage`/`AttendancePage`/`StudentProfilePage` consumers before removing fields.
- #1.3 requires a deployment-env decision (`TRUST_PROXY` value) — coordinate with whoever operates the hosting platform; do not guess `true`.
- The `env.ts` production guard is currently **uncommitted** (#4.5) — commit it before starting anything else so it isn't lost.
