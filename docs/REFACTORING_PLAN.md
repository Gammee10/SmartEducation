# SmartEducation — Refactoring Plan (Phase 1 deliverable)

> Analysis-only session. No production code was changed to produce this plan.
> Source of truth is the actual codebase at `https://github.com/Gammee10/SmartEducation`
> (workspace snapshot inspected September 2026), not the README alone.
> Audience: a capable coding agent that will execute the refactoring in a later session
> without having to rediscover the architecture.

AGENTS.md baseline respected: modular monolith, React+Vite+Tailwind, Express+Prisma/PostgreSQL
(Supabase target), Cloudinary uploads, in-app notifications only, soft-delete/archival,
admin-controlled user creation + CSV import, standardized `{success,message,data}` envelope,
shared Prisma client only, validate-before-write, no `.env` commits.

---

## 1. Executive Summary

### Current architectural situation

The system is a coherent **modular monolith** and is in better shape than a typical
student-team codebase:

- Backend (`backend/src`): Express routes → thin controllers → service-per-domain →
  shared Prisma client (`src/prisma/client.ts`). Central error handler
  (`src/middleware/errorHandler.ts`), JWT auth (`src/middleware/auth.ts`), RBAC
  (`src/middleware/rbac.ts`), layered rate limits (`src/middleware/rateLimit.ts`),
  consistent `success/created/paginated` envelope (`src/utils/response.ts`) and typed
  `AppError` hierarchy (`src/utils/errors.ts`). 22 Prisma models, `Restrict` FKs for
  academic history, soft-delete via status flags. 17 unit test files + 1 integration
  suite. Transactions are used in the right high-risk places (grading, quiz submit,
  library approve/return, timetable, user-admin).
- Frontend (`frontend/src`): React 18 + Router 6 + axios + Tailwind. One axios instance
  (`src/api/client.ts`), one `AuthContext`, centralized types (`src/types/index.ts`,
  578 lines), a shared `ui.tsx` design system (861 lines) and `motion.tsx`. Role-aware
  pages for all six modules.

### Major problems discovered (structural, not cosmetic)

1. **Service-to-service coupling through implementation details.**
   `assignmentService.ts:7` and `quizService.ts:6` import
   `{ getCourse as getCourseWithAccess, isAdminRole, adminOverrideMeta }` from
   `courseService.ts`. Course ownership/visibility logic therefore lives in one domain
   but is load-bearing for two others. Changing course access semantics ripples into
   assignments and quizzes. `userAdminService.ts:7` imports
   `{ sanitizeUser, assertPasswordBytes }` from `authService.ts` — same shape of problem.
2. **God services.** `quizService.ts` (1153 lines), `libraryService.ts` (729),
   `assignmentService.ts` (634), `userAdminService.ts` (628), `courseService.ts` (506).
   Each mixes CRUD + authorization + validation + side-effects (audit/notify/upload).
   Quiz is the worst: quiz CRUD + question CRUD + attempt lifecycle + server timing +
   exact-set scoring + answer secrecy + results aggregation in one file.
3. **No validation layer; authorization checked twice in two places.**
   Every service hand-rolls `assertXStatus`, date parsing, email/phone regexes, score
   ranges. Controllers *also* do role pre-checks (e.g.
   `assignmentController.ts:34,98,140` reject non-teacher/non-student before calling the
   service, which re-checks ownership). The two layers can drift; the route file
   (`assignmentRoutes.ts:17-59` multer allowlist + 20 MB limit) duplicates checks done
   again by `fileStorageService.ts` magic-byte sniffing.
4. **Cross-cutting side-effects are inline and inconsistently typed.**
   `writeAuditLog(params, client=prisma)` (`auditService.ts:19`) and
   `createNotification(params, client=prisma)` / `notifyUsers(...)`
   (`notificationService.ts:30,50`) take `client: any`. Three library paths
   (`libraryService.ts:485,534,699`) bypass the helper with raw `tx.auditLog.create`.
   `auditLibraryAction` is exported but never imported. Announcement/event fan-out
   (`communicationService.ts:87,218`) runs chunked `createMany` **inside the request
   transaction** — correct for pilot scale, a timeout risk at larger audiences.
5. **Frontend has no API layer and no data layer.**
   `src/api/` is a single axios instance. All ~40 endpoint strings, all
   `response.data.data.*` unwrapping, all `pageSize: 50|100` params are hardcoded in
   ~15 pages. `hooks/useApi.ts` exists but is used in only ~4 pages; the rest use
   bespoke `useEffect+useState`. Pagination is honored only by `LibraryCatalogPage`;
   every other list fetches one bounded page and filters/sorts **client-side**
   (truncation risk). Business rules are duplicated client-side (email regex in
   `LoginPage`, `SINGLE_CHOICE exactly-1-correct` in `QuizDetailPage`, password-strength
   meter in `SettingsPage`, `canPost=isAdmin||isTeacher` gates) and can drift from the
   server.
6. **God components.** `QuizDetailPage.tsx` (1135 lines), `CourseDetailPage.tsx`
   (1050), `Layout.tsx` (833: sidebar + command palette + breadcrumbs + bell polling
   with backoff + theme + avatar menu). `getInitials`, tile colors, status maps, and
   modal/form boilerplate are copy-pasted across pages.
7. **Test safety net is real but mocked-through.**
   Backend unit tests mock Prisma via `require.cache`, so they protect business rules
   (answer secrecy, attempt limits, conflict detection, audit payloads) but **not**
   actual queries/relations. Only `tests/integration/api.integration.test.ts` hits a
   real DB and it needs `TEST_DATABASE_URL`. Frontend has **zero** tests — only
   `typecheck` + `vite build`.

### Overall refactoring direction

**Incremental modular-monolith hardening. No microservices, no CQRS, no event bus,
no framework swap, no rewrite.**

- Keep: routes → controllers → services → shared Prisma; envelope; auth/RBAC/rate-limit
  middleware; `Restrict` + soft-delete; in-app notifications; Cloudinary path.
- Fix: extract a small backend **shared kernel** (typed tx client, access-policy helper,
  validation schemas, audit/notify consistency); split god services along existing
  transaction boundaries; introduce a thin frontend **API + hooks layer** and decompose
  god pages; make pagination and error details consistent; harden tests with contract +
  integration coverage before touching risky paths.
- Explicitly **not** doing: repositories everywhere, hexagonal/clean-architecture
  ceremony, message queues, Prisma→Drizzle/TypeORM swap, CSS-framework swap.

### Intended outcome

Same behavior, safer evolution: course-access changes touch one helper; quiz/assignment/
library logic can be modified without reading 600–1100-line files; frontend endpoint or
envelope changes touch one module, not 15 pages; auth/audit/notify/upload invariants
stay covered by tests that actually hit the DB shape.

---

## 2. Current System Understanding

### 2.1 Backend map (actual, not README)

```
client → app.ts (helmet, cors, json 2MB, apiLimiter, request-id log, /api/health)
  → routes/* (authenticate + authenticatedLimiter, then requireRole/*, then controller)
  → controllers/* (parsePagination, role pre-check, getIp, success/created/paginated, next(err))
  → services/* (validation + Prisma via shared client + writeAuditLog + notify + upload)
  → PostgreSQL via Prisma; errors → middleware/errorHandler.ts → {success:false,...}
```

| Layer | Files | Responsibility today |
|---|---|---|
| Entry/config | `src/app.ts`, `src/index.ts`, `src/config/env.ts`, `src/prisma/client.ts` | Mount 11 routers (`/api/auth`, `/api/library`, `/api/courses`, rest on `/api`); graceful shutdown; env validation; pooler-vs-direct DB URL |
| Auth/RBAC/limits | `src/middleware/auth.ts`, `rbac.ts`, `rateLimit.ts`, `errorHandler.ts` | JWT HS256 + `tokenVersion` revocation + ACTIVE check; `requireRole(...)`; 4 limiters (api/auth/authenticated/sensitive/upload); Prisma-code → HTTP mapping |
| Utils | `utils/response.ts`, `errors.ts`, `pagination.ts`, `logger.ts`, `url.ts`, `errorTracker.ts` | Envelope; `AppError` family (422 validation, 401/403/404/409); page clamp 1..100; redacted logs; `http(s)` URL guard; optional Sentry |
| Services | 13 files (see sizes §1) | All business logic + Prisma + audit + notify + upload |
| Controllers | 11 files, 45–220 lines | Thin; duplicate some role checks |
| Routes | 11 files | Auth + limiter + role wiring; multer config lives in `assignmentRoutes.ts` |
| Schema | `prisma/schema.prisma` (22 models, 15+ enums) | Users/students/teachers, courses/enrollments/content, assignments/submissions, quizzes/questions/options/attempts/answers, attendance, timetable, announcements/events, notifications, audit, imports, library (books/copies/requests/loans) |
| Tests | `tests/*.test.ts` (17) + `tests/integration/` | Unit with mocked Prisma; integration with supertest + real PG |

Route mounting quirk to preserve: `app.ts:86-96` mounts `auth`/`library`/`courses` on
prefixed routers and everything else (`assignmentRoutes`, `quizRoutes`,
`attendanceRoutes`, `timetableRoutes`, `dashboardRoutes`, `notificationRoutes`,
`communicationRoutes`, `userAdminRoutes`) directly on `/api`. Do not "tidy" this into
different public paths — it would break the frontend's hardcoded strings.

### 2.2 Data & control flow (representative, verified)

**Auth:** `POST /api/auth/login` (public + `authLimiter`) → `authController` (manual
empty check → 422) → `authService.login` (normalize email, `bcrypt.compare`,
`writeAuditLog LOGIN_SUCCESS/FAILURE` best-effort, `signToken(sub,tv)`) →
`{token,user:sanitizeUser}`. Every protected request → `authenticate` (Bearer parse,
HS256 verify, `prisma.user.findUnique` with student/teacher select, ACTIVE +
`tokenVersion` match) → `req.user` → `requireRole(...)` → service re-checks ownership.

**Assignment submit→grade:** student `POST /assignments/:id/submit`
(`requireStudent` + `uploadLimiter` + `multer.single('file')`) → controller maps
`req.file→{path,buffer,mimetype,size}` → `submitAssignment` (course-access via
`courseService.getCourse`, enrollment ACTIVE, `PUBLISHED` on `ACTIVE` course,
unique `(assignmentId,studentId)`, `uploadFile→Cloudinary` + `deleteFile` compensation
on DB failure) → teacher `POST /submissions/:id/grade` → `$transaction`: update +
`writeAuditLog(tx)` + `createNotification(tx, type GRADE)`.

**Quiz attempt:** `POST /quizzes/:id/attempt` (`requireStudent`) → `startAttempt`
(reuse `IN_PROGRESS`, flip expired→`TIME_EXPIRED` via guarded `updateMany`, enforce
`maxAttempts`) → `POST /attempts/:id/submit` → `$transaction` claim
`updateMany(status=IN_PROGRESS)` + `createMany(answers)` + scoring (exact-set, options
filtered to question set, deduped) + audit + `QUIZ_RESULT` notification. Students never
receive `isCorrect`; `assertQuizContentMutable` freezes questions once published or
attempted.

**Attendance:** `POST /attendance/upsert` (`requireTeacher`, ≤200 rows, same course) →
`$transaction`: new rows one `createMany`, changed rows grouped by `(status,comment)`
into `updateMany`s, re-read (counts-only return). `PUT /attendance/:id` correction →
audit with before/after. Reads role-filtered; students get names, not emails.

**Announce/event fan-out:** `POST /announcements|/events` (`TEACHER,ADMIN`) → tx:
create row + `notifyUsers(userIds chunked 500, createMany)` + audit. Reads
server-side audience-filtered (`ALL/TEACHERS/STUDENTS`). Delete retains notifications
as history.

**Library:** student `POST /library/requests` → admin `POST /requests/:id/decide` →
tx: `SELECT FOR UPDATE`-style atomic `updateMany(status=AVAILABLE)` copy claim (cap
`MAX_PENDING_PER_COPY=5`) + `Loan` + audit (raw `tx.auditLog.create`, not helper) →
admin `POST /loans/:id/return` (condition `AVAILABLE/DAMAGED/LOST`). Overdue derived at
read (`ACTIVE` + past due).

**Course/content:** teacher `POST /courses` → admin enroll/unenroll (`requireAdmin`) →
teacher URL-based content upload (no direct binary upload; only assignment submissions
hit Cloudinary) → archive flags. `getCourse` doubles as the access oracle imported by
assignment/quiz services.

**User admin:** `requireAdmin` router-wide; create/update/archive/reset-password/CVS
import (5000-row cap, 4-concurrency, `ImportBatch`/`ImportError` rows). Guards: no
self-archive/suspend, no last-active-admin removal, `tokenVersion` bump on
archive/suspend/reset. CSV parsed by hand-rolled quoted-comma parser.

**Dashboards/summary:** `dashboardService.ts` (156) + `studentSummaryService.ts` (91):
admin aggregates (counts + attendance rate + SQL `AVG(score)` + weighted quiz
`SUM(score)/SUM(maxScore)`), teacher (owned courses + recent 5 submissions/grades),
student (enrollments + rates), summary (profile + recent 5 attempts). No cross-service
imports — the cleanest seam in the backend.

**Timetable:** all writes `requireAdmin`, transactional (advisory `pg_advisory_xact_lock`
per room-day + teacher-day → `checkConflicts` in-memory overlap → create/update/delete
+ audit). Room normalized (`trim/collapse/lower`); `room=null` skips room check by design.

### 2.3 Frontend map (actual)

```
main.tsx (StrictMode→ErrorBoundary→BrowserRouter→AuthProvider→App)
App.tsx (public /login; authed Layout; nested ProtectedRoute roles for admin/users, library/*)
Layout (nav, bell polling GET /notifications/unread-count, backoff, notificationBus)
pages/* (inline api.get/post/put/delete + useState + Banner/ErrorState)
context/AuthContext (localStorage token+user, refreshUser on mount, auth:unauthorized listener)
api/client.ts (baseURL /api, 15s timeout, JWT attach, 401 soft-logout, no refresh/refresh-token)
types/index.ts + per-page local interfaces; hooks/useApi (used 4×); utils/apiError, safeUrl, notificationBus
```

Only `LibraryCatalogPage` consumes `response.data.pagination` properly (debounced,
`AbortController`, 20/page). All other lists do `GET ?pageSize=50|100` once and filter
client-side. `AssignmentDetailPage` is the only caller overriding timeout (120 s upload).
`AdminUsersPage` POSTs CSV as JSON `{csv,filename}` (not multipart) — backend contract
to preserve.

### 2.4 Integration points

- Supabase/Postgres via `DATABASE_URL` (pooler) fallback `DIRECT_URL`; seed uses direct.
- Cloudinary via `fileStorageService` (only assignment submissions upload binaries).
- No push/SMTP/S3/Redis/Kafka. Notifications are DB rows; bell polls every 30 s.
- `nginx.conf` proxies `/api/` → `backend:5000`; Vite dev proxies `/api` →
  `VITE_API_PROXY ?? localhost:5000`. Frontend has no `VITE_*` API base — relies on
  same-origin `/api`.

```
                    ┌─────────────┐
                    │   React SPA │
                    │ pages→axios │
                    └──────┬──────┘
                           │ /api (same-origin; Vite/ nginx proxy)
                    ┌──────▼──────┐   ┌────────────┐
                    │ Express API │──▶│ PostgreSQL │
                    │ routes→ctl  │   │  (Prisma)  │
                    │ →services   │──▶│ Cloudinary │ (assignment files only)
                    └─────────────┘   └────────────┘
```

---

## 3. Problems and Findings

> Only structural issues included. Cosmetic nits (naming, comment style) omitted.
> Each item: location → why it matters → consequence. Intentional design called out.

### P1. Service-to-service import of implementation details (harmful)

- **What:** `services/assignmentService.ts:7` and `services/quizService.ts:6`:
  `import { getCourse as getCourseWithAccess, isAdminRole, adminOverrideMeta } from './courseService'`;
  `services/userAdminService.ts:7`: `import { sanitizeUser, assertPasswordBytes } from './authService'`.
- **Why harmful:** course visibility/ownership is a cross-domain policy, but it is
  owned by `courseService` and consumed via its concrete functions. Any change to
  `getCourse` include-shape, admin-override semantics, or teacher-lookup becomes a
  silent contract change for grading and quiz attempts. Same for password/sanitize
  helpers owned by auth.
- **Consequence:** ripple edits; circular-import risk grows as more domains need
  "is this user allowed in this course"; unit tests must mock whole `courseService`.

### P2. God services (harmful at quiz/library/user-admin scale)

- **What:** `quizService.ts` 1153 lines (quiz CRUD + questions + attempts + scoring +
  secrecy + results); `libraryService.ts` 729 (catalog + requests + loans + overdue
  derivation); `userAdminService.ts` 628 (CRUD + archive guards + reset + CSV import);
  `assignmentService.ts` 634; `courseService.ts` 506.
- **Why harmful:** unrelated reasons-to-change share a file and often a transaction
  scope; reviewers must load full context for a one-line scoring fix; tests mock one
  giant module.
- **Consequence:** slow, risky changes to timing/scoring/grading; merge conflicts by
  feature-ownership (team uses per-member branches).

### P3. Missing validation layer; dual authorization (harmful)

- **What:** per-service `assertCourseStatus/assertContentType/assertDay/toMin/
  assertValidDate`, email/phone regexes, score clamps; controllers repeat role gates
  (`assignmentController.ts:34,98,140`); routes repeat file gates
  (`assignmentRoutes.ts:17-59`); `parsePagination(req.query)` spread at every list
  controller; no `zod`/`yup`/central DTOs (verified: grep finds no
  `zod|celebrate|express-validator` in `src/`).
- **Why harmful:** same rule in 2–3 places drifts (MIME allowlist vs magic bytes;
  `status: string` frontend vs enum backend); error `details` shape varies; every new
  endpoint re-invents clamping.
- **Consequence:** validation bypass or confusing 500-vs-422 surface; frontend
  `getFieldErrors` exists but is never used because backend field errors are
  inconsistent.

### P4. Untyped cross-cutting clients; inconsistent audit path (harmful)

- **What:** `auditService.writeAuditLog(params, client: {auditLog:{create...}} = prisma)`,
  `notificationService.createNotification/notifyUsers(params, client: any = prisma)`;
  library uses raw `tx.auditLog.create` at 3 sites; `auditLibraryAction` dead export.
- **Why harmful:** `any` tx client defeats refactor safety; two audit spellings mean a
  future "add actor IP to every audit" misses library paths.
- **Consequence:** silent audit gaps; notification-in-tx vs outside-tx semantics unclear.

### P5. Fan-out inside request transaction (retain, but bound)

- **What:** `communicationService.ts:87,218` — announcement/event create + chunked
  `notifyUsers(createMany)` + audit in one `$transaction`.
- **Verdict:** legitimate for pilot (atomic publish-or-nothing), but a hidden
  scalability coupling: publish latency/failure couples to audience size. Do not
  extract to a queue now; do chunk + bound + document, add outbox later only if needed.

### P6. `Record<string,unknown>` Prisma `where` + `any` tx (harmful, small)

- **What:** `courseService.ts:11-12` `CourseWhereInput = Record<string,unknown>`,
  same pattern elsewhere; `$transaction(async (tx: any) => ...)`.
- **Why harmful:** throws away Prisma's generated types at exactly the seam most
  likely to break during refactoring.
- **Consequence:** typo'd field passes typecheck, fails at runtime.

### P7. Frontend: no API/domain layer; envelope coupled per-page (harmful)

- **What:** `frontend/src/api/client.ts` is transport only. ~40 hardcoded paths and
  `response.data.data.<key>` / `response.data.pagination` unwraps across 15 pages;
  `response.data.data` is `any` in practice.
- **Consequence:** renaming a backend key/route breaks N pages with no compiler help;
  adding auth headers/retry/pagination touches every page.

### P8. Frontend: inconsistent data-fetching; pagination ignored (harmful)

- **What:** `useApi` (abort + loading/error + reload) used ~4×; 12+ lists hand-roll
  `useEffect`; only catalog honors server pagination; others `pageSize=50|100` +
  client filter/sort/group (`CoursesPage:120-136`, `TimetablePage:248`,
  `StudentProfilePage:384,407`, `DashboardPage:136`).
- **Consequence:** silent truncation past 50/100 rows; divergent loading/error UX;
  `AbortController` leaks in some pages.

### P9. Frontend: duplicated business rules + type drift (harmful)

- **What:** email regex (`LoginPage:123`), quiz single-choice rule
  (`QuizDetailPage:282`), password meter (`SettingsPage`), `canPost`/`isTeacher`
  gates mirror `middleware/rbac.ts` + service checks; local `CourseForm.status: string`,
  `DayOfWeek` omits weekends, `Book.copies` string compare.
- **Consequence:** UI allows what server rejects (or hides what server allows, e.g.
  `library/my-borrowing` STUDENT-only route vs `/mine` API).

### P10. Frontend god components + duplicated primitives (moderate)

- **What:** `QuizDetailPage` 1135, `CourseDetailPage` 1050, `Layout` 833, `ui.tsx` 861;
  `getInitials` copied in 3 pages + `Avatar` in `ui.tsx:182`; `StatCard` vs
  `CountStatCard/RingStatCard`; `STATUS_META` vs `StatusBadge` vs notification
  `typeStyles`.
- **Consequence:** same visual/logic fix in multiple places; slow onboarding.

### Intentional design to RETAIN (not problems)

- Modular monolith; shared Prisma client ban on `new PrismaClient` in `src/`
  (seed exception is by design).
- `Restrict` FKs + soft-delete/archival instead of hard deletes for academic history.
- Server-side RBAC + ownership + quiz secrecy/timing/attempt limits; audience filtering
  server-side; `tokenVersion` session revocation; bcrypt 72-byte guard.
- Standard envelope + central error mapping (Prisma P2002/P2025/P2003, JWT, Multer).
- Transactional grading/submit/approve/return/timetable writes with audit+notify inside.
- In-app notifications only; polling bell (no websocket/push infra for pilot).

---

## 4. Refactoring Goals

1. **Single ownership for course-access policy** — one helper, three consumers, no
   `courseService` internals leaking into assignment/quiz. (Addresses P1.)
2. **Services sized to one reason-to-change** — split quiz, library, user-admin,
   course along existing transaction boundaries; no file > ~400 lines excl. comments.
   (P2.)
3. **One validation seam per boundary** — schema-validated DTOs at controller entry;
   services assume valid input; file gates defined once. (P3.)
4. **Typed, consistent side-effects** — one audit path, one notify path, typed tx
   client, no `any`, no raw `tx.auditLog.create`. (P4, P6.)
5. **Frontend contract isolation** — per-domain API modules + hooks own paths and
   unwrapping; pages own rendering. Server pagination honored everywhere. (P7, P8.)
6. **No duplicated business rules across the wire** — frontend mirrors only for UX
   affordance; server remains sole enforcer; shared types generated/aligned. (P9.)
7. **Testability without behavior change** — characterization + contract + integration
   coverage on auth/quiz/grading/attendance/library/import before structural moves.
   (Supports all.)

Non-goals: microservices, CQRS/ES, event bus/queue, ORM swap, UI redesign, new features,
push notifications, public registration.

---

## 5. Proposed Target Architecture

Keep the modular monolith. Add a thin **shared kernel** backend and a thin
**API/hooks layer** frontend. Dependency rule: **domains → kernel; never domain →
domain internals; frontend pages → api/hooks → transport.**

```
Backend (target)
  routes/* ──▶ controllers/* (validate DTO → call service, no role logic beyond wiring)
      │
      ▼
  services/<domain>/* (pure domain logic, typed TxClient, no cross-domain imports)
      │  uses
      ▼
  shared/kernel/* (accessPolicy, validation schemas, audit, notify, storage, pagination, errors)
      │  uses
      ▼
  prisma/client (sole PrismaClient) → PostgreSQL / Cloudinary (via storage port)

  Domains: auth, users(admin), courses(+enrollment,content), assignments(+submissions,grading),
           quizzes(+questions,attempts,scoring), library(catalog,borrowing), attendance,
           timetable, communication, notifications, dashboards
```

- **Boundaries:** each domain owns its routes/controller/services/tests; shares only
  kernel. `courses/accessPolicy` (or `shared/accessPolicy`) owns
  `canAccessCourse({courseId,role,userId})`, `requireCourseRole(...)`,
  `isAdminRole/adminOverrideMeta` — replacing direct `courseService` imports.
- **Responsibilities:** controllers = HTTP (parse/validate/status/shape); services =
  policy + persistence + side-effects; kernel = reusable policy/validation/IO.
- **Dependency direction:** routes→controllers→services→kernel→prisma. No
  assignment→course-service, quiz→course-service, userAdmin→auth-service internals.
  `sanitizeUser/assertPasswordBytes` move to `shared/` (or stay in auth but re-exported
  via kernel — preferred: `shared/password.ts`, `shared/sanitize.ts`).
- **Communication:** synchronous in-process calls + Prisma `$transaction` with typed
  `TxClient`. Notifications/audit stay inline (same tx) for pilot; fan-out stays
  chunked `createMany` with documented row/time budget, not a queue.
- **What stays shared:** Prisma client, envelope/errors/pagination, auth/RBAC/limits
  middleware, logger, audit/notify writers, storage port, access policy, DTO schemas.
- **What becomes isolated:** quiz attempt/scoring vs quiz CRUD; library catalog vs
  borrowing; user CRUD vs CSV import; course CRUD vs enrollment vs content; dashboard
  aggregation vs student summary (already separate — keep).
- **Trade-offs:** one more `shared/` layer to learn (small, pays off at P1/P3/P4);
  file splits create more imports (mitigated by barrel-free explicit imports and
  co-located tests); no runtime abstraction (no DI container, no repository
  interface-per-model — Prisma *is* the persistence seam; repositories added only where
  queries are genuinely complex/reused, e.g. course-access + dashboard aggregates).

```
Frontend (target)
  pages/* (render + local UI state only)
    │ uses
    ▼
  api/<domain>.ts (paths, params, unwrap envelope, pagination) + hooks/use<Domain>.ts
    │ uses
    ▼
  api/client.ts (transport, auth attach, 401 handling) + types/index.ts (aligned)
  shared components/* (Layout split, ui, StatusBadge, Avatar, Empty/Error/Loading)
```

- Type flow: backend DTO schemas are the contract; frontend `types/index.ts` aligned
  manually (no codegen infra for pilot) with a contract test locking envelope keys.

---

## 6. Refactoring Strategy

> Incremental, behavior-preserving. Each stage is independently reviewable and
> shippable. Do not batch stages. Run backend unit + integration and frontend
> `typecheck` + `build` after every stage.

### Stage 0 — Baseline & characterization (safety first)

- **Objective:** lock current behavior before structural moves.
- **Affected:** `backend/tests/`, docs.
- **Changes:** record `npm run test:backend` + `typecheck` + `build` baselines; add
  characterization tests for: quiz answer secrecy (student payload has no `isCorrect`),
  attempt-limit/expiry enforcement, grading tx emits `GRADE` + audit, attendance
  correction audit before/after, announcement fan-out count, library atomic copy claim,
  CSV import per-row errors, `tokenVersion` revocation. Add API contract test asserting
  `{success,message,data}` (+`pagination` where listed) for one endpoint per domain.
- **Verification:** full suite green; integration suite runs where `TEST_DATABASE_URL`
  available, else documented skip.
- **Done when:** new tests fail if any invariant in §8 is broken; baselines recorded.

### Stage 1 — Backend shared kernel (no domain logic change)

- **Objective:** create `backend/src/shared/` (or `common/`) without changing behavior.
- **Affected:** new `shared/tx.ts` (typed `TxClient = Omit<PrismaClient,...>`-style tx
  type), `shared/accessPolicy.ts` (moved `isAdminRole/adminOverrideMeta` +
  course-membership checks extracted verbatim from `courseService.getCourse`),
  `shared/password.ts` + `shared/sanitize.ts` (moved from `authService`),
  `shared/validation.ts` (central `assertValidDate`, email/phone regexes, score clamps),
  `shared/pagination.ts` re-export, audit/notify wrappers typed on `TxClient`.
- **Changes:** move code verbatim; keep old exports as deprecated re-exports; replace
  `client: any` with `TxClient`; route library's 3 raw `tx.auditLog.create` through
  `writeAuditLog(tx)`; delete dead `auditLibraryAction` or re-export via kernel.
- **Considerations:** do not change semantics; keep `getCourse` include-shape identical.
- **Verification:** unit tests untouched and green; `tsc --noEmit` clean.
- **Done when:** no `any` tx client in `services/`; single audit spelling; old imports
  still work via re-export.

### Stage 2 — Break domain→domain imports

- **Objective:** domains depend on kernel, not each other.
- **Affected:** `assignmentService`, `quizService`, `userAdminService`, `courseService`,
  `authService`.
- **Changes:** assignment/quiz call `accessPolicy.requireCourseAccess(...)` instead of
  `courseService.getCourse`; user-admin imports password/sanitize from kernel;
  `courseService` keeps `getCourse` for its own routes only. Remove
  `isAdminRole/adminOverrideMeta` exports from `courseService` (re-export shim for one
  stage, then delete).
- **Verification:** targeted unit tests for teacher/admin/student course access matrix;
  assignment/quiz tests unchanged in outcome.
- **Done when:** grep `from './courseService'` and `from './authService'` returns zero
  hits in `services/` (except kernel re-exports, then zero).

### Stage 3 — Split god services (pure file moves + local imports)

- **Objective:** one reason-to-change per file, same exports.
- **Affected:**
  - `quizService.ts` → `quizzes/quizCrud.ts`, `quizzes/questionService.ts`,
    `quizzes/attemptService.ts`, `quizzes/scoring.ts`, `quizzes/quizAccess.ts`
    (or flatter `quizCrudService/quizQuestionService/quizAttemptService/quizScoring`).
  - `libraryService.ts` → `library/catalogService.ts`, `library/borrowingService.ts`.
  - `userAdminService.ts` → `users/userCrudService.ts`, `users/userImportService.ts`
    (CSV parser + row validator isolated).
  - `courseService.ts` → `courses/courseCrud.ts`, `courses/enrollmentService.ts`,
    `courses/contentService.ts` (+ access stays in kernel).
  - `assignmentService.ts` → `assignments/assignmentCrud.ts`,
    `assignments/submissionService.ts`, `assignments/gradingService.ts`.
- **Changes:** move functions verbatim; keep barrel `quizService.ts` etc. re-exporting
  for one stage so controllers/tests don't churn; then point controllers at new paths.
- **Verification:** unit suites per new file; no behavior diff (contract tests green).
- **Done when:** no service file > ~400 lines; controllers import leaf modules; old
  barrels removed.

### Stage 4 — One validation seam (DTO schemas at entry)

- **Objective:** controllers validate once; services trust input.
- **Affected:** `controllers/*`, `routes/*`, new `shared/dto/*.ts` (or per-domain
  `dto.ts`).
- **Changes:** introduce `zod` (needs AGENTS.md "clear reason": replaces ~15 hand
  asserts + inconsistent 422 details; smallest dependency that fixes P3) **or**
  centralize hand-rolled asserts into typed `parseXDto()` helpers if adding a dep is
  rejected — either way, controllers call `parseX(req)` then service; remove role
  pre-checks from controllers where service/kernel already enforces (keep route-level
  `requireRole` wiring as the HTTP gate). Unify file gates: single
  `shared/filePolicy.ts` (MIME + size) consumed by route + `fileStorageService`.
- **Verification:** 422 matrix tests (bad status/date/email/score/filetype); frontend
  `getFieldErrors` wired to `details` shape.
- **Done when:** no `assertXStatus`/regex literals outside `shared/`+`dto`; controller
  role pre-checks gone except documented defense-in-depth cases.

### Stage 5 — Frontend API + hooks layer

- **Objective:** isolate backend contract.
- **Affected:** new `frontend/src/api/{auth,courses,assignments,quizzes,attendance,
  timetable,library,communication,notifications,users,dashboards}.ts` +
  `hooks/use<Domain>.ts`; pages become callers.
- **Changes:** move each hardcoded path + `response.data.data` unwrap + pagination
  handling into api modules returning typed `ApiResponse<T>`; migrate lists to
  `useApi`/domain hooks with abort + reload; honor server pagination everywhere
  (replace `pageSize=100` + client filter with paged fetch where backend already
  supports it — courses, library, notifications, users, announcements/events).
- **Verification:** `typecheck` + `build`; manual smoke per page; no endpoint string
  remains in `pages/` (grep gate).
- **Done when:** `pages/` contains zero `/api` literals and zero `response.data.data`
  unwraps; pagination UI on all server-paged lists.

### Stage 6 — Frontend decomposition + rule alignment

- **Objective:** kill god components and duplicated rules.
- **Affected:** `QuizDetailPage`, `CourseDetailPage`, `Layout`, `AdminLibraryPage`,
  `ui.tsx`, `types/index.ts`.
- **Changes:** split quiz page (take-flow vs teacher-edit vs results), course page
  (content/assignment/quiz sections as components), Layout (Sidebar/CommandPalette/
  Breadcrumbs/NotificationBell/UserMenu); dedupe `Avatar/getInitials`, `StatCard`
  variants, status maps into `components/`; align local interfaces to shared types
  (`status: CourseStatus`, full `DayOfWeek`); keep client-side mirrors as UX-only with
  comments pointing at server enforcer.
- **Verification:** visual smoke + route-role matrix (esp. `library/my-borrowing`,
  `admin/*`, `403`); no logic change (server still sole enforcer).
- **Done when:** no page > ~400 lines; single `Avatar`, single status map; types drift
  items closed.

### Stage 7 — Test hardening & cleanup

- **Objective:** make the net trustworthy, remove shims.
- **Affected:** `backend/tests/`, frontend (add minimal `vitest` + component/contract
  tests for api layer + auth flow), `prisma/seed.ts`, docs.
- **Changes:** replace `require.cache` Prisma mocks with narrower per-module stubs or
  `prisma.$transaction` harness where valuable; expand integration coverage (grading,
  quiz lifecycle, library borrow/return, CSV import, timetable conflicts) to run in CI
  with ephemeral PG; remove deprecated re-exports/barrels; update
  `docs/FINAL_ARCHITECTURE.md` deltas.
- **Verification:** `test:backend` + `test:integration` (with DB) + frontend
  `vitest` + `typecheck` + `build` all green in CI.
- **Done when:** coverage protects every §8 invariant with at least one non-mocked test.

---

## 7. Dependency and Coupling Changes

### D1. Assignment/Quiz → Course internals (backend, harmful → removed)

**Current:**

```
assignmentService ──imports──▶ courseService.getCourse/isAdminRole/adminOverrideMeta ──▶ prisma
quizService ────────imports──▶ courseService.getCourse/isAdminRole/adminOverrideMeta ──▶ prisma
```

Changing course visibility (e.g. student roster privacy in `courseService.ts:112-130`)
silently changes grading and attempt authorization.

**Target:**

```
assignmentService ──▶ shared/accessPolicy.requireCourseAccess ──▶ prisma
quizService ────────▶ shared/accessPolicy.requireCourseAccess ──▶ prisma
courseService ──────▶ shared/accessPolicy.requireCourseAccess ──▶ prisma
```

`accessPolicy` owns membership resolution (teacher lookup, student enrollment ACTIVE,
admin override + audit meta). `courseService.getCourse` keeps only its read shape.

### D2. UserAdmin → Auth internals (backend, harmful → removed)

**Current:** `userAdminService ──imports──▶ authService.sanitizeUser/assertPasswordBytes`

**Target:** `userAdminService ──▶ shared/password + shared/sanitize ◀── authService`
Both domains consume the kernel; auth no longer "owns" a helper others load-bear.

### D3. Dual authorization controller↔service (backend, reduce)

**Current:** `assignmentRoutes(requireStudent) → assignmentController(if role!==STUDENT 403)
→ assignmentService(check enrollment + status)` — three gates, two hand-written.

**Target:** `routes(requireRole wiring, HTTP gate) → controller(validate DTO only) →
service/kernel(policy enforcement)`. Controllers lose `ForbiddenError` pre-checks except
where explicitly documented (e.g. early affordance); services/kernel are the single
enforcer. Same for quiz/library/attendance/timetable.

### D4. Audit/notify inline `any` (backend, typed, single spelling)

**Current:** each service `writeAuditLog(params, tx?: any)` /
`createNotification(params, tx?: any)`; library sometimes raw `tx.auditLog.create`.

**Target:** `services ──▶ shared/audit.writeAuditLog(params, tx: TxClient)` and
`shared/notify.{createNotification,notifyUsers}(params, tx: TxClient)` — one spelling,
typed client, no `any`. Fan-out stays inline-chunked (pilot) with documented budget.

### D5. Frontend pages → raw backend (harmful → isolated)

**Current:** `15 pages ──hardcoded──▶ axios(/api/..., response.data.data.*)`
(each page coupled to route strings + envelope keys + pagination params).

**Target:** `pages ──▶ api/<domain>.ts + hooks/use<Domain>.ts ──▶ api/client.ts ──▶ backend`.
Endpoint rename or envelope-key change touches one api module + types, not 15 pages.

### D6. Frontend duplicated rules (reduce to UX-only mirrors)

**Current:** `LoginPage email regex ⟷ backend normalize/validate`;
`QuizDetailPage single-choice rule ⟷ quizService validation`;
`SettingsPage meter ⟷ authService 8-char/72-byte`; `canPost/isTeacher ⟷ rbac.ts + services`.

**Target:** server remains sole enforcer; client mirrors only disable/hide affordances
and link to the server rule in comments. No client-side "validation" blocks a request
the server would accept.

### Couplings intentionally RETAINED

- Services → shared Prisma client (AGENTS.md rule; do not add per-model repositories
  except where queries are reused/complex).
- Transactional audit+notify inside grading/submit/approve/return/timetable/announce
  writes (atomicity > purity for pilot).
- Polling bell (no websocket/push).
- `Restrict` FKs + status-flag soft-delete (no hard deletes of history).
- Route-mount shape in `app.ts:86-96` and CSV-as-JSON import contract (frontend compat).

---

## 8. Risk Analysis

| # | Risk | Where | Mitigation |
|---|---|---|---|
| R1 | Auth regression (lockout / privilege escalation) | `auth.ts`, `rbac.ts`, `authService`, `userAdminService` guards, `tokenVersion` | Stage 0 characterization (revocation, last-admin, self-archive); keep middleware untouched until Stage 2; run auth + users suites + integration login/RBAC matrix every stage; never change JWT claims/claims-checks and `requireRole` wiring in the same stage as file moves |
| R2 | Quiz secrecy/timing/scoring regression (answer leak, wrong grades) | `quizService` split | Freeze `sanitize-for-student`, exact-set scoring, `TIME_EXPIRED` flip, `maxAttempts` claim behind characterization tests before Stage 3; split verbatim first, optimize later; review diffs as pure moves (`git diff --find-renames`) |
| R3 | Grading/attendance audit loss | grading tx, `correctAttendance`, library raw-audit paths | Single-spelling audit migration (Stage 1) covered by audit-payload tests; keep `writeAuditLog` inside same tx; verify before/after snapshots preserved |
| R4 | Notification fan-out timeout / partial publish | `communicationService` chunked `createMany` in tx | Do not change tx semantics in Stages 1–3; add row-count/time budget log + documented limit; add test with multi-chunk audience; defer outbox/queue (non-goal) |
| R5 | Orphan Cloudinary files / failed-submit leaks | `submitAssignment` upload→DB + `deleteFile` compensation; multer disk tmp | Keep upload-then-create + compensation order; single `filePolicy`; add failure-injection test (DB throw → `deleteFile` called, tmp cleaned); preserve 20 MB + allowlist behavior |
| R6 | Pagination behavior change breaks UI (truncation ↔ flood) | lists ignoring pagination today | Stage 5 migrates one domain at a time, preserving current visible row counts as initial `pageSize`; add contract tests for `pagination{page,pageSize,total,totalPages}`; verify `LibraryCatalog` (only correct consumer) unchanged |
| R7 | Frontend route-role vs API-role drift widens | `App.tsx` `roles=[ADMIN]/[STUDENT]` vs service checks | Document matrix (route gate = affordance, service = enforcer); Stage 6 smoke tests `library/my-borrowing` as admin/teacher, `admin/*` as teacher/student → expect `403` page without API privilege change |
| R8 | Hidden coupling via `getCourse` include-shape | D1 extraction | Lock `getCourse` response shape with contract test before Stage 2; `accessPolicy` returns minimal `{course, membership}` not full include; services select what they need |
| R9 | Mocked-Prisma tests hide query breakage | all `tests/*.test.ts` | Stage 0/7 integration coverage on grading, quiz lifecycle, borrow/return, import, timetable conflicts against real PG (`TEST_DATABASE_URL`); treat unit-green + integration-skip as yellow, not green |
| R10 | Migration/seed confusion (pooler vs direct) | `prisma/client.ts` vs `seed.ts` direct client | No change to connection logic; document pooler/direct split; integration helper truncates (never `migrate reset` on shared DB) |
| R11 | Scope creep into rewrite/redesign | all stages | Definition-of-done gate (§12): behavior-preserving diffs, no new features, no dep without "clear reason" note, file-size budgets as guides not gods |

---

## 9. Testing and Verification Strategy

### Existing tests to run (every stage)

- `npm run test:backend` — 17 files: `auth, users, course, assignment, quiz, library,
  attendance, timetable, communication, notifications, dashboard, audit, rbac,
  errorHandler, helpers, logger, fileStorage`. Treat as business-rule net (mocked Prisma).
- `npm run test:integration` (needs `TEST_DATABASE_URL`, default
  `localhost:5434/ses_test`) — `api.integration.test.ts` (login, quiz lifecycle,
  borrow/approve/return, 401/403).
- `npm run typecheck` (both workspaces) + `npm run build` + `npm run lint` /
  `format:check` where touched.
- Frontend: no runner today — `typecheck` + `vite build` + manual smoke per touched page
  until Stage 7 adds `vitest`.

### New tests to add (Stage 0, before structural moves)

- Characterization: quiz student payload lacks `isCorrect`; expired attempt flips;
  `maxAttempts` enforced under double-submit; grading emits `GRADE` + audit atomically;
  attendance correction audit has before/after; announce fan-out count == audience;
  library concurrent approve claims one copy; CSV per-row errors + `ImportBatch` status;
  `tokenVersion` bump kills old token; archived user cannot log in.
- Contract: envelope `{success,message,data}` (+`pagination` where applicable) for one
  route per domain; `getCourse` shape lock (for D1); `ValidationError.details` shape
  lock (for Stage 4); frontend api-module round-trip against recorded fixtures.
- Integration (real DB): full grading, quiz lifecycle, borrow→approve→return,
  attendance upsert→correct, timetable conflict, user import.

### Per-stage verification

- Stages 1–3: unit suites must pass **without test edits** except import-path updates;
  any assertion change = behavior change = stop and justify.
- Stage 4: 422 matrix (invalid status/date/email/score/filetype/audience) + field-error
  wiring in one form per domain.
- Stages 5–6: frontend `typecheck`+`build`, route-role matrix smoke, bell/inbox,
  upload (120 s path), quiz resume-from-`localStorage`, paged-list navigation.
- Stage 7: CI runs unit + integration (ephemeral PG) + `vitest`; mocked-Prisma tests
  narrowed; coverage requirement = every R1–R5 invariant has ≥1 non-mocked test.

### Security/authorization verification (each stage touching policy)

- Re-run: unauthenticated → 401; wrong role → 403; student A cannot read student B's
  submissions/attempts/loans/notifications; teacher cannot touch another teacher's
  course/quiz/assignment (admin override audited); audience filtering (teacher sees no
  student-only announce and vice versa); `tokenVersion` revocation; password 72-byte
  reject.

---

## 10. Migration / Compatibility Strategy

- **Public API: no breaking changes.** Paths, methods, envelope keys, status codes
  (`422` validation, `401/403/404/409` semantics), CSV-as-JSON import shape, and
  `page/pageSize` query names stay identical. Route-mount shape in `app.ts` untouched.
- **Internal moves are pure renames first:** new `shared/` + split service files ship
  alongside deprecated re-export barrels for one stage; controllers/tests migrate;
  barrels deleted in the next stage. `git diff --find-renames` must show moves, not
  rewrites.
- **DB: no schema migration required** by this plan. No model/field/index changes.
  If a later stage wants a DB backstop (e.g. timetable exclusion constraint), it ships
  as a separate migration with its own plan — out of scope here.
- **Frontend migration:** `api/<domain>.ts` mirrors current paths/params/unwraps
  exactly; pages swap call-sites one domain per PR; `useApi` adoption is mechanical
  (same loading/error semantics). Pagination rollout preserves current visible counts
  as initial page sizes to avoid UI floods.
- **Rollback:** each stage reverts independently (kernel addition is additive; splits
  revert to barrels; frontend api layer reverts to inline calls). Tag HEAD before
  Stages 2, 3, 4.

---

## 11. Implementation Task Breakdown (execution order)

> Sequential. Each task: specific, verifiable, behavior-preserving unless noted.
> After each task: backend `test` + `typecheck`, frontend `typecheck` (+`build` if
> frontend touched).

1. Record baselines: `test:backend`, `typecheck`, `build` outputs + line counts
   (`quizService` 1153, god pages) into the PR description.
2. Add Stage-0 characterization tests (R1–R5 invariants) — must pass on unmodified code.
3. Add API contract tests (envelope + pagination + `getCourse` shape + 422 `details`).
4. Create `backend/src/shared/tx.ts` typed `TxClient`; replace `tx: any` in services
   (mechanical); green suite.
5. Create `backend/src/shared/accessPolicy.ts` (verbatim move of
   `isAdminRole/adminOverrideMeta` + membership checks); add access-matrix unit tests.
6. Create `backend/src/shared/{password,sanitize,validation,filePolicy}.ts` (verbatim
   moves); update imports; delete dead `auditLibraryAction` (or re-export).
7. Route library's 3 raw `tx.auditLog.create` through `writeAuditLog(tx)`; add
   audit-spelling test.
8. Migrate `assignmentService` + `quizService` to `accessPolicy`; remove
   `from './courseService'` imports; keep shim re-export one stage, then delete.
9. Migrate `userAdminService` to kernel password/sanitize; remove `from './authService'`.
10. Split `quizService` → crud/questions/attempts/scoring/access (verbatim moves +
    barrel); point `quizController` at leaves; remove barrel.
11. Split `libraryService` → catalog/borrowing; `userAdminService` → crud/import;
    `courseService` → crud/enrollment/content; `assignmentService` →
    crud/submissions/grading. Same barrel-then-remove pattern.
12. Introduce DTO validation at controllers (one domain per PR: auth→courses→
    assignments→quizzes→library→attendance→timetable→communication→users); remove
    duplicated controller role pre-checks where kernel enforces; unify file gates via
    `filePolicy`.
13. Wire backend `details` shape to frontend `getFieldErrors` in one form per domain.
14. Create `frontend/src/api/<domain>.ts` (mirror paths/unwraps exactly) + align
    `types/index.ts` (`CourseStatus`, full `DayOfWeek`, envelope generics); contract
    fixtures test.
15. Migrate frontend lists to api modules + `useApi`/domain hooks, one domain per PR;
    honor server pagination (preserve visible counts as initial sizes).
16. Assert zero `/api` literals and zero `response.data.data` unwraps remain in
    `frontend/src/pages/` (grep gate in CI or PR checklist).
17. Split `QuizDetailPage` (take vs edit vs results), `CourseDetailPage` (section
    components), `Layout` (Sidebar/Bell/Breadcrumbs/UserMenu); dedupe
    `Avatar/getInitials`, `StatCard`, status maps; split local form interfaces into
    shared types.
18. Add frontend `vitest` + tests for api modules (unwrap/pagination/error), auth flow
    (`login/logout/401→redirect`), and one paged list.
19. Expand backend integration coverage (grading, quiz lifecycle, borrow/return, CSV
    import, timetable conflicts) to run against ephemeral PG in CI.
20. Remove all deprecated barrels/shims; enforce file-size budget (~400 lines) as PR
    guidance; update `docs/FINAL_ARCHITECTURE.md` deltas + this plan's status table.
21. Final gate: full matrix — `test:backend` + `test:integration` (with DB) +
    frontend `vitest` + `typecheck` + `build` + `lint` + manual smoke (login, course,
    assignment submit/grade, quiz attempt, attendance, timetable, announce→bell→inbox,
    borrow→return, CSV import, dashboards).

---

## 12. Definition of Done

- [ ] No `service → other-service` imports remain (`grep "from './(course|auth)Service'"`
  in `services/` empty); all cross-domain policy flows through `shared/accessPolicy`
  + kernel.
- [ ] No service file > ~400 lines (excl. comments); quiz/library/user-admin/course/
  assignment splits complete with per-file unit tests.
- [ ] One validation seam: controllers validate DTOs, services assume valid; no regex/
  enum-literal duplication outside `shared/`+`dto`; single file policy; consistent
  422 `details` consumed by `getFieldErrors`.
- [ ] Single typed audit/notify spelling (`TxClient`, no `any`, no raw
  `tx.auditLog.create`); fan-out still atomic with documented budget.
- [ ] Frontend: zero hardcoded `/api` paths and zero manual envelope unwraps in
  `pages/`; all server-paged lists paginate; no page > ~400 lines; single Avatar,
  single status map; types aligned (no `status: string` drift).
- [ ] Behavior preserved: all Stage-0 characterization + contract + security-matrix
  tests green; `test:backend`, `test:integration` (with DB), frontend `vitest`,
  `typecheck`, `build`, `lint` green.
- [ ] No public API breakage (paths/methods/envelope/codes/pagination/CSV contract
  unchanged); no schema migration shipped; no new runtime infra (queue/cache/push).
- [ ] Docs updated (`FINAL_ARCHITECTURE` deltas, this plan's status); rollback tags
  recorded; no `.env`/secrets committed; no production behavior change beyond
  explicitly justified items (none proposed).

---

## Appendix A — File reference index (verify before editing)

Backend entry/config: `backend/src/app.ts`, `index.ts`, `config/env.ts`,
`prisma/client.ts`, `prisma/schema.prisma`, `prisma/seed.ts`.
Middleware/utils: `middleware/auth.ts`, `rbac.ts`, `rateLimit.ts`, `errorHandler.ts`;
`utils/response.ts`, `errors.ts`, `pagination.ts`, `logger.ts`, `url.ts`, `errorTracker.ts`;
`types/express.d.ts`.
Services (lines): `quizService.ts` 1153, `libraryService.ts` 729,
`assignmentService.ts` 634, `userAdminService.ts` 628, `courseService.ts` 506,
`attendanceService.ts` 400, `communicationService.ts` 323, `fileStorageService.ts` 192,
`timetableService.ts` 180, `authService.ts` 169, `dashboardService.ts` 156,
`notificationService.ts` 146, `studentSummaryService.ts` 91, `auditService.ts` 51.
Controllers/routes mirror the 11 domains under `src/controllers/` + `src/routes/`
(notably `assignmentRoutes.ts` multer config, `courseRoutes.ts` course-scoped
assignment/quiz/attendance routes, `app.ts:86-96` mount shape).
Tests: `backend/tests/*.test.ts` (17) + `tests/integration/api.integration.test.ts` +
`helpers.ts`.
Frontend: `src/api/client.ts`, `context/AuthContext.tsx`, `App.tsx`,
`hooks/useApi.ts`, `types/index.ts`, `utils/apiError.ts`, `components/Layout.tsx`
(833), `ui.tsx` (861), `motion.tsx` (333), `ProtectedRoute.tsx`, `StatusBadge.tsx`,
`SafeLink.tsx`; pages by size: `QuizDetailPage` 1135, `CourseDetailPage` 1050,
`AdminLibraryPage` 609, `DashboardPage` 520, `AdminUsersPage` 467, `CoursesPage` 456,
`StudentProfilePage` 437, `AssignmentDetailPage` 417, rest < 300.

## Appendix B — Uncertainties (honest unknowns)

- Production data volume / audience sizes (fan-out budget is estimated for pilot scale).
- Whether `TEST_DATABASE_URL` integration runs in the execution agent's environment
  (plan degrades gracefully to unit + contract tests with documented skip).
- Whether adding `zod` will be accepted under AGENTS.md ("clear reason" provided in
  Stage 4; fallback is centralized hand-rolled `parseXDto` — either satisfies the goal).
- Exact frontend pagination UX expectations (plan preserves current visible counts;
  product owner confirms final page sizes).

---

## 13. Implementation Status (added during execution)

Branch: `refactor/phase1-shared-kernel`. Backend Stages 0–4 and the frontend
API layer (Stage 5) are implemented and verified. Stage 6 is partial; Stage 7 is
the main outstanding item.

### Completed

- **Stage 0** — characterization + contract tests (`backend/tests/refactoring.test.ts`):
  quiz answer secrecy, attempt limits, grading audit+notify atomicity, attendance
  before/after audit, announcement fan-out count, library atomic copy claim, CSV
  per-row errors, sanitize/password guards, response-envelope shape, getCourse
  roster-privacy shape.
- **Stage 1** — shared kernel: `backend/src/shared/{tx,accessPolicy,password,
  sanitize,validation,filePolicy}.ts`. Typed `TxClient` replaces 15 `tx: any`;
  course-access policy owns `requireCourseAccess`/`isAdminRole`/
  `adminOverrideMeta`; single audit spelling (library's raw `tx.auditLog.create`
  routed through `writeAuditLog(tx)`); single file policy consumed by the route
  upload gate and `fileStorageService`; loose `where` types replaced with
  generated Prisma input types.
- **Stage 2** — no service-to-service imports: assignment/quiz use `accessPolicy`,
  user-admin uses kernel password/sanitize. `grep "from './course|authService'"` in
  `services/` is empty.
- **Stage 3** — god services split, original file kept as a thin barrel:
  `quizzes/{quizCrud,questionService,attemptService,scoring,shared}` (1153 → 4
  focused modules, pure `scoreAttempt` unit-tested), `library/{catalog,borrowing}`,
  `users/{userCrud,userImport}`, `assignments/{assignmentCrud,submissionService,
  gradingService,shared}`, `courses/{courseCrud,enrollmentService,contentService,
  shared}`.
- **Stage 4** — removed controller role pre-checks that duplicated route
  `requireRole` gates (assignment/course/quiz/attendance); added a validation
  matrix test. File gates were already unified in Stage 1.
- **Stage 5** — frontend per-domain `src/api/*.ts` + `api/envelope.ts`
  (unwrap + pagination). All pages/components/context migrated: zero hardcoded
  `/api` strings and zero `response.data.data` unwraps outside `api/`.
- **Stage 6 (partial)** — `getInitials` deduped into `components/ui.tsx`.

### Verification

- `npm run test:backend`: 268 passing (240 original + 28 new characterization/
  contract/scoring/validation).
- `npm run typecheck` (backend + frontend) clean; `npm run build` clean;
  `eslint` clean.
- Integration suite requires `TEST_DATABASE_URL` and was not run in this session.

### Deviations from the plan

1. **No new dependency (no zod).** Stage 4's fallback was used instead of adding
   zod, honoring AGENTS.md "do not introduce new packages without a clear reason".
   Validation remains centralized in `shared/validation.ts` + `shared/filePolicy.ts`;
   full typed DTOs at controller entry are not implemented.
2. **Barrels retained rather than deleted.** The split service files keep a thin
   `<service>.ts` barrel re-exporting the leaves, so controllers and the existing
   mocked-Prisma test suite stay stable. The barrel is 8–20 lines; the
   "one reason to change per file" goal is met by the leaves.
3. **No separate `quizAccess.ts`.** Quiz access checks stayed inline in the CRUD
   modules (they reuse `shared/accessPolicy`); a dedicated file would have been an
   abstraction without a distinct responsibility.
4. **`attendanceService` keeps its day-normalizing `assertValidDate`** rather than
   the shared date helper — it intentionally truncates to UTC midnight; documented
   in the file.
5. **Three files remain just over the ~400-line guide** (`library/borrowingService`
   466, `users/userCrudService` 416, `attendanceService` 404); further splitting
   would create trivial fragments. The plan treats the 400-line budget as a guide.

### Remaining work

- **Stage 6** — full decomposition of `QuizDetailPage` (1135), `CourseDetailPage`,
  and `Layout` into section components; dedupe `StatCard` variants and status maps.
- **Stage 7** — frontend `vitest` runner + api/auth-flow tests; expand integration
  coverage; replace `require.cache` Prisma mocks with a transaction harness; delete
  the deprecated barrels; update `docs/FINAL_ARCHITECTURE.md`.
