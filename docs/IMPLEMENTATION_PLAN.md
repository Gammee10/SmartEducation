# Implementation Plan - Smart Education System

## 1. Team Structure

The project has six members using feature-based ownership.

- M1: Foundation, Prisma setup, auth, RBAC, audit foundation, Library.
- M2: LMS courses, enrollments, content, Cloudinary learning materials.
- M3: Assignments, submissions, grading, assignment notifications.
- M4: Quizzes, attempts, quiz grading, assessment engine.
- M5: Attendance, timetable, SIS dashboards, student academic profile.
- M6: Communication, notifications, admin user management, bulk import.

Decision: Use six balanced feature ownership areas.

Why: The team size changed to six, and workload should be more equal than the previous split. Member 1 still owns essential foundation work because other features depend on it, but Member 1 also owns Library because that member wants the heavier Library feature.

Alternatives considered:

- Keep five-member ownership.
- Use layer-based frontend/backend/database ownership.
- Put Library with Communication.

Trade-offs:

- Feature ownership reduces handoffs.
- Member 1 must deliver foundation contracts early.
- Split assignments and quizzes creates better balance and clearer ownership.

## 2. Branch and Review Workflow

- `main` is protected and should remain deployable.
- Each member works on a feature branch.
- Branch naming:
  - `feature/m1-foundation-library`
  - `feature/m2-lms-content`
  - `feature/m3-assignments`
  - `feature/m4-quizzes`
  - `feature/m5-sis-dashboards`
  - `feature/m6-comm-users`
- All work merges through pull requests.
- At least one teammate reviews each PR.
- Run relevant tests before merge.

## 3. Phase 1 - Foundation and Contracts

Owner: M1 leads, all members review contracts.

Deliverables:

- Monorepo structure.
- React frontend baseline.
- Express backend baseline.
- Prisma setup.
- Supabase database configuration.
- Shared Prisma client.
- Standard API response helper.
- Central error handler.
- Auth middleware.
- Role middleware.
- Initial Prisma schema for shared identity models.
- Audit log model/helper.
- Initial admin seed.
- Basic login UI.
- Protected route wrapper.
- Deployment environment templates.

Exit criteria:

- Backend health endpoint works.
- Prisma validates.
- Supabase connection works.
- Initial admin can log in.
- Shared auth/role/audit contracts are documented.
- No secrets committed.

## 4. Phase 2 - Parallel Feature Build

Owners: M2-M6 build in parallel after foundation contracts stabilize. M1 continues Library work.

M1:

- Library schema, backend, frontend, tests.

M2:

- Courses, enrollments, content, Cloudinary.

M3:

- Assignments, submissions, grading.

M4:

- Quizzes, attempts, server-side timing.

M5:

- Attendance, timetable, dashboards.

M6:

- Announcements, events, notifications, user admin, bulk import.

Exit criteria:

- Each owner has database models, APIs, frontend, and tests for their feature.
- Cross-feature interfaces are stable.
- No major merge conflicts remain.

## 5. Phase 3 - Cross-Module Integration

Integration points:

- M2 course/enrollment access used by M3, M4, and M5.
- M3 assignment grading triggers M6 notification service and M1 audit service.
- M4 quiz results trigger M6 notification service and M1 audit service.
- M5 attendance corrections use M1 audit service.
- M5 dashboards read M2, M3, and M4 data.
- M6 user administration creates students/teachers used by all modules.
- M1 Library uses student identity and admin authorization.

Exit criteria:

- Full student journey works.
- Full teacher journey works.
- Full admin journey works.
- Notifications and audit records are created by dependent modules.

## 6. Phase 4 - Testing and Hardening

Owners: All.

Backend tests:

- Auth/RBAC.
- Library borrow/return.
- Courses/enrollments/content.
- Assignments/submissions/grading.
- Quizzes/timing/attempts.
- Attendance/timetable.
- Notifications/user admin/import.

Frontend tests:

- Login.
- Role navigation.
- Course flow.
- Assignment flow.
- Quiz flow.
- Attendance/timetable flow.
- Communication/notification flow.
- Library flow.
- Mobile viewport smoke tests.

Exit criteria:

- Tests pass.
- Security and authorization checks pass.
- Documentation is updated.

## 7. Phase 5 - Deployment

Owners: All, M1 coordinates.

Deliverables:

- Supabase configured.
- Prisma migrations deployed.
- Cloudinary configured.
- Backend deployed.
- Frontend deployed.
- Initial admin seeded.
- Smoke tests completed on deployed URLs.

Exit criteria:

- Frontend connects to backend.
- Backend connects to Supabase.
- File uploads work through Cloudinary.
- All major role flows pass on deployed system.

## 8. Implementation Rules

- Build vertically where possible: Prisma model, backend, frontend, tests.
- Keep each PR small enough to review.
- Use Prisma transactions for multi-step state changes.
- Add audit logs for sensitive operations when the operation is implemented.
- Add Prisma indexes for frequently queried relation, status, date, and search fields.
- Do not defer authorization checks to the frontend.
- Do not create public registration.
- Do not use local disk for permanent uploaded files.
- Do not hard delete academic records.
- Do not instantiate multiple Prisma clients.
