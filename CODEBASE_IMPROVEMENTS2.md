# Codebase Improvement Audit 2 — Smart Education System

**Audit date:** 2026-09-07
**Scope:** Full repository — backend (`backend/src`, `backend/prisma`, `backend/tests`), frontend (`frontend/src`), configuration, dependencies, CI/devops. Verified against the tree at commit `a0d7cb8` (post `CODEBASE_IMPROVEMENTS.md` fixes: helmet, pagination helper, quiz attempt-limit/double-submit fixes, library approve guard, getApiError migration, graceful shutdown, JWT alg pinning).
**Method:** Full source read of architecture/config/auth/services plus three parallel deep-review passes (backend logic, frontend, DB/security/DevOps/testing). Every finding below was verified against actual code; file/line references are to the current tree. Items already fixed by the first audit are NOT repeated except where a residual variant remains (explicitly noted).
**Deliverable:** `CODEBASE_IMPROVEMENTS2.md` (this file). Existing application code was not modified.

---

## Implementation Status (updated 2026-09-07)

All 48 findings were processed one at a time (implement → validate → commit → push). Summary of final status:

| Finding | Status | Commit |
|---|---|---|
| C1 Restrict cascades | **Completed** (schema + migration `20260907000000`; no course/book hard-delete endpoints exist, P2003→409 defense-in-depth added with C4) | `2ef3174` |
| C2 tokenVersion revocation | **Completed** (incl. status-transition revocation) | `ce6b360` |
| C3 rate-limit wiring | **Completed** (edge IP limiter + per-user `authenticatedLimiter` + prod TRUST_PROXY fail-fast) | `c3508ea` |
| C4 quiz content freeze | **Completed** (freeze + H9 + P2003→409) | `cc989b8` |
| H1 library reject race | **Completed** | `3951806` |
| H2 conditional returns | **Completed** | `3951806` |
| H3 timetable race guard | **Completed** (advisory locks + room normalization) | `822dda8` |
| H4 upload orphan compensation | **Completed** | `822dda8` |
| H5 CSV import hardening | **Completed** (bounded concurrency 4 + code-collision retry; background queue documented as future work) | `7d16491` |
| H6 admin moderation override | **Completed** (update/archive/question/grading paths; creates remain teacher-owned) | `e62a282` |
| H7 update archive guards | **Completed** | `e62a282` |
| H8 student status leak | **Completed** | `e62a282` |
| H9 score/points lowering guard | **Completed** | `cc989b8` |
| H10 session revalidation | **Completed** (always revalidate on mount; 401-only logout; logout clears quiz keys) | `86b0a03` |
| H11 unsafe href | **Completed** (SafeLink scheme allowlist on content + submission links) | `86b0a03` |
| H12 integration tests in CI | **Completed** (Postgres service + migrate deploy + integration job) | `6d16197` |
| H13 pooler/direct split | **Completed** (app on DATABASE_URL pooler with fallback; migrations/seed on DIRECT_URL) | `adda3da` |
| M1 stale overdue timestamp | **Completed** | `3951806` |
| M2 pending-request flood cap | **Completed** (tx + SELECT FOR UPDATE, cap 5) | `3951806` |
| M3 empty-ISBN trap | **Completed** | `3951806` |
| M4 unbounded copies include | **Completed** (bounded available-first preview + server counts) | `7d16491` |
| M5 student aggregates in memory | **Completed** (SQL aggregates matching admin metric) | `7d16491` |
| M6 announcement fan-out | **Completed** (500-row chunked fan-out; retention policy documented) | `7d16491` |
| M7 attendance roster/tx/audit | **Completed** (paged roster, bulk writes, per-date audit, marker refresh) | `7d16491` |
| M8 announcement/event delete RBAC | **Completed** (owner-or-admin + route opening) | `7d16491` |
| M9 sensitive-route limits | **Completed** (sensitiveLimiter 30/15min) | `c3508ea` |
| M10 upload RAM/text hardening | **Completed** (disk streaming, markup scan, upload throttle, scan hook) | `6bc009f` |
| M11 tx-audit + login audit | **Partially Completed** — LOGIN_SUCCESS/LOGIN_FAILURE audits added (`e62a282`); library reject/return audits moved into their transactions (`3951806`); the remaining standalone audit writes (course/assignment/book create-update paths) still commit after the write and remain as documented future work | `e62a282`, `3951806` |
| M12 password policy + secret hygiene | **Completed** (72-byte cap, import warning, SEED_PASSWORD, README placeholders; complexity checks deemed out of pilot scope) | `ce6b360` |
| M13 CORS/proxy multi-env | **Completed** (CLIENT_URLS list + https prod gate + VITE_API_PROXY) | `adda3da` |
| M14 Docker manifests | **Completed** (multi-stage Dockerfiles + nginx.conf; image builds gated in CI — not runnable locally, no Docker daemon) | `6d16197` |
| M15 CI hardening | **Completed** (DB service, prisma validate, split typechecks, migrate deploy, integration, npm audit high-gate, docker build job) | `6d16197` |
| M16 logs/redaction/APM | **Completed** (leveled logger with PII/secret redaction, no prod stacks, optional no-dependency Sentry hook; full APM deferred) | `6d16197` |
| M17 useApi migration | **Partially Completed** — Dashboard (x3), Announcements, Timetable, Notifications, Courses, AdminUsers migrated; `location.reload()` eliminated from pages; section-tolerant detail pages (CourseDetail/QuizDetail) intentionally keep bespoke loaders | `86b0a03` |
| M18 getApiError structured errors | **Completed** (joined array/object errors + getFieldErrors) | `86b0a03` |
| M19 notification split-brain | **Completed** (notificationBus + immediate bell refresh + abortable poll) | `86b0a03` |
| M20 quiz UX gaps | **Completed** (progress bar, sticky footer, submit confirm, resume confirm, hh:mm:ss, low-time SR announcement, exactly-1-correct builder, clearable radios) | `86b0a03` |
| L1 pageSize 100 / envelope drift / ApiResponse<T> | **Requires Manual Review** — unifying every list endpoint on `paginated()` is a cross-cutting API-breaking change needing coordinated frontend type updates; typed generics + real pagination UI are follow-up work | — |
| L2 label/htmlFor pairing | **Completed** (all standalone form labels paired across 8 pages) | `16c2799` |
| L3 keyboard/ARIA semantics (Tabs/Dropdown/Modal/Tooltip/CommandPalette) | **Requires Manual Review** — needs a keyboard-only + screen-reader pass; partially mitigated by Modal Escape handling and aria-live additions in M20 | — |
| L4 numeric coercion / client validation | **Completed** (guards on grade/quiz/assignment/timetable/book forms + 20MB pre-check) | `16c2799` |
| L5 archive semantics + envelope drift | **Requires Manual Review** — same cross-cutting envelope decision as L1; archive verb unification deferred to avoid breaking existing clients | — |
| L6 roster enumeration / retention doc | **Requires Manual Review** — requires a policy decision (names vs anonymized IDs, dateOfBirth justification, retention windows) that belongs to the school/pilot owner | — |
| L7 deps/engines | **Partially Completed** — engines pinned to Node >=20 (`88b0b16`); CI audit gate at high+ (`6d16197`); moderate qs advisory allowlisted pending express 5; frontend lint/test scripts and react-router 7 evaluation deferred | `88b0b16` |
| O1 dashboard clock re-renders | **Completed** (memoized hero, 30s tick) | `16c2799` |
| O2 role-denied redirects / dead catch-all | **Completed** (/403 page + NotFound top-level catch-all) | `16c2799` |
| O3 competing redirect mechanisms | **Completed** (?redirect= then sessionStorage fallback) | `86b0a03` |
| O4 SVG gradients / contrast / confirm / password field | **Partially Completed** — admin password field masked + Settings show/strength/match (O4 subset of the L2/O4 commit `16c2799`); duplicate gradient IDs, yellow-pill contrast, and window.confirm→Modal reuse remain | `16c2799` |

---

## Executive Summary

The first audit's fixes are genuinely present (trust-proxy config, helmet, pagination clamping, quiz attempt reuse + atomic submit, library approve guard, magic-byte sniffing, graceful shutdown, health DB ping, per-user limiter key *code*). This second audit therefore focuses on **what is still open**: residual race variants, data-model integrity, auth session lifecycle, test/CI gaps, and frontend a11y/UX debt.

| Priority | Count |
|---|---|
| **Critical** | 4 |
| **High** | 13 |
| **Medium** | 20 |
| **Low** | 7 |
| **Optional** | 4 |
| **Total** | **48** |

**Most important areas requiring attention:**

1. **Data destruction by cascade (Critical C1)** — 14 `onDelete: Cascade` relations let one course/book/quiz delete wipe grades, attendance, attempts, loans. Directly contradicts AGENTS.md soft-delete rule.
2. **Session revocation gap (Critical C2)** — stolen JWTs survive password change/reset and archive-reactivate for up to 12h; no `tokenVersion`.
3. **Rate limiting is structurally ineffective (Critical C3)** — per-user limiter key is dead code (mounted before auth), and default `TRUST_PROXY=""` collapses all clients into one IP bucket behind a proxy.
4. **Quiz content mutability after attempts (Critical C4)** — questions/points editable and deletable after submissions; grading keys rewritten, deletes 500 on FK.
5. **Library reject/return races + Cloudinary orphan leak (High)** — reject path unguarded vs approve; returns resurrect LOST/DAMAGED copies; duplicate-submit race leaks billable uploads.
6. **Test/CI blind spot (High)** — all unit tests mock Prisma via `require.cache`; the integration suite that covers the fixed races never runs in CI (no DB service).

---

# 1. Critical

## C1. Destructive `Cascade` deletes wipe sensitive academic history

- **Category:** Database / Reliability
- **Severity:** Critical
- **Location:** `backend/prisma/schema.prisma:239,264,289,319,367,389,406,426,450,473,516,591,608,654` (e.g. `CourseEnrollment.course`, `Assignment.course`, `Quiz.course`, `QuizAttempt.quiz`, `QuizAnswer` x2, `Attendance.course`, `TimetableSlot.course`, `LibraryBookCopy.book`); migrations confirm FK cascades.
- **Current Problem:** Deleting one `Course` cascades to enrollments, content, assignments + submissions + grades, quizzes + questions + attempts + answers, attendance records, and timetable slots. Deleting a `Quiz` wipes attempts/answers; deleting a `LibraryBook` wipes copies. AGENTS.md mandates soft deletion/archival for students, teachers, and academic records, and README claims "no hard deletion of historical records" — cascades violate both. There is no course-delete service at all, so any future admin tooling or Prisma Studio use can silently destroy terms of data.
- **Recommended Improvement:** Change all academic-history relations to `onDelete: Restrict` and enforce archival status transitions in services (pattern already exists for quizzes/assignments).
- **Implementation Guidance:**
  1. In `schema.prisma`, replace `onDelete: Cascade` with `onDelete: Restrict` for: enrollment/content/assignment/quiz/attempt/answer/attendance/timetable relations to Course; attempt/answer relations to Quiz; submission relation to Assignment; copy relation to Book. Keep `Cascade` only for strictly owned join rows where loss is acceptable (e.g. `ImportError.batch`, `Notification.user` — decide explicitly and comment).
  2. `prisma migrate dev --name restrict-academic-cascades`.
  3. Add service-level guards: any delete endpoint for courses/books must reject when dependent rows exist (409 with counts).
- **Suggested Validation:** Integration test: seed course with submissions/attempts → `prisma.course.delete` fails with P2003/P2014; archival path still works. `prisma validate` passes.

## C2. Tokens survive password change/reset and archive-reactivate — no revocation

- **Category:** Authentication / Security
- **Severity:** Critical
- **Location:** `backend/src/services/authService.ts:15-21` (`signToken({sub})` only), `:101-102` (`changePassword` rotates hash only); `backend/src/services/userAdminService.ts:321-344` (`resetUserPassword`); `backend/src/middleware/auth.ts:24-42` (checks `status` only, no version).
- **Current Problem:** JWT payload is `{ sub }` with no version/jti. `changePassword` and `resetUserPassword` rotate the hash but a stolen session token remains valid until `JWT_EXPIRES_IN` (default `12h`). Archive-then-reactivate has the same hole (status flips back to ACTIVE, old token works). For a school system with shared computers, a 12h theft window after a password change defeats the purpose of the change.
- **Recommended Improvement:** Add `tokenVersion Int @default(0)` to `User`; embed in JWT; enforce in `authenticate`; bump on password change/reset.
- **Implementation Guidance:**
  1. Migration: `tokenVersion Int @default(0)` on `User`.
  2. `signToken(userId, tokenVersion)` → `jwt.sign({ sub, tv }, ...)`.
  3. `authenticate`: select `tokenVersion`, reject if `payload.tv !== user.tokenVersion`.
  4. `changePassword`/`resetUserPassword`: `data: { passwordHash, tokenVersion: { increment: 1 } }`.
  5. Keep 12h default (shortening is optional once revocation exists).
- **Suggested Validation:** Unit test: change password → old token 401, new login works. Integration: reset password invalidates prior token. Existing `users.test.ts` reset assertions extended.

## C3. Rate limiting is structurally ineffective (dead per-user key + proxy-IP bucketing)

- **Category:** Security / Reliability
- **Severity:** Critical
- **Location:** `backend/src/app.ts:42` (`app.use('/api', apiLimiter)` before any `authenticate`), `backend/src/middleware/rateLimit.ts:9-13` (`limiterKey` reads `(req).user?.id`), `backend/src/config/env.ts:42` (`TRUST_PROXY` default `''`), `backend/src/routes/authRoutes.ts:10`.
- **Current Problem:** (1) `apiLimiter` runs before auth middleware is ever mounted, so `req.user` is always `undefined` at limit time — the per-user key is dead code; all traffic falls back to IP. (2) With default `TRUST_PROXY=""` behind any proxy (Render/Supabase-style hosting), `req.ip` is the proxy IP, so `authLimiter` (10 logins/15min) becomes a *global* shared bucket: one attacker or one busy NAT locks out all logins school-wide; audit `ipAddress` values record the proxy IP. Comments describe the intended behavior but the wiring does not deliver it.
- **Recommended Improvement:** Split edge (IP) limiting from authenticated (user) limiting; document/fail-fast `TRUST_PROXY`.
- **Implementation Guidance:**
  1. Keep `apiLimiter` (IP-keyed) at edge in `app.ts`.
  2. Add `authenticatedLimiter` (user-keyed `limiterKey`) applied *inside* routers after `authenticate` (e.g. in each router file or a post-auth `app.use(authenticateOptional, authenticatedLimiter)` — simplest: export and mount per-router).
  3. `authLimiter`: keep IP-based (no user at login) but document required `TRUST_PROXY=1` per deploy target in `.env.example` + deployment docs; consider keying by `ip + normalized email` to avoid cross-user lockout (careful not to create an enumeration oracle — return identical messages).
  4. Add prod boot check: if `NODE_ENV=production` and `TRUST_PROXY` empty, log a loud warning (or throw when `RENDER`/`FLY` env detected).
- **Suggested Validation:** Supertest: two different users behind same IP each get own budget; login limiter trips per-IP with `trust proxy` set in test app; audit log records distinct IPs.

## C4. Quiz questions/points editable and deletable after attempts — history corruption + 500

- **Category:** Backend / Data Integrity
- **Severity:** Critical
- **Location:** `backend/src/services/quizService.ts:476-651` (`addQuestion`/`updateQuestion`/`deleteQuestion` check only teacher ownership, never `quiz.status` nor existing attempts); `updateQuestion` replaces options via `deleteMany:{}` (`:585`); schema `QuizAnswer.optionId onDelete:SetNull`, `questionId onDelete:Restrict`.
- **Current Problem:** Editing a question after submissions rewrites grading keys (`QuizAnswer.isCorrect/pointsEarned` dangle, `optionId → null` via SetNull). Deleting a question with answers throws raw P2003 FK → 500 via `errorHandler`. Lowering `points` after grading creates `pointsEarned > points` states and retroactively changes averages. Grades are AGENTS.md-sensitive records; silent mutation is an integrity violation.
- **Recommended Improvement:** Freeze quiz content once published or attempted (or version questions).
- **Implementation Guidance:**
  1. In `addQuestion`/`updateQuestion`/`deleteQuestion`: load `quiz` with `_count: { attempts: true }`; if `quiz.status !== 'DRAFT'` or `attempts > 0`, throw `ConflictError('Quiz content is frozen after publishing/attempts — create a new quiz to change questions')`.
  2. In `errorHandler.ts`, map P2003 → 409 `ConflictError` as defense-in-depth.
  3. Same guard for lowering `maxScore`/`points` (see H9): reject lowering below `MAX(existing scores)` or require explicit regrade flow.
- **Suggested Validation:** Integration: submit attempt → update question → 409; delete question with answers → 409 not 500; DRAFT quiz with zero attempts still editable.

---

# 2. High

## H1. Borrow-request reject path races with approve — orphan loan

- **Category:** Backend / Concurrency
- **Severity:** High
- **Location:** `backend/src/services/libraryService.ts:363-476` (APPROVED uses `$transaction` + `updateMany({status:AVAILABLE})` guard `:399-405` + P2002 catch; REJECTED at `:452-472` does plain `update({where:{id}})` with no `status:PENDING` guard, audit outside tx).
- **Current Problem:** Approve and reject interleaved both pass the `request.status === 'PENDING'` read; reject can overwrite `APPROVED → REJECTED`, leaving a live `LibraryLoan` + `BORROWED` copy attached to a `REJECTED` request — orphan loan, inventory inconsistency.
- **Recommended Improvement:** Make reject atomic with the same claim pattern.
- **Implementation Guidance:** `updateMany({ where: { id, status: 'PENDING' }, data: { status: 'REJECTED', ... } })`; if `count === 0` throw `ConflictError`; move audit into the same tx.
- **Suggested Validation:** Integration: concurrent approve + reject → exactly one wins, no orphan loan row.

## H2. `returnLoan` resurrects LOST/DAMAGED copies as AVAILABLE (+ wasteful no-op write)

- **Category:** Backend / Business Logic
- **Severity:** High
- **Location:** `backend/src/services/libraryService.ts:578-601` (claim `updateMany({status:{not:RETURNED}})` good; copy reset unconditional `status:'AVAILABLE'` `:598-601`; no-op `tx.libraryLoan.update({where:{id},data:{}})` `:593-596`).
- **Current Problem:** Returning a copy previously marked LOST/DAMAGED silently resurrects it as borrowable with no condition assessment step. Extra no-op update adds latency inside a contended tx.
- **Recommended Improvement:** Require explicit condition on return; only AVAILABLE-ify BORROWED copies.
- **Implementation Guidance:** Accept `condition?: 'AVAILABLE'|'DAMAGED'|'LOST'` in return; set copy status from it (default: only flip if current is `BORROWED`, else keep); drop no-op update, return claimed row via `findUnique`.
- **Suggested Validation:** Mark copy LOST → return → stays LOST (or follows explicit condition); double-return → 409.

## H3. Timetable conflict check is check-then-insert with no DB guard (+ room normalization gap)

- **Category:** Backend / Concurrency
- **Severity:** High
- **Location:** `backend/src/services/timetableService.ts:62-63,96-97,129-144`; `backend/prisma/schema.prisma:597-614` (plain indexes only).
- **Current Problem:** `checkConflicts` (`findMany`) then create/update in the same tx at default READ COMMITTED does NOT serialize concurrent txs — two admins can both read "no conflict" and both insert (double-booked room/teacher). Room match is exact-string, so `"Room 101"` vs `"room 101 "` bypasses the check.
- **Recommended Improvement:** Normalize + add a real serialization guard.
- **Implementation Guidance:** (1) Normalize `room` on write (`trim().toLowerCase()` or store canonical + display). (2) Pilot-appropriate guard: `SELECT ... FOR UPDATE` on parent course row or a Postgres advisory lock `pg_advisory_xact_lock(hashtext(room||day))` inside the tx before re-checking conflicts on the tx client. Full fix later: EXCLUDE constraint on tstzrange. (3) Note: prior audit's "transaction closes race" claim is false under READ COMMITTED — correct the comment.
- **Suggested Validation:** Integration with two concurrent `createTimetableSlot` overlapping same room/day → one 409. Unit: room variants collide.

## H4. Assignment file orphaned on duplicate submit — Cloudinary leak

- **Category:** Backend / Reliability
- **Severity:** High
- **Location:** `backend/src/services/assignmentService.ts:390-436` (`uploadFile` to Cloudinary `:404` before `assignmentSubmission.create` `:417`; P2002 caught `:432-434` but asset never deleted). `deleteFile` helper exists (`fileStorageService.ts:122-129`) but is never called on this path.
- **Current Problem:** Double-click/retry after successful upload but failed/slow DB insert leaks billable Cloudinary objects with no DB reference, forever.
- **Recommended Improvement:** Compensate on post-upload failure.
- **Implementation Guidance:** Capture `uploadResult.publicId`; in `catch` (P2002 or any error after upload), `await deleteFile(publicId)` before rethrowing. Alternative: create DB row first, upload, then patch URL.
- **Suggested Validation:** Unit with mocked `uploadFile` + P2002 on create → `deleteFile` called once with the publicId; one 201 + one 409 path leaves exactly one asset.

## H5. CSV import is sequential, bcrypt-bound, N+1, no code-collision retry — will time out at scale

- **Category:** Backend / Performance / Reliability
- **Severity:** High
- **Location:** `backend/src/services/userAdminService.ts:392` (5000-row cap), `:421-488` (sequential per-row `findUnique` + `bcrypt.hash(10)` + `$transaction`), `:30-46` (`generateCode` count-based on global `prisma`), `:125-167` (`createUser` retries P2002 but import path does not).
- **Current Problem:** 5000 rows × (~100ms bcrypt + 3 DB roundtrips, sequential) = many minutes in one request → gateway timeout, event-loop starvation, batch stuck PENDING; concurrent imports spuriously fail rows on code collision.
- **Recommended Improvement:** Move to background job; in the meantime bound concurrency and cost.
- **Implementation Guidance:** (1) Wrap import loop in try/catch that marks batch FAILED on fatal error (no orphaned PENDING). (2) Cap bcrypt concurrency (e.g. p-limit 4) or pre-hash once per unique password. (3) Reuse `createUser`-style P2002 retry for `generateCode` collisions in the import path, or preferably allocate codes from a DB sequence. (4) Long-term: queue (BullMQ/pg-boss) + `ImportBatch` polling endpoint.
- **Suggested Validation:** 1000-row import completes <60s on staging; kill mid-import → batch FAILED not PENDING; parallel imports → zero spurious code-collision row errors.

## H6. ADMIN locked out of LMS content moderation

- **Category:** Authorization
- **Severity:** High
- **Location:** `backend/src/routes/courseRoutes.ts:22-23,35-36,42,48`, `backend/src/routes/assignmentRoutes.ts:50-51,57-58`, `backend/src/routes/quizRoutes.ts:16-24`; services check `teacher.id === course.teacherId` with no admin override.
- **Current Problem:** Course/content/assignment/quiz/question create/update/archive require TEACHER role. An admin cannot intervene if a teacher leaves or is suspended; archived-teacher courses become unmanageable. For a pilot with staff churn this is an operational blocker.
- **Recommended Improvement:** Allow ADMIN override with audit.
- **Implementation Guidance:** In routes add `requireRole('TEACHER','ADMIN')`; in services accept `actorRole` and skip ownership check when `ADMIN`, adding `ADMIN_OVERRIDE` audit metadata (`actorId`, `ownerTeacherId`).
- **Suggested Validation:** RBAC matrix test: admin updates/archives teacher course → 200 + audit; student → 403.

## H7. `PUT /users/:id {status:ARCHIVED}` bypasses archive guards

- **Category:** Authorization / Reliability
- **Severity:** High
- **Location:** `backend/src/services/userAdminService.ts:206-217` (allows any of ACTIVE/SUSPENDED/ARCHIVED, no self/last-admin check) vs `:278-292` (`archiveUser` correctly blocks self-archive and last active admin).
- **Current Problem:** Admin can lock out the system via generic update (self-ARCHIVED or last-admin ARCHIVED). Also allows empty `fullName: ""` (`:214`) and unvalidated `phone/gradeLevel/section/subject`.
- **Recommended Improvement:** Force archival through the guarded path; validate update fields.
- **Implementation Guidance:** In `updateUser`, reject `status: 'ARCHIVED'` with `ValidationError('Use POST /users/:id/archive')`; replicate self/last-admin checks for SUSPENDED; reject empty `fullName`; validate phone/format fields with existing helpers.
- **Suggested Validation:** `PUT ... {status:ARCHIVED}` → 422; self-suspend → 403/409; last-admin suspend → 409.

## H8. Student assignment listing leaks unpublished titles via `?status=`

- **Category:** Security / Privacy
- **Severity:** High
- **Location:** `backend/src/services/assignmentService.ts:63-74` (when `?status=` present, `where.status = status` unvalidated, bypassing STUDENT→PUBLISHED default); detail still blocked at `:156-159`.
- **Current Problem:** Students enumerate DRAFT/CLOSED/ARCHIVED assignment titles via `?status=DRAFT`; `?status=FOO` hits Prisma validation → 500.
- **Recommended Improvement:** Force STUDENT to PUBLISHED; validate enum.
- **Implementation Guidance:** Validate with existing `assertStatusCode()`; for `role === 'STUDENT'` force `status = 'PUBLISHED'` (reject others 403).
- **Suggested Validation:** As student `?status=DRAFT` → 403 or PUBLISHED-only; `?status=FOO` → 422 never 500.

## H9. Lowering `maxScore`/question points after grading corrupts scores

- **Category:** Backend / Data Integrity
- **Severity:** High
- **Location:** `backend/src/services/assignmentService.ts:280-286`, `backend/src/services/quizService.ts:561-568,571-589` (accept any positive value, no check vs graded `score`/`pointsEarned`).
- **Current Problem:** `score > maxScore` states; averages change retroactively; violates sensitive-record auditability.
- **Recommended Improvement:** Reject lowering below existing max or require regrade flow.
- **Implementation Guidance:** On update, `aggregate(_max: { score })` over existing submissions/answers; if `newMax < maxExisting`, 409 with message; raising is allowed (audit old→new).
- **Suggested Validation:** Grade 80/100 → set maxScore 50 → 409; set 120 → 200 + audit.

## H10. Auth token + user in `localStorage`, stale session, no refresh

- **Category:** Frontend / Authentication
- **Severity:** High
- **Location:** `frontend/src/api/client.ts:15,34-35`, `frontend/src/context/AuthContext.tsx:20-27,41-64`.
- **Current Problem:** JWT + full user in `localStorage` (any XSS exfiltrates long-lived token). `AuthContext` skips `refreshUser()` when cached user exists → expired/revoked token looks authenticated until first 401; conversely transient network failure triggers `logout()`. `logout()` leaves quiz-draft keys and `postLoginRedirect`.
- **Recommended Improvement:** Revalidate on mount; distinguish 401 vs network; move to httpOnly cookies later.
- **Implementation Guidance:** Always call `/auth/me` on mount; on failure: 401 → logout, else keep cached user + retry flag. Clear `quiz-*` and redirect keys on logout. Long-term: httpOnly cookie + short access token (pairs with C2).
- **Suggested Validation:** Expired token + cached user → logged out on load; offline blip → stays logged in with retry banner.

## H11. Unsafe `href={url}` — stored-XSS via teacher content / submission URLs

- **Category:** Frontend / Security
- **Severity:** High
- **Location:** `frontend/src/pages/CourseDetailPage.tsx:652-659`, `frontend/src/pages/AssignmentDetailPage.tsx:212-219,318-326` (raw `item.url`/`fileUrl` in `<a href target=_blank>`; `rel=noopener` does not help `javascript:` URLs). Backend URL allowlist (first-audit #2.10) mitigates new writes but previously stored rows + any gap remain exploitable, and frontend must never trust the wire.
- **Current Problem:** `javascript:alert(document.cookie)` link executes in app origin → token theft (pairs with H10).
- **Recommended Improvement:** Defense in depth: client-side scheme allowlist.
- **Implementation Guidance:** Add `isSafeHttpUrl()` (allow `http/https` only, or same-origin + Cloudinary host); render non-conforming as plain text + "blocked unsafe link" note. Apply everywhere URLs render.
- **Suggested Validation:** Render `javascript:` URL → plain text, no anchor; https/Cloudinary links unaffected. Security test with stored payload.

## H12. Unit tests mock Prisma — constraints, cascades, races untested; integration suite never runs in CI

- **Category:** Testing
- **Severity:** High
- **Location:** `backend/tests/*.test.ts` (`require.cache` Prisma stub, e.g. `auth.test.ts:8-62`); `backend/tests/integration/*.integration.test.ts` (covers quiz lifecycle, double-submit 409, library race, pagination — but skips without DB `helpers.ts:31-47`); `.github/workflows/ci.yml:1-33` (runs `test:backend` unit only); `backend/package.json:12-13`.
- **Current Problem:** Service logic asserted, but P2002/P2003 mapping, cascades, transaction races — exactly where C1/C4/H1 live — are never exercised in CI. `supertest` installed but only used by the skipped suite.
- **Recommended Improvement:** Run integration in CI with a Postgres service.
- **Implementation Guidance:** Add `services: postgres:16` to `ci.yml`; `prisma migrate deploy`; run `test:integration`; add cases: timetable double-book, CSV duplicate-email race, empty-ISBN update, student aggregate parity. Keep unit suite as-is.
- **Suggested Validation:** CI green with both layers; integration fails if C4/H1 guards removed (mutation check).

## H13. `DATABASE_URL` dead; app pins `DIRECT_URL` (pooler misuse)

- **Category:** Database / DevOps
- **Severity:** High
- **Location:** `backend/src/prisma/client.ts:10-16` (overrides `datasources.db.url = DIRECT_URL`), `backend/prisma/schema.prisma:8-12` (`url=DATABASE_URL`, `directUrl=DIRECT_URL`), `backend/src/config/env.ts:20-28`. Comment claims DIRECT_URL is the "session pooler" — backwards.
- **Current Problem:** Pooler URL unused; every Node process opens direct connections → connection exhaustion on Supabase direct port; failover/pooling config ignored.
- **Recommended Improvement:** Use pooler for app, direct for migrations.
- **Implementation Guidance:** App client → `DATABASE_URL` (pooler, port 6543) with explicit `connection_limit`; migrations/seed → `DIRECT_URL`. Fix comment. Document pool sizing (`connection_limit = (instances × 5) + headroom`).
- **Suggested Validation:** Staging connects via pooler port; `prisma migrate deploy` uses direct URL; connection count stays bounded under load test.

---

# 3. Medium

## M1. Library overdue uses stale module-load `now` — newly-overdue loans invisible until restart

- **Category:** Backend / Correctness
- **Severity:** Medium
- **Location:** `backend/src/services/libraryService.ts:485-491,500-509` (`const now = new Date()` at module scope; reused in `annotateOverdue` and `where.dueDate = { lt: now }`).
- **Current Problem:** After hours/days, newly-overdue loans never annotate OVERDUE and `?status=OVERDUE` misses rows until process restart.
- **Recommended Improvement:** Compute per request.
- **Implementation Guidance:** Move `const now = new Date()` inside `listLoans`/`listMyLoans`.
- **Suggested Validation:** Create loan due 1s out → after 2s, OVERDUE appears without restart.

## M2. `createBorrowRequest` check-then-create allows pending flood

- **Category:** Backend / Concurrency
- **Severity:** Medium
- **Location:** `backend/src/services/libraryService.ts:236-262`; `backend/prisma/schema.prisma:681` (`@@unique([studentId,bookCopyId,status])` only stops same-student dupes).
- **Current Problem:** N students concurrently requesting the same AVAILABLE copy all create PENDING rows (unbounded queue); approval serializes later but queue/noise is unbounded.
- **Recommended Improvement:** Cap pending per copy or serialize creation.
- **Implementation Guidance:** Inside tx: `SELECT ... FOR UPDATE` on copy row, count PENDING for copy, reject beyond cap (e.g. 5) with 409; or document flood acceptance + admin bulk-reject tool.
- **Suggested Validation:** 10 concurrent requests for one copy → bounded PENDING count.

## M3. ISBN empty-string trap defeats unique-null semantics on update

- **Category:** Backend / Data Integrity
- **Severity:** Medium
- **Location:** `backend/src/services/libraryService.ts:99,153`; `backend/prisma/schema.prisma:623` (`isbn @unique`).
- **Current Problem:** `createBook` nulls missing ISBN (correct — multiple NULLs allowed) but `updateBook` stores `""` verbatim; second `""` hits P2002.
- **Recommended Improvement:** Normalize empty → null on update too.
- **Implementation Guidance:** `isbn: data.isbn ? data.isbn : null` (same for publisher/category/description).
- **Suggested Validation:** Update two books with `""` ISBN → both succeed, stored NULL.

## M4. `listBooks` includes unbounded `copies` per book (up to ~50k rows/page)

- **Category:** Backend / Performance
- **Severity:** Medium
- **Location:** `backend/src/services/libraryService.ts:33-46` (`include.copies` no `take`); `addCopies` clamped to 500; pageSize clamp 100.
- **Current Problem:** 100 books × 500 copies = 50k rows + joins per page.
- **Recommended Improvement:** Return counts + paginated copies.
- **Implementation Guidance:** `copies: { take: 10 }` + `_count.copies` + `totalCopies`; separate paginated copies endpoint or `?includeCopies=` param.
- **Suggested Validation:** Response size bounded; catalog page load time flat vs copy count.

## M5. Student dashboards aggregate in memory; admin uses SQL

- **Category:** Backend / Performance
- **Severity:** Medium
- **Location:** `backend/src/services/dashboardService.ts:125-140`, `backend/src/services/studentSummaryService.ts:42-59` (`findMany` all graded + `reduce`) vs admin `aggregate` `:25-46`. Semantics also diverge (admin = SUM/SUM weighted; student = mean of percentages).
- **Current Problem:** Long histories load thousands of rows per dashboard view; slow + memory pressure on most-visited student pages.
- **Recommended Improvement:** Use `aggregate`/`groupBy` for student paths.
- **Implementation Guidance:** Mirror admin path; document chosen metric (weighted vs mean-of-percentages) in code comment.
- **Suggested Validation:** Seeded parity check; query count constant vs history size.

## M6. Announcement/event fan-out loads all recipients + single unbounded `createMany`

- **Category:** Backend / Scalability
- **Severity:** Medium
- **Location:** `backend/src/services/communicationService.ts:56-76,198-218`; `backend/src/services/notificationService.ts:60-72` (`findMany({select:{id}})` no take; one `createMany`).
- **Current Problem:** Whole user table in memory; Postgres param-limit risk at scale; notify failure blocks publish (same tx); deletes leave orphan notifications (`:129-141,269-283`).
- **Recommended Improvement:** Chunked/batched fan-out; outbox later.
- **Implementation Guidance:** Page recipients (`skip/take` 500–1000) with per-chunk `createMany`; on delete, tombstone or cascade-clean notifications referencing the entity; keep tx per chunk.
- **Suggested Validation:** 5k-user fan-out succeeds; delete cleans or explicitly retains with documented policy.

## M7. Attendance: unbounded roster, 200-write tx, wrong audit date, stale `markedBy`

- **Category:** Backend / Performance / Audit
- **Severity:** Medium
- **Location:** `backend/src/services/attendanceService.ts:84-114` (full ACTIVE roster + 3 includes, unpaginated), `:173-248` (up to 200 sequential writes in one tx), `:171,239` (audit uses first record's date though multi-date batches allowed `:176`), `:206-213` (update path never refreshes `markedById/markedAt` unlike `:278-279`).
- **Current Problem:** Big courses dump roster on every date query; long tx risks timeout/deadlock; audit misattributes date/actor.
- **Recommended Improvement:** Paginate roster; batch writes; fix audit.
- **Implementation Guidance:** Separate roster endpoint with pagination (or `_count` + take param); `createMany` + bulk updates; set `markedById/markedAt` on upsert-update; audit per-date or reject multi-date batches.
- **Suggested Validation:** 500-student roster paged; audit date matches each record's date.

## M8. Announcement/event delete RBAC gap + orphan notifications

- **Category:** Authorization / Data Integrity
- **Severity:** Medium
- **Location:** `backend/src/routes/communicationRoutes.ts:14-15,21-22` (delete ADMIN-only), `backend/src/services/communicationService.ts:36,169` (create TEACHER ok), `:123-141,269-283` (no ownership check; notifications referencing deleted ids left behind).
- **Current Problem:** Teachers can never delete own announcements/events (likely oversight); deletes orphan notification rows.
- **Recommended Improvement:** Owner-delete + cleanup policy.
- **Implementation Guidance:** Allow delete when `publishedById/createdById === actorId` or ADMIN; decide: delete child notifications or retain with tombstoned title; document choice.
- **Suggested Validation:** Teacher deletes own → 200; other's → 403; admin → 200; no dangling notification FK errors.

## M9. Only `/login` has the strict limiter; reset/change/import on generous limiter

- **Category:** Security
- **Severity:** Medium
- **Location:** `backend/src/routes/authRoutes.ts:10`, `backend/src/routes/userAdminRoutes.ts:15-16`, `backend/src/middleware/rateLimit.ts:21-32` (apiLimiter 1000/15min covers password change/reset, 5000-row CSV import).
- **Current Problem:** Credential-changing and expensive endpoints share the generous budget — brute-force on reset/change and import-DoS are under-protected.
- **Recommended Improvement:** Apply strict limiter to sensitive/expensive routes.
- **Implementation Guidance:** Mount `authLimiter` (or new `sensitiveLimiter` e.g. 30/15min) on `PUT /auth/password`, `POST /users/:id/reset-password`, `POST /users/import`.
- **Suggested Validation:** 11 rapid resets → 429 JSON envelope; legitimate admin flow unaffected.

## M10. Upload path still buffers full files in RAM (semaphore runs too late); text sniffing is vacuous

- **Category:** Backend / Performance / Security
- **Severity:** Medium
- **Location:** `backend/src/routes/assignmentRoutes.ts:29-41` (`multer.memoryStorage` 20MB), `backend/src/services/fileStorageService.ts:91-119` (semaphore *after* multer consumed RAM; `buffer.toString('base64')` ~2.3×), `:71-72` (`text/plain|csv` magic `() => true`).
- **Current Problem:** First audit lowered limit to 20MB + magic sniffing + semaphore (present and good), but multer buffers before the semaphore engages — parallel 20MB uploads can still exhaust heap; HTML/JS uploaded as text can become stored XSS if ever served inline.
- **Recommended Improvement:** Stream uploads; harden text path.
- **Implementation Guidance:** Switch to disk/streaming upload (`multer.diskStorage` or `upload_stream` to Cloudinary); per-IP upload throttle; serve with `Content-Disposition: attachment`; restrict text to plain-text validation (reject `<html|script` signatures) or document that uploads are never rendered inline; add virus-scan hook point.
- **Suggested Validation:** 5×20MB parallel uploads stay within heap budget; `.html` renamed `.txt` rejected or served as attachment only.

## M11. Audit written outside tx for most sensitive writes; logins not audited

- **Category:** Backend / Auditability
- **Severity:** Medium
- **Location:** `backend/src/services/libraryService.ts:95-123,144-172`, `backend/src/services/courseService.ts:167-192,302-312`, `backend/src/services/assignmentService.ts:216-241`, `backend/src/services/userAdminService.ts:170-177` (row commits, then standalone `writeAuditLog`); grading paths correctly pass `tx`. `authService.login` audits nothing.
- **Current Problem:** Crash between commit and audit = sensitive change with no trail; violates "authorized and auditable". Login success/failure invisible to incident response.
- **Recommended Improvement:** Transactional audit uniform + login audit.
- **Implementation Guidance:** Pass `tx` into `writeAuditLog` (pattern exists in grading/timetable paths) or transactional outbox; add `LOGIN_SUCCESS/LOGIN_FAILURE` audit (email only, never password; rate-limit failure logging to avoid log flood).
- **Suggested Validation:** Forced audit failure rolls back the write; brute-force login leaves failure trail without passwords.

## M12. Password policy length-only; bcrypt cost 10; 72-byte truncation silent

- **Category:** Authentication
- **Severity:** Medium
- **Location:** `backend/src/services/authService.ts:93-99`, `backend/src/services/userAdminService.ts:15,23-27`, `backend/.env.example:28-32`; `bcrypt.hash(pw, 10)` at `authService.ts:101`, `userAdminService.ts:116,330,439`. README advertises `Password123!` (`README.md:83-87`); seed uses it (`seed.ts:29`).
- **Current Problem:** 8-char minimum only; no complexity/breached check; no max length (bcrypt truncates at 72 bytes — 100-char password silently truncates); dev/CSV imports share one known secret; seed + README publish it.
- **Recommended Improvement:** Sensible pilot policy + secret hygiene.
- **Implementation Guidance:** Min 12 (or 8 + complexity), explicit max 72 bytes with error; require `DEFAULT_USER_PASSWORD` even in dev or generate random per-user temp passwords on import; rotate seed passwords; remove real passwords from README (use placeholders).
- **Suggested Validation:** 7-char → 422; 100-char → 422 with clear message; import without env password fails fast or yields unique temps.

## M13. Single-origin CORS + hardcoded Vite proxy limit multi-env deploys

- **Category:** DevOps / Config
- **Severity:** Medium
- **Location:** `backend/src/app.ts:37` (`cors({origin: env.clientUrl})`), `backend/src/config/env.ts:37`, `frontend/vite.config.ts:8-12` (proxy `/api → http://localhost:5000` hardcoded), `backend/.env.example:20`.
- **Current Problem:** Staging + prod + preview URLs need a list; no prod scheme validation; dev can't target remote API via env.
- **Recommended Improvement:** Origin list + env-driven proxy.
- **Implementation Guidance:** `CLIENT_URLS` comma-separated list, validate `https://` in prod; `target: process.env.VITE_API_PROXY ?? 'http://localhost:5000'`; document `VITE_API_URL` vs proxy strategy.
- **Suggested Validation:** Two origins allowed; `http://` CLIENT_URL in prod → boot error.

## M14. No Docker/deploy manifests — no reproducible production artifact

- **Category:** DevOps
- **Severity:** Medium
- **Location:** Repo root (verified: no `Dockerfile*`, `docker-compose*`, `render.yaml`, `fly.toml`, `Procfile`); `backend/package.json:9` (`start: node dist/index.js` assumes prebuilt `dist/` CI builds but never packages); `.github/workflows/ci.yml` has no image build.
- **Current Problem:** No reproducible artifact; "works on my machine" deploys; pilot handoff fragile.
- **Recommended Improvement:** Multi-stage Dockerfiles + CI image build.
- **Implementation Guidance:** `backend/Dockerfile` (node:20-slim, `npm ci`, `prisma generate`, `tsc`, `prisma migrate deploy && node dist/index.js` entry), `frontend/Dockerfile` (build → nginx or static), `.dockerignore`; CI job builds (not necessarily pushes) the image.
- **Suggested Validation:** `docker build` succeeds; image boots with health 200 + DB ok.

## M15. CI never runs integration/migrations/audit

- **Category:** DevOps / Testing
- **Severity:** Medium
- **Location:** `.github/workflows/ci.yml:1-33` (`prisma:generate → typecheck → lint → test:backend → build`; no DB service, no `migrate deploy`, no `prisma validate`, no `npm audit`).
- **Current Problem:** Migration breakage, constraint regressions, and vulnerabilities merge silently; typecheck/lint attribution coarse (root script runs both workspaces).
- **Recommended Improvement:** Harden pipeline.
- **Implementation Guidance:** Add Postgres service + `prisma migrate deploy` + `test:integration`; add `prisma validate` and `npm audit --omit=dev` steps; split frontend/backend typecheck jobs.
- **Suggested Validation:** Broken migration fails CI; `npm audit` high fails (or allowlisted with expiry comment).

## M16. Logs are `console.log` JSON only; stacks + URLs unredacted; no APM

- **Category:** Reliability / Privacy
- **Severity:** Medium
- **Location:** `backend/src/app.ts:45-62` (request logger `{id,method,url,status,durationMs,userId}` — request-id good), `backend/src/middleware/errorHandler.ts:84-93` (full `err.stack` in all envs; `url` may contain PII query strings); no log levels/sampling/retention/tracker.
- **Current Problem:** Stacks in prod logs; PII (emails/search) accumulates in stdout; no error tracker before pilot.
- **Recommended Improvement:** Minimal leveled logger + redaction + Sentry.
- **Implementation Guidance:** pino/winston with levels + PII redaction (query params, emails); keep JSON in prod/pretty in dev; add Sentry (or equivalent) DSN via env; assert no `passwordHash`/temp passwords in logs (extend existing `users.test.ts:223-224` assertion to all audit metadata).
- **Suggested Validation:** Error with email in URL → redacted in log; Sentry captures 500 with request id.

## M17. `useApi` exists but only 1 page uses it — inconsistent fetch/error/retry

- **Category:** Frontend / Code Quality
- **Severity:** Medium
- **Location:** `frontend/src/hooks/useApi.ts:19-52` (abort + getApiError + reload) used only by `EventsPage.tsx:34-36`; all other pages hand-roll (`DashboardPage.tsx:247-252,314-319,409-414`, `CoursesPage.tsx:77-88`, `CourseDetailPage.tsx:178-221`, `QuizDetailPage.tsx:124-147`); several `catch(() => setError('Failed…'))` discard server messages (`DashboardPage`, `TimetablePage:53`, `AnnouncementsPage:38`, `AdminUsersPage:72`, `NotificationsPage:38`); retry via `window.location.reload()` (`DashboardPage:254,321,416`).
- **Current Problem:** Bug surface × N; lost server messages; retry wipes form/quiz state.
- **Recommended Improvement:** Migrate all page loads to `useApi` (or React Query).
- **Implementation Guidance:** Replace per-page `loading/error + useEffect + api.get` with `useApi`; preserve server message via `getApiError`; retry via `reload()` never `location.reload()`.
- **Suggested Validation:** No behavior change; grep for `location.reload()` in pages → 0; server error messages surface on every page.

## M18. `getApiError` drops field/validation errors

- **Category:** Frontend / UX
- **Severity:** Medium
- **Location:** `frontend/src/utils/apiError.ts:3-11` (reads only `response.data.message` string; ignores `errors[]`, `errors:{field:msg}`, `import.errors`).
- **Current Problem:** "Something went wrong" instead of which field failed; forms can't show inline errors; CSV import error detail lost.
- **Recommended Improvement:** Join structured errors.
- **Implementation Guidance:** Extend to join `data.errors` array/object values (cap length ~300 chars); return `{ message, fieldErrors }` variant for forms; render import row errors table (backend already provides per-row detail).
- **Suggested Validation:** 422 with field errors → user sees field list; import failures show row table.

## M19. Notification bell polls every 30s but page list never syncs (split-brain badge)

- **Category:** Frontend / UX
- **Severity:** Medium
- **Location:** `frontend/src/components/Layout.tsx:288-319` (recursive setTimeout 30s → exp-backoff 5min, no abort, silent failure), `frontend/src/pages/NotificationsPage.tsx:33-44,46-74` (loads once `pageSize:50`, no pagination UI, no poll; mark-read updates list only, bell stale).
- **Current Problem:** Badge vs list disagree; constant polling cost; failure backoff never notifies.
- **Recommended Improvement:** Shared notification state.
- **Implementation Guidance:** Lift unread to context or `notifications:changed` event consumed by Layout; invalidate on mark-read; AbortController on poll; consider 60s+ or visibility-only refresh.
- **Suggested Validation:** Mark-all-read → badge 0 immediately; offline poll failure → subtle indicator, recovers on visibility.

## M20. Quiz UX gaps: no progress, bottom-only submit, silent resume, timer a11y, bad >60min format, single-choice builder allows 0/N correct

- **Category:** Frontend / UX / Accessibility
- **Severity:** Medium
- **Location:** `frontend/src/pages/QuizDetailPage.tsx:157-200,485-623,779-791` (resume auto-enters `takingQuiz`; `formatTimer` shows `70:00` for >60min; `role=timer aria-live=off`; `<=60s` color+pulse only; submit bottom-only; teacher SINGLE_CHOICE radios share `name=correct-option` but toggle `isCorrect` independently; student radios can't deselect).
- **Current Problem:** Accidental submits, lost time, invalid quiz content (0 or N correct on single-choice), SR users miss expiry.
- **Recommended Improvement:** Progress + confirm + accessible timer + builder constraint.
- **Implementation Guidance:** Sticky footer with answered-count + ProgressBar + confirm modal listing unanswered; resume confirmation modal; `aria-live=polite` low-time announcement + "Low time" text; `hh:mm:ss` formatter; enforce exactly-1 correct for SINGLE_CHOICE; allow Clear for student radios.
- **Suggested Validation:** Manual quiz run: progress accurate, resume asks, SR announces low time, builder rejects 0/2-correct single-choice.

---

# 4. Low

## L1. Data-fetching `pageSize:100` fetch-alls + pagination shape drift + unused `ApiResponse<T>`

- **Category:** Frontend / API / Performance
- **Severity:** Low
- **Location:** `frontend/src/pages/TimetablePage.tsx:64` (`res.data.data.courses || res.data.data` fallback), `CoursesPage.tsx:81`, `CourseDetailPage.tsx:190,199,208`, `AdminLibraryPage.tsx:84,93,102`, `AdminUsersPage.tsx:68` (all `pageSize:100`, no pagination UI except `LibraryCatalogPage:198-218`); `frontend/src/types/index.ts:99-104` (`ApiResponse<T>` never used; `api.get('/x')` untyped, `err:any`).
- **Current Problem:** Large schools blow up payload/render; type drift undetected; backend envelope inconsistent (`paginated()` → `{data,pagination}` vs `success()` → `{data:{users,pagination}}` e.g. `libraryController.ts:24` vs `userAdminController.ts:20`).
- **Recommended Improvement:** Type calls; normalize envelope; page properly.
- **Implementation Guidance:** `api.get<ApiResponse<…>>` everywhere; backend: always `paginated()` for lists (one envelope per AGENTS.md); replace `100` with paged UI or virtualize.
- **Suggested Validation:** `tsc` catches shape mismatch; large-seed page stays <200KB.

## L2. Forms: `<label>` without `htmlFor`/`id` across 7 pages

- **Category:** Accessibility
- **Severity:** Low
- **Location:** e.g. `frontend/src/pages/CoursesPage.tsx:313,325,335,347`, `CourseDetailPage.tsx:559,570,586,695,716,727`, `QuizDetailPage.tsx:648,658`, `AssignmentDetailPage.tsx:249,259`, `AdminUsersPage.tsx:209,219,229`, `TimetablePage.tsx:145,161,175,185,195`, `SettingsPage.tsx:62,72,85` (shared `labelStyles` encourages it; `AttendancePage:143-151` has the correct pattern — copy it).
- **Current Problem:** SR doesn't associate label; smaller tap target; fails WCAG 1.3.1/3.3.2.
- **Recommended Improvement:** `Field` component enforcing `id`/`htmlFor` (or wrap input in label).
- **Suggested Validation:** axe/eslint-jsx-a11y passes on touched pages; SR reads labels.

## L3. Tabs/Dropdown/Modal/Tooltip/CommandPalette miss keyboard/ARIA semantics; no focus trap or return-focus

- **Category:** Accessibility
- **Severity:** Low
- **Location:** `frontend/src/components/ui.tsx:325-412` (Tabs/SegmentedControl: `role=tablist/tab` but no `tabpanel`, `aria-controls`, arrow-key nav, roving tabIndex), `:800-860` (DropdownMenu trigger `<div onClick>` not focusable, no Enter/Space, no `aria-haspopup/expanded`), `:790-796` (CSS `data-tip` tooltip keyboard/SR invisible), `:731-786` (Modal: Escape + scroll-lock but no Tab trap, no focus restore); `frontend/src/components/Layout.tsx:60-189` (palette: autofocus but no trap/restore, no `aria-activedescendant`, mouse-hover moves cursor).
- **Current Problem:** Keyboard/SR users can't reliably operate menus/tabs/dialogs; focus lost after close.
- **Recommended Improvement:** WAI-APG patterns + small focus-trap hook.
- **Implementation Guidance:** Tabs: arrow keys, `tabIndex 0/-1`, `aria-controls`; Dropdown trigger → real `<button aria-haspopup=menu aria-expanded>` with focus management; tooltips via `aria-describedby`; trap Tab/Shift+Tab in dialog, restore `document.activeElement` on unmount; palette `aria-activedescendant`.
- **Suggested Validation:** Keyboard-only run: open menu → arrows → Esc → focus returns; axe clean.

## L4. Numeric coercion without NaN guard; missing client validation; no pre-upload size check

- **Category:** Frontend / Reliability
- **Severity:** Low
- **Location:** `frontend/src/pages/QuizDetailPage.tsx:228-229,257-259`, `CourseDetailPage.tsx:268,292-294`, `AssignmentDetailPage.tsx:86,260-264` (`Number(...)` unchecked — `Number('')===0`, `Number('abc')===NaN`), `TimetablePage.tsx:71-91` (no `end>start` check; `EventsPage:64-68` already does — reuse), `AssignmentDetailPage.tsx:66-67` (label "max 20MB" but no `accept`/size check before 120s upload), `AdminLibraryPage.tsx:129,302-327` (copies/year posted as raw strings).
- **Current Problem:** Confusing server 400s; oversized uploads hang; invalid slots/grades persisted to server roundtrip.
- **Recommended Improvement:** Parse + validate client-side with inline errors.
- **Implementation Guidance:** Validate `>0`/integer/range, show `fieldErrorStyles`; `file.size <= 20MB` + `accept` before upload; `end > start` check shared with EventsPage.
- **Suggested Validation:** Empty/abc numeric → inline error, no request; 25MB file → instant client rejection.

## L5. Inconsistent archive semantics + API envelope drift

- **Category:** API / Code Quality
- **Severity:** Low
- **Location:** Archive via POST (assignments/quizzes/users/content) vs DELETE (timetable/announcements/events); re-archive success vs 409 (`userAdminService.ts:282`); list envelope `paginated()` vs `success()` (see L1).
- **Current Problem:** Breaks standardized-shape contract (AGENTS.md); per-endpoint client handling.
- **Recommended Improvement:** One envelope, one archive verb + idempotency rule.
- **Implementation Guidance:** Always `paginated()` for lists; archive = `POST .../archive`, idempotent success (or documented 409 everywhere — pick one).
- **Suggested Validation:** Contract test asserting envelope shape across all list endpoints.

## L6. Student roster-name enumeration; `dateOfBirth` retention; no erasure story

- **Category:** Privacy
- **Severity:** Low
- **Location:** `backend/src/services/attendanceService.ts:116-123` (every enrolled student gets full classmate `fullName` roster — emails stripped, names kept) vs `courseService.ts:98-114` (roster stripped for students); `backend/prisma/schema.prisma:93-95` (`dateOfBirth` stored, never surfaced in reviewed services); ARCHIVED retains everything forever, no retention/erasure doc.
- **Current Problem:** Any student enumerates classmates; unnecessary PII retained; no GDPR-style erasure path.
- **Recommended Improvement:** Uniform roster policy + retention doc.
- **Implementation Guidance:** Decide names vs anonymized IDs for students, apply uniformly; justify or drop `dateOfBirth` collection; document retention/erasure for grades/attendance/borrow history/audit logs.
- **Suggested Validation:** As student, roster responses contain no unexpected PII; docs state retention windows.

## L7. Vulnerable transitive deps; `engines` allows EOL Node 18; no frontend lint/test scripts

- **Category:** Dependency Management / DevOps
- **Severity:** Low
- **Location:** `backend/package.json:23-34`, `frontend/package.json`, root `package.json:24-26`; `qs 2.2.5–6.15.3` (via `body-parser` ← `express@4.21.2`), `react-router 6.0.0–7.17.0` (via `react-router-dom@6.28.0`); CI uses Node 20 (`.github/workflows/ci.yml:15`); `frontend/vite.config.ts` proxy; `frontend/package.json:7-12` (no `lint`/`test`); `src/main.tsx:10-18` (StrictMode double-fetch exposes missing aborts).
- **Current Problem:** Known moderate advisories; Node 18 EOL April 2025 still allowed; frontend has no quality gate; dev double-fetch wastes requests.
- **Recommended Improvement:** Patch + pin + gate.
- **Implementation Guidance:** `npm audit fix` (express/qs chain); evaluate `react-router-dom@7`; `engines >=20`; add frontend `lint`/`test` scripts; every effect uses AbortController (copy `useApi` pattern); `VITE_API_PROXY` env override.
- **Suggested Validation:** `npm audit --omit=dev` clean (or allowlisted); CI runs frontend lint; dev double-fetch harmless.

---

# 5. Optional Improvements

## O1. Dashboard re-renders every second for a clock

- **Category:** Frontend / Performance
- **Severity:** Optional
- **Location:** `frontend/src/pages/DashboardPage.tsx:449,458`, `frontend/src/components/motion.tsx:326-332` (`useClock(1000)` → `setNow` re-renders entire dashboard incl. sparklines/animations).
- **Current Problem:** Wasted renders, animation restarts, jank on low-end devices.
- **Recommended Improvement:** Isolate clock to tiny `DashboardClock` (memoized subtrees, 30s tick).
- **Suggested Validation:** React profiler: dashboard subtree renders 1×/30s not 1×/s.

## O2. Role-denied redirects silent + dead outer catch-all route

- **Category:** Frontend / UX
- **Severity:** Optional
- **Location:** `frontend/src/components/ProtectedRoute.tsx:31-33` (`roles` mismatch → silent `<Navigate to=/>`), `frontend/src/App.tsx:48-76` (outer `*` → `/` unreachable; inner `*` → NotFoundPage already matches).
- **Current Problem:** AuthZ failures indistinguishable from success; dead route suggests routing misunderstanding.
- **Recommended Improvement:** `/403` route + `Navigate to=/403 state={{from}}`; dashboard `Banner` when `location.state.forbidden`; remove/fix outer `*`.
- **Suggested Validation:** Student → `/admin/users` shows 403 explanation, not silent dashboard.

## O3. Competing post-login redirect mechanisms (`sessionStorage` value never read)

- **Category:** Frontend / UX
- **Severity:** Optional
- **Location:** `frontend/src/api/client.ts:36-42` (401 stores `sessionStorage.postLoginRedirect`), `frontend/src/components/ProtectedRoute.tsx:27-28` (`?redirect=`), `frontend/src/pages/LoginPage.tsx:108-110,122-128` (reads only `?redirect=`, clears sessionStorage without consuming).
- **Current Problem:** Expired-session background-poll 401 loses destination; two sources of truth diverge.
- **Recommended Improvement:** Single `get/set/clearPostLoginRedirect()` helper; LoginPage prefers `?redirect=` then sessionStorage fallback.
- **Suggested Validation:** Expire mid-page → re-login returns to original page in both flows.

## O4. Duplicate SVG gradient IDs + fragile yellow-pill contrast; `window.confirm`; plaintext admin password field

- **Category:** Frontend / Accessibility / UX
- **Severity:** Optional
- **Location:** `frontend/src/components/motion.tsx:272,281,289-294` (every `Sparkline` renders `id="spark-fill/spark-stroke"` — first def wins when 2+ render); `StatusBadge.tsx:13-17`, `NotificationsPage.tsx:15-22` (yellow-50/yellow-700 ~4.0:1); `TimetablePage.tsx:94`, `AnnouncementsPage.tsx:65`, `EventsPage.tsx:92`, `AdminUsersPage.tsx:108,124` (`window.confirm`); `AdminUsersPage.tsx:243-249` (create password `type=text`); `SettingsPage.tsx:63-93` (no show-toggle/strength/match feedback).
- **Current Problem:** Wrong gradient fills; low-vision struggle; blocking native dialogs inconsistent with app Modal; shoulder-surfing; weak guidance.
- **Recommended Improvement:** `useId()` gradient IDs; darken pills (`yellow-800` + ring); reuse Modal confirm; `PasswordInput` with `new-password` autocomplete + strength meter.
- **Suggested Validation:** Two sparklines render distinct fills; contrast ≥4.5:1; no `window.confirm` in pages.

---

# 6. Recommended Implementation Order

Safest-first: integrity and auth before polish; each step independently testable. (Pairs with H12/M15 — bring integration tests into CI early so later fixes are guarded.)

1. **Stop data destruction (C1)** — Restrict cascades + migration. Unblocks all other work safely.
2. **Session revocation (C2) + password hygiene (M12)** — tokenVersion migration; policy tightening; README/seed secret rotation.
3. **Rate-limit wiring (C3) + sensitive-route limits (M9)** — edge vs authenticated limiters; TRUST_PROXY docs/fail-fast.
4. **Quiz integrity (C4) + score-freeze (H9)** — content freeze after publish/attempts; P2003→409 mapping.
5. **Library races + leaks (H1, H2, M1, M2, M3)** — reject guard, return condition, per-request `now`, pending cap, ISBN normalization.
6. **Timetable race (H3) + file-orphan fix (H4)** — advisory-lock guard + room normalization; deleteFile compensation.
7. **AuthZ gaps (H6, H7, H8) + audit completeness (M11)** — admin override, archive-guard, student-status force, tx-audit + login audit.
8. **Connection pooling (H13) + CORS/proxy (M13)** — pooler/direct split; origin list.
9. **Performance (M4, M5, M6, M7, H5)** — bounded includes, SQL aggregates, chunked fan-out, roster pagination, import hardening.
10. **Upload hardening (M10)** — streaming uploads, attachment disposition, text validation.
11. **Observability + pipeline (M16, M15, H12, M14)** — leveled logs + Sentry; CI with DB + integration + audit; Dockerfiles.
12. **Frontend correctness/UX (H10, H11, M17–M20)** — session revalidation, safe-URL helper, useApi migration, error joining, notification state, quiz UX.
13. **A11y + polish (L2, L3, L4, L1, L5, L6, L7, O1–O4)** — labels, keyboard/focus, validation, envelopes, deps, clocks, redirects, pills.

---

*End of audit — 48 findings (4 Critical, 13 High, 20 Medium, 7 Low, 4 Optional). All locations verified against the current tree; assumptions explicitly labeled inline (e.g. M13 multi-env, M6 at-scale fan-out).*
