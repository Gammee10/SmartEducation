# 🎯 Member 5 Continuation Prompt — SIS, Attendance, Timetable, Dashboards

> **Paste everything below this line into a fresh chat.** Start the new chat with this exact prompt.

---

You are continuing work on the **Smart Education System** — a pilot-ready full-stack platform for Ethiopian high schools. **Members 1–4 are complete and pushed to GitHub.** Your task is to implement **Member 5: SIS, Attendance, Timetable, Dashboards, and Student Academic Profile**.

---

## 1. IMPORTANT — First, Verify the Pending Login Issue

Before starting new features, **verify login works end-to-end**. The previous session ended with this unresolved report from the user:

> "The backend runs perfectly, but when I try to login it says *'Login failed. Please try again.'*"

**Likely causes to check (in this order):**
1. **Database not seeded** — the demo users (`admin@school.edu`, `teacher@school.edu`, `student@school.edu`) don't exist yet. Run:
   ```bash
   npm run prisma:migrate    # apply the schema
   npm run prisma:seed       # create demo users + sample books
   ```
2. **`.env` has placeholder `DIRECT_URL`** — the `backend/.env` file was created from the template. If the user hasn't filled in their real Supabase credentials, Prisma can't connect. Ask the user to confirm their real Supabase connection strings are in `backend/.env`.
3. **Frontend proxy** — confirm `frontend/vite.config.ts` proxies `/api` to `http://localhost:5000` (it was correct at time of writing).
4. **JWT secret mismatch** — ensure `JWT_SECRET` is set (dev-default works).

**Verify by:**
- `npm run prisma:migrate` then `npm run prisma:seed`
- Starting backend (`npm run dev:backend`) and frontend (`npm run dev:frontend`)
- Logging in as `admin@school.edu` / `Password123!`
- If it works, record the fix in a short note.
- If it still fails, capture the backend terminal output and the exact backend error — do not assume. Ask the user to paste the backend logs.

> ⚠️ Do **not** start Member 5 code until login works, because the dashboards and student summary depend on authenticated data.

---

## 2. Project State (Current)

- **Repository:** https://github.com/Gammee10/SmartEducation (branch `master`)
- **Local workspace:** `c:\Users\gamme\OneDrive\Documents\Everything\Development\SmartEducation`
- **Completed modules (pushed, all tests passing):**
  - **Member 1** — Foundation, Auth (JWT+bcrypt), RBAC, Audit, Library
  - **Member 2** — LMS Courses, Enrollment, Content (Cloudinary file storage)
  - **Member 3** — Assignments, Submissions, Grading + notifications
  - **Member 4** — Quizzes, Attempts, Auto-grading, timing enforcement, answer secrecy
  - **Enhanced README** — badges, feature tour, API docs, roadmap
- **Migrations pushed** — `backend/prisma/migrations/20260818015923_memberfour_migration/` contains the full schema history.
- **Git log (top of master):**
  ```
  9d25275 feat-add-prisma-migrations
  a1dbb2d docs-enhance-readme
  56bc341 feat(member4): quizzes and assessment engine
  11ae879 feat: Member 3 - Assignments, Submissions, and Grading
  4faea3f feat: Member 2 - LMS Courses, Enrollment, and Content
  9e9e6e0 feat: Member 1 - Foundation, Auth, Library
  ```

### Tech Stack
- **Frontend:** React 18, Vite 5, TypeScript 5, Tailwind CSS 3, react-router-dom 6, axios
- **Backend:** Node.js, Express 4, TypeScript, Prisma 5 + PostgreSQL (Supabase), bcryptjs, jsonwebtoken, multer + Cloudinary
- **Tests:** Node's built-in `node:test` runner run via `tsx --test`; tests use **mock Prisma** injection (see below)

---

## 3. How to Sync and Run

```bash
# Pull the latest (in your workspace)
git pull origin master

# Install dependencies (npm workspaces) if needed
npm install

# Configure env (backend/.env must exist — contains your Supabase credentials; it is gitignored)
# It exists already in the workspace; verify the values are real.

# Apply schema + seed demo data
cd backend
npm run prisma:migrate
npm run prisma:seed
cd ..

# Run backend + frontend (two terminals)
npm run dev:backend      # http://localhost:5000
npm run dev:frontend     # http://localhost:5173
```

---

## 4. Conventions to Follow (Read these files first)

Before coding, read and **match** these patterns exactly:

### Backend
*   `backend/src/app.ts` — Express wiring, request logging, error handler, health endpoint.
*   `backend/src/middleware/auth.ts` — JWT middleware that populates `req.user` (id, email, fullName, role, status, student?, teacher?).
*   `backend/src/middleware/rbac.ts` — `requireRole`, `requireAdmin`, `requireTeacher`, `requireStudent`.
*   `backend/src/utils/response.ts` — `success`, `created`, `paginated` helpers; standard shape `{ success, message, data }`.
*   `backend/src/utils/errors.ts` — `AppError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ValidationError`, `ConflictError`.
*   **Service-layer pattern:** `backend/src/services/*` own all Prisma access and business rules; controllers are thin and call services; routes define auth mapping.
    *   Example (read fully): `backend/src/services/assignmentService.ts`, `backend/src/services/quizService.ts`, `backend/src/services/courseService.ts`
*   **Shared Prisma client:** ALWAYS import from `backend/src/prisma/client.ts` — never instantiate `new PrismaClient()` anywhere else.
*   **Audit logging:** use `writeAuditLog({ actorId, action, entity, entityId, metadata, ipAddress }, optionalTx)` (backend/src/services/auditService.ts) for sensitive operations. Attendance corrections MUST be audited.
*   **Notifications:** use `createNotification({ userId, title, message, type, metadata }, optionalTx)` from backend/src/services/notificationService.ts. Types available: `'ASSIGNMENT' | 'GRADE' | 'QUIZ_RESULT' | 'ANNOUNCEMENT' | 'EVENT' | 'GENERAL'`.
*   **Transactions:** use `prisma.$transaction(async (tx) => {...})` for multi-step writes (see assignment grading / quiz attempt submit).
*   **Prisma-derived types:** because the four models run together, services often use `const prisma = prismaModule as any;` to bypass strict typing — follow that.
*   **Routes:** routers registered in `backend/src/app.ts`; course-scoped routes that already exist live in `backend/src/routes/courseRoutes.ts` (courses, enrollments, content, assignments, quizzes). Add attendance-scoped routes there as well. Top-level routes (e.g., `/api/attendance`, `/api/timetable`, `/api/dashboard`, `/api/students/:id/attendance`, `/api/students/:id/summary`) go in a new `backend/src/routes/attendanceRoutes.ts` + a `dashboardRoutes.ts`.
*   **Controllers:** thin, use `getIp(req)`, resolve query `page`/`pageSize`, respond via `success/created/paginated`. See `backend/src/controllers/assignmentController.ts`.

### Frontend
*   `frontend/src/api/client.ts` — axios instance with JWT interceptor and 401 handling.
*   `frontend/src/context/AuthContext.tsx` — `useAuth()` exposes `user`, `login`, `logout`, `isAdmin`, `isTeacher`, `isStudent`.
*   **Pages pattern:** look at `frontend/src/pages/CourseDetailPage.tsx` (tabs/forms), `frontend/src/pages/AssignmentDetailPage.tsx` (teacher vs student views), `frontend/src/pages/QuizDetailPage.tsx` (timed/stateful interactions). Use the same Tailwind styling (bg-white, rounded-lg, border-gray-200, text-sm, font-medium, etc.).
*   **Routing:** add new pages to `frontend/src/App.tsx` under the `/` ProtectedRoute nested layout; use `ProtectedRoute roles={['ADMIN']}` etc. where a page is role-scoped (see `library/admin`).
*   **Frontend Shared types:** extend `frontend/src/types/index.ts` with `Attendance`, `TimetableSlot`, and dashboard types.

### API shape (always)
```json
{ "success": true, "message": "Operation completed successfully", "data": {} }
// Paginated endpoints also include:
{ "pagination": { "page": 1, "pageSize": 20, "total": 5, "totalPages": 1 } }
```

---

## 5. Member 5 — Your Ownership (as configured)

### Database models (add to `backend/prisma/schema.prisma`)

*   `Attendance` — fields should include: id (uuid), `studentId` FK→students, `courseId` FK→courses, `date` (`@db.Date`), `status` (enum: `PRESENT`, `ABSENT`, `LATE`, `EXCUSED`), `markedById` FK→users (teacher who marked), `markedAt`, `comment?`, plus createdAt/updatedAt. Add `@@unique([studentId, courseId, date])` so marking is an upsert (one row per day). Indexes: `[studentId, date]`, `[courseId, date]`.
*   **TimetableSlot** — fields should include: id (uuid), `courseId` FK→courses, `dayOfWeek` (enum `MONDAY`..`FRIDAY` or as you prefer), `startTime` (String like '08:00' or `@db.Time`), `endTime`, `room`? (e.g., 'R1'), teacherId? If you put teacherId on the slot it must be consistent ideally add `teacherId` referencing users/teachers; allow null teacher so Admin can assign later. Add indexes `[teacherId, dayOfWeek]`, `[courseId, dayOfWeek]`. Prevents room & teacher time conflicts (validate that inserting same time creates no overlap).
    *   Stop conflicts with an explicit check in the service using an overlapping query before create/update.

**Enums (Prisma):**
```prisma
enum AttendanceStatus { PRESENT ABSENT LATE EXCUSED }
enum DayOfWeek { MONDAY TUESDAY WEDNESDAY THURSDAY FRIDAY }
```

### API scope (implement all)

| Method | Route | Description | Access |
|---|---|---|---|
| GET | `/api/courses/:id/attendance?date=YYYY-MM-DD` | List attendance for course (optionally date-filtered) | Teacher (owner), Admin |
| POST | `/api/attendance/upsert` (body: `[{studentId, courseId, date, status, comment}...]`) or per student | Mark/upsert attendance | Teacher (owner of course) |
| PUT | `/api/attendance/:id` | Correct an attendance record (Audit it; metadata should record the change) | Teacher (owner) or Admin |
| GET | `/api/students/:id/attendance` | Attendance history for that student (own only) | Student (own), Teacher (owns course), Admin |
| GET/POST/DELETE | `/api/timetable` | List + CRUD timetable slots | GET: all roles (role-filtered); POST/DELETE: Admin only |
| GET | `/api/dashboard/admin` | Aggregate stats (courses, students, attendance %, assignments avg, quizzes avg) | Admin |
| GET | `/api/dashboard/teacher` | Teacher's own stats (my courses, students count, recent submissions, recent grades, quizzes) | Teacher |
| GET | `/api/dashboard/student` | Student's own stats (enrollments, attendance %, avg assignment score, avg quiz score) | Student |
| GET | `/api/students/:id/summary` | Student profile: user info + courses + attendance rate + assignments avg/quiz avg + recent attempts | Self, Admin, Teacher of that student's course |

### Frontend pages required
-   **AttendancePage** — Teacher/Admin: see course's attendance grid (date column × students), mark an item (upsert), view history.
-   **TimetablePage** — Admin manage slots; Teacher sees own; Student sees own enrolled courses; render a simple table (Mon–Fri rows × time columns).
-   **AdminDashboardPage** (page `/admin/dashboard`) — stat cards + charts (use simple Tailwind; you can draw bars with divs).
-   **TeacherDashboardPage** (`/teacher/dashboard`)
-   **StudentDashboardPage** (`/student/dashboard`)
-   **StudentProfilePage** (`/students/:id`) — student academic summary. Show profile, enrolled courses, attendance rate, avg assignment/quiz scores, recent attempts.

### Security
-   Teacher can only read/write attendance for courses they own (`course.teacherId === teacher.id`).
-   Student can only query own attendance/summary; Admin and teacher-allowed override apply as above.
-   Attendance corrections are sensitive: use `writeAuditLog` with `action: 'ATTENDANCE_CORRECTED'`, `entity: 'Attendance'`, `entityId: id`, and `metadata: { before..., after... }`.
-   Timetable writes are Admin-only.

---

## 6. Definition of Done for Member 5

1.  Prisma `Attendance` + `TimetableSlot` models added and validated (use `npx prisma validate`; note: it will fail without `.env` DIRECT_URL — that's expected if no `.env`; ask user, or run with dotenv set).
2.  Backend service/controller/routes implemented, consistent with existing style, all from create to read.
3.  Attendance upsert + correction works (with audit log on correction).
4.  Timetable conflict checks enforced on create/update (room overlap + teacher overlap).
5.  Dashboard endpoints (admin/teacher/student) + student summary work.
6.  Frontend pages implemented: attendance, timetable, dashboards, student summary — all rendered with role-appropriate views.
7.  Tests added for: attendance marking, correction audit, timetable conflicts, dashboard & summary aggregation. Tests use the same mock-Prisma pattern as `backend/tests/quiz.test.ts` and `backend/tests/assignment.test.ts` (see §3).
8.  `npm run test`: full suite passes (133 existing tests + new ones — must stay green, no regressions).
9.  Frontend builds: `cd frontend && npm run build` (tsc+vite) must pass with 0 errors.
10. Documentation/README stays up-to-date (add Member 5 rows + API rows + roadmap).
11. Git: commit on `master` with a clear message (e.g., `feat(member5): SIS - attendance, timetable, dashboards`) and push.

---

## 7. Files you will likely create/modify

**Backend**
- `backend/prisma/schema.prisma` (add models + enums) → then `npm run prisma:generate` and a new migration (`npx prisma migrate dev --name memberfive_sis`).
- New: `backend/src/services/attendanceService.ts`, `backend/src/services/timetableService.ts`, `backend/src/services/dashboardService.ts`, `backend/src/services/studentSummaryService.ts`.
- New: `backend/src/controllers/attendanceController.ts`, `backend/src/controllers/timetableController.ts`, `backend/src/controllers/dashboardController.ts`.
- New: `backend/src/routes/attendanceRoutes.ts`, `backend/src/routes/timetableRoutes.ts`, `backend/src/routes/dashboardRoutes.ts`.
- Update: `backend/src/app.ts` (register new routers).
- Update: `backend/src/routes/courseRoutes.ts` (course-scoped attendance added, e.g., `GET /courses/:id/attendance`).
- New: `backend/tests/attendance.test.ts`, `backend/tests/timetable.test.ts`, `backend/tests/dashboard.test.ts`.

**Frontend**
- Update: `frontend/src/App.tsx`, `frontend/src/types/index.ts`, `frontend/src/components/Layout.tsx` (add nav items: dashboard links per role, timetable, attendance).
- New: `frontend/src/pages/AttendancePage.tsx`, `frontend/src/pages/TimetablePage.tsx`, `frontend/src/pages/AdminDashboardPage.tsx`, `frontend/src/pages/TeacherDashboardPage.tsx`, `frontend/src/pages/StudentDashboardPage.tsx`, `frontend/src/pages/StudentProfilePage.tsx`.

README.md updates at the end.

---

## 8. Important Git workflow

```bash
git add <specific files>       # NEVER use git add .
git commit -m "feat(member5): attendance, timetable, dashboards"
git push origin master
```

---
Go ahead and start. First: confirm login works (see §1), then implement Member 5 following §2–§7.