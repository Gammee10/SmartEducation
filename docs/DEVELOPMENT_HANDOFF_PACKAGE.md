# Development Handoff Package - Smart Education System

## 1. Executive Summary

The Smart Education System is a pilot-ready full-stack web application for Ethiopian high schools.
It includes LMS, SIS, Communication, Library, Assignments, Quizzes, Attendance, Timetable, Notifications, Dashboards, Testing, and Deployment.

The project goal is to learn realistic software engineering while building a useful school platform. The system should be stronger than a demo, but not overbuilt like a commercial enterprise product.

Target users:

- Admins: manage users, communication, dashboards, library administration, and school operations.
- Teachers: manage courses, assignments, quizzes, attendance, and student learning workflows.
- Students: access enrolled courses, submit assignments, take quizzes, view announcements, receive notifications, and use the library feature.

Development uses feature-based ownership with six members. Each member owns database models, backend APIs, frontend UI, validation, security, testing, and documentation for their assigned feature area.

## 2. Architecture Summary

Final architecture:

- Modular monolith.
- React, Vite, Tailwind CSS frontend.
- Node.js and Express backend.
- PostgreSQL hosted on Supabase.
- Prisma ORM for schema, migrations, and database access.
- Cloudinary for persistent file storage.
- JWT authentication with bcrypt password hashing.
- Role-based authorization with server-side ownership checks.
- In-app database-backed notifications for first release.
- Codex-based development using `AGENTS.md`.

Important conventions:

- `backend/prisma/schema.prisma` is the database source of truth.
- Use one shared Prisma client.
- Do not instantiate multiple `PrismaClient` instances.
- Use services/repositories for database access.
- Validate inputs before database writes.
- Never trust frontend authorization.
- Preserve academic history through soft deletion/status fields.
- Audit sensitive changes.
- Standard API response:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

## 3. Team Assignment Summary

| Member | Ownership | Branch | Workload |
|---|---|---|---|
| Member 1 | Foundation, Prisma setup, Auth, RBAC, Audit, Library | `feature/m1-foundation-library` | Equal-heavy |
| Member 2 | LMS Courses, Enrollment, Content, Cloudinary | `feature/m2-lms-content` | Equal |
| Member 3 | Assignments, Submissions, Grading | `feature/m3-assignments` | Equal |
| Member 4 | Quizzes, Attempts, Assessment Engine | `feature/m4-quizzes` | Equal |
| Member 5 | Attendance, Timetable, SIS Dashboards, Student Profile | `feature/m5-sis-dashboards` | Equal |
| Member 6 | Communication, Notifications, User Admin, Bulk Import | `feature/m6-comm-users` | Equal |

Member 1 starts first because all other members depend on Prisma setup, auth, role middleware, shared response/error helpers, and audit foundation.

## 4. Member 1 Package

### Project Overview

You own the essential platform foundation plus the Library feature. Your work enables every other member to build safely.

### Architecture Overview

You set up Prisma, shared database access, authentication, authorization, audit logging, and base project structure. You also build Library as a complete feature: catalog, search, borrowing requests, approvals, returns, and student history.

### Feature Ownership

Owned:

- Project foundation.
- Prisma setup.
- Shared Prisma client.
- Auth and JWT.
- RBAC middleware.
- Shared response and error helpers.
- Audit foundation.
- Library feature.

Boundaries:

- Member 6 owns admin user management and bulk import.
- You create foundation identity/auth capability, but not full user-admin UX unless needed for seed/login.
- Other members call your auth and audit utilities.

Dependencies:

- Everyone depends on your foundation.
- Library depends on student identity and admin authorization.

### Technical Specification

Functional requirements:

- Login.
- Current user endpoint.
- Protected route support.
- Role middleware for Admin, Teacher, Student.
- Audit helper/service.
- Library catalog and search.
- Student borrow request.
- Admin approve/reject.
- Loan issue and return tracking.
- Student borrowing history.

Database requirements:

- Configure Prisma.
- Create base models needed by all:
  - `User`
  - `Student`
  - `Teacher`
  - `AuditLog`
- Create Library models:
  - `LibraryBook`
  - `LibraryBookCopy`
  - `LibraryBorrowRequest`
  - `LibraryLoan`
- Use enums for roles and library statuses.
- Add indexes for email, role/status, book title/author/isbn, copy availability, and student loan history.

Backend requirements:

- Express app foundation if not present.
- Shared Prisma client.
- Auth routes/services/controllers.
- Auth middleware.
- Role middleware.
- Audit service.
- Library routes/services/controllers.
- Prisma transactions for borrow approval and returns.

Frontend requirements:

- Login page.
- Auth context/hook.
- Protected route wrapper.
- Library catalog/search page.
- Student borrow request/history page.
- Admin library management page.

API requirements:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `/api/library/books`
- `/api/library/requests`
- `/api/library/loans`

Security requirements:

- No public registration.
- Do not return password hashes.
- Admin-only Library administration.
- Students can only view own requests/history.
- Audit approve/reject/issue/return actions.

Testing requirements:

- Auth tests.
- RBAC tests.
- Audit helper tests.
- Library catalog/search tests.
- Borrow request, approval, rejection, return tests.
- Authorization boundary tests.

Definition of Done:

- Prisma foundation works.
- Auth works for all roles.
- Shared middleware/helpers are documented.
- Library works end to end.
- Tests pass.
- Documentation updated.

## 5. Member 1 Codex Prompt

```text
You are Codex implementing Member 1's ownership for the Smart Education System.

Analyze the repository first, including AGENTS.md, docs, package files, existing backend/frontend structure, and any existing Prisma files. Follow existing architecture and conventions. Avoid breaking existing functionality.

Project:
- Pilot-ready Smart Education System for Ethiopian high schools.
- Users: Admin, Teacher, Student.
- Architecture: modular monolith.
- Frontend: React, Vite, Tailwind CSS.
- Backend: Node.js, Express.
- Database: PostgreSQL on Supabase using Prisma ORM.
- File storage: Cloudinary.
- API response: { success, message, data }.

Your ownership:
- Foundation.
- Prisma setup.
- Shared Prisma client.
- Auth/JWT.
- RBAC middleware.
- Shared response/error helpers.
- Audit foundation.
- Library feature.

Requirements:
- Set up Prisma if not present.
- Create/update Prisma schema for User, Student, Teacher, AuditLog, LibraryBook, LibraryBookCopy, LibraryBorrowRequest, LibraryLoan.
- Implement login and current-user endpoint.
- Implement auth and role middleware.
- Implement audit helper/service.
- Implement Library catalog/search, borrow requests, approve/reject, loans, returns, and student history.
- Use Prisma transactions for borrow approval and returns.
- Add frontend login, protected routes, Library catalog, student borrowing history, and admin Library management.
- Validate all inputs.
- Enforce Admin-only Library admin and student-only own-history access.
- Write tests for auth, RBAC, audit helper, and Library workflows.
- Update documentation.

Definition of Done:
- Foundation enables other members.
- Auth works for Admin, Teacher, Student.
- Library works end to end.
- Tests pass.
- Documentation updated.
- Existing functionality remains intact.
```

## 6. Member 2 Package

### Project Overview

You own course delivery: courses, enrollment, course content, and Cloudinary-backed learning materials.

### Architecture Overview

Your feature depends on Member 1 auth, roles, Prisma setup, and base identity models.

### Feature Ownership

Owned:

- Courses.
- Course enrollment.
- Content items.
- Course file uploads.
- Course list/detail UI.

Dependencies:

- Member 1 foundation.
- Member 3 and Member 4 use your course/enrollment models.
- Member 5 uses course/enrollment data for attendance/timetable.

### Technical Specification

Database requirements:

- `Course`
- `CourseEnrollment`
- `ContentItem`
- Enums for enrollment status and content type.
- Indexes for teacher, student, course, active/status fields.

Backend requirements:

- Course CRUD.
- Enrollment by Admin.
- Role-filtered course list.
- Content upload/list/update/archive.
- Cloudinary integration for learning materials.
- Teacher ownership checks.
- Student enrollment checks.

Frontend requirements:

- Courses page.
- Course create/edit UI.
- Course detail content view.
- Content upload UI.
- Role-aware controls.

API requirements:

- `/api/courses`
- `/api/courses/:id/enroll`
- `/api/courses/:id/content`
- `/api/content/:id`

Security and validation:

- Teacher manages only owned courses.
- Student views only enrolled course content.
- Admin controls enrollment.
- Validate course title, subject, grade level, and uploads.

Testing:

- Course CRUD.
- Enrollment.
- Role-filtered list.
- Content upload.
- Unauthorized access.

Definition of Done:

- Teacher can create courses and upload content.
- Admin can enroll students.
- Student sees enrolled course content only.
- Tests and docs complete.

## 7. Member 2 Codex Prompt

```text
You are Codex implementing Member 2's ownership for the Smart Education System.

Analyze the repository first. Read AGENTS.md and docs. Follow existing Prisma, backend, frontend, and component conventions. Reuse existing helpers. Avoid breaking existing functionality.

Architecture:
- React/Vite/Tailwind frontend.
- Node/Express backend.
- PostgreSQL on Supabase using Prisma ORM.
- Cloudinary for files.
- Standard API response: { success, message, data }.

Your ownership:
- LMS courses.
- Course enrollment.
- Course content.
- Cloudinary-backed learning materials.

Requirements:
- Add Prisma models/enums for Course, CourseEnrollment, and ContentItem if not present.
- Implement course CRUD with teacher ownership.
- Implement Admin enrollment of students.
- Implement role-filtered course listing.
- Implement content upload/list/update/archive.
- Integrate Cloudinary for uploaded course materials.
- Build frontend courses page, course detail page, and content upload UI.
- Add loading, error, and empty states.
- Validate inputs and enforce authorization on the backend.
- Write tests for course CRUD, enrollment, content upload, and access control.
- Update documentation.

Definition of Done:
- Course/content flows work end to end.
- Tests pass.
- Documentation updated.
- Existing functionality remains intact.
```

## 8. Member 3 Package

### Project Overview

You own assignment workflows: assignment creation, submission, grading, grade notifications, and audit integration.

### Architecture Overview

Your feature depends on Member 1 foundation and Member 2 course/enrollment models.
It integrates with Member 6 notifications and Member 1 audit service.

### Feature Ownership

Owned:

- Assignments.
- Assignment submissions.
- Submission file uploads.
- Grading.
- Assignment grade notification trigger.

Dependencies:

- Member 1 auth/audit.
- Member 2 courses/enrollments.
- Member 6 notification service.

### Technical Specification

Database requirements:

- `Assignment`
- `AssignmentSubmission`
- Enums for submission status.
- Indexes for course, assignment, student, status fields.

Backend requirements:

- Assignment CRUD for teachers.
- Submission upload for students.
- Grading workflow.
- Cloudinary for submission files.
- Prisma transaction for grading plus audit/notification.

Frontend requirements:

- Assignment list.
- Teacher assignment form.
- Student submission UI.
- Teacher submissions/grading UI.

API requirements:

- `/api/courses/:id/assignments`
- `/api/assignments/:id`
- `/api/assignments/:id/submit`
- `/api/assignments/:id/submissions`
- `/api/submissions/:id/grade`

Security and validation:

- Teacher owns course.
- Student is enrolled.
- Score cannot exceed max score.
- Student sees only own submission.
- Grade changes audited.

Testing:

- Assignment CRUD.
- Submission.
- Grading.
- Score validation.
- Authorization.
- Notification/audit creation.

Definition of Done:

- Assignment workflow works end to end.
- Grade creates audit and notification.
- Tests and docs complete.

## 9. Member 3 Codex Prompt

```text
You are Codex implementing Member 3's ownership for the Smart Education System.

Analyze the repository first. Read AGENTS.md and docs. Follow existing Prisma, backend, frontend, API, and UI conventions. Avoid breaking existing functionality.

Architecture:
- Modular monolith.
- React/Vite/Tailwind frontend.
- Node/Express backend.
- PostgreSQL on Supabase through Prisma ORM.
- Cloudinary for uploaded submission files.
- Standard API response: { success, message, data }.

Your ownership:
- Assignments.
- Assignment submissions.
- Submission uploads.
- Grading.
- Grade notification triggers.

Requirements:
- Add Prisma models/enums for Assignment and AssignmentSubmission if not present.
- Implement assignment CRUD for teachers on owned courses.
- Implement student submission for enrolled students.
- Implement submission upload through Cloudinary.
- Implement teacher grading.
- Create audit logs for grade changes using Member 1 audit helper.
- Trigger in-app notifications using Member 6 notification service when available.
- Build frontend assignment list, create form, submission UI, and grading UI.
- Validate required fields and score limits.
- Enforce server-side authorization.
- Write tests for assignment creation, submission, grading, validation, and authorization.
- Update documentation.

Definition of Done:
- Assignment workflows work end to end.
- Grade events are audited and notify students.
- Tests pass.
- Documentation updated.
- Existing functionality remains intact.
```

## 10. Member 4 Package

### Project Overview

You own quizzes and the assessment engine. This includes quiz creation, question management, attempts, scoring, server-side time enforcement, and basic anti-cheating controls.

### Architecture Overview

Your feature depends on Member 1 auth/audit, Member 2 courses/enrollments, and Member 6 notifications.

### Feature Ownership

Owned:

- Quizzes.
- Quiz questions and options.
- Quiz attempts.
- Quiz answers.
- Server-side time enforcement.
- Attempt history.
- Basic anti-cheating.

Dependencies:

- Member 1 auth/audit.
- Member 2 courses/enrollments.
- Member 6 notification service.

### Technical Specification

Database requirements:

- `Quiz`
- `QuizQuestion`
- `QuizOption`
- `QuizAttempt`
- `QuizAnswer`
- Enums for question type and attempt status.

Backend requirements:

- Quiz builder APIs.
- Student start attempt.
- Randomized questions/options.
- Server-side expiry checks.
- Auto-grading.
- Attempt history.

Frontend requirements:

- Quiz builder.
- Take quiz page with timer.
- Student result view.
- Teacher result view.

API requirements:

- `/api/courses/:id/quizzes`
- `/api/quizzes/:id`
- `/api/quizzes/:id/questions`
- `/api/quizzes/:id/attempt`
- `/api/attempts/:id/submit`
- `/api/quizzes/:id/results`

Security and validation:

- Do not leak correct answers.
- Teacher owns course.
- Student enrolled in course.
- Enforce attempt limit and expiry on server.

Testing:

- Quiz creation.
- Answer secrecy.
- Attempt limits.
- Server-side expiry.
- Auto-grading.
- Authorization.

Definition of Done:

- Quiz workflow works end to end.
- Timing and attempts are server-enforced.
- Tests and docs complete.

## 11. Member 4 Codex Prompt

```text
You are Codex implementing Member 4's ownership for the Smart Education System.

Analyze the repository first. Read AGENTS.md and docs. Follow existing Prisma, backend, frontend, API, and UI conventions. Avoid breaking existing functionality.

Architecture:
- React/Vite/Tailwind frontend.
- Node/Express backend.
- PostgreSQL on Supabase using Prisma ORM.
- Standard API response: { success, message, data }.

Your ownership:
- Quizzes.
- Quiz questions and options.
- Attempts and answers.
- Server-side timing.
- Auto-grading.
- Basic anti-cheating.

Requirements:
- Add Prisma models/enums for Quiz, QuizQuestion, QuizOption, QuizAttempt, and QuizAnswer if not present.
- Implement quiz creation and question management for teachers on owned courses.
- Implement start-attempt for enrolled students.
- Randomize questions and answer options.
- Enforce max attempts and server-side expiry.
- Implement submit-attempt and auto-grading.
- Preserve attempt history.
- Never expose correct answers to students before allowed.
- Trigger result notification using Member 6 notification service when available.
- Use Member 1 audit helper for sensitive attempt/result records where appropriate.
- Build quiz builder, take-quiz page, result page, and teacher results page.
- Write tests for quiz creation, answer secrecy, attempt limits, expiry, scoring, and authorization.
- Update documentation.

Definition of Done:
- Quiz workflows work end to end.
- Timing and attempt rules are enforced server-side.
- Tests pass.
- Documentation updated.
- Existing functionality remains intact.
```

## 12. Member 5 Package

### Project Overview

You own SIS operations: attendance, timetable, dashboards, and student academic profile summaries.

### Architecture Overview

Your feature reads from users, courses, enrollments, assignments, and quizzes. You own SIS write workflows and dashboard/profile aggregate reads.

### Feature Ownership

Owned:

- Attendance.
- Attendance correction.
- Timetable.
- Dashboards.
- Student profile summary.

Dependencies:

- Member 1 auth/audit.
- Member 2 courses/enrollments.
- Member 3 assignments.
- Member 4 quizzes.

### Technical Specification

Database requirements:

- `Attendance`
- `TimetableSlot`
- Enums for attendance status and day of week.

Backend requirements:

- Attendance marking/upsert.
- Attendance correction with audit.
- Timetable CRUD.
- Room and teacher conflict checks.
- Dashboard aggregate APIs.
- Student summary API.

Frontend requirements:

- Mark attendance page.
- Attendance report/correction page.
- Timetable grid.
- Admin dashboard.
- Teacher dashboard.
- Student dashboard.
- Student profile summary.

API requirements:

- `/api/courses/:id/attendance`
- `/api/students/:id/attendance`
- `/api/attendance/:id`
- `/api/timetable`
- `/api/dashboard/admin`
- `/api/dashboard/teacher`
- `/api/dashboard/student`
- `/api/students/:id/summary`

Security and validation:

- Teacher owns course.
- Date cannot be future.
- Timetable start before end.
- No room/teacher time overlap.
- Attendance corrections audited.

Testing:

- Attendance upsert.
- Future-date rejection.
- Ownership.
- Timetable conflicts.
- Dashboard aggregation.

Definition of Done:

- SIS workflows work end to end.
- Dashboards are accurate.
- Tests and docs complete.

## 13. Member 5 Codex Prompt

```text
You are Codex implementing Member 5's ownership for the Smart Education System.

Analyze the repository first. Read AGENTS.md and docs. Follow existing Prisma, backend, frontend, API, and UI conventions. Avoid breaking existing functionality.

Architecture:
- React/Vite/Tailwind frontend.
- Node/Express backend.
- PostgreSQL on Supabase using Prisma ORM.
- Standard API response: { success, message, data }.

Your ownership:
- Attendance.
- Attendance correction.
- Timetable.
- Role dashboards.
- Student academic profile summary.

Requirements:
- Add Prisma models/enums for Attendance and TimetableSlot if not present.
- Implement attendance marking with upsert behavior.
- Implement attendance correction with audit log.
- Implement timetable CRUD.
- Prevent room and teacher time conflicts.
- Implement role-filtered timetable views.
- Implement admin, teacher, and student dashboard endpoints and UI.
- Implement student summary combining profile, courses, attendance, assignments, and quiz results.
- Build frontend pages for attendance, timetable, dashboards, and student summary.
- Validate dates, statuses, times, conflicts, and permissions.
- Write tests for attendance, correction audit, timetable conflicts, dashboards, and summary.
- Update documentation.

Definition of Done:
- Attendance, timetable, dashboards, and student profile summary work end to end.
- Sensitive attendance changes are audited.
- Tests pass.
- Documentation updated.
- Existing functionality remains intact.
```

## 14. Member 6 Package

### Project Overview

You own communication, notifications, user administration, and bulk import. Your work supports onboarding and school-wide information flow.

### Architecture Overview

Your feature depends on Member 1 auth/base identity foundation. Other members depend on your notification service for grade, quiz, and attendance notifications.

### Feature Ownership

Owned:

- Announcements.
- Events.
- Notifications.
- Notification bell/inbox.
- Admin user management.
- Student/teacher manual creation.
- CSV bulk import.

Dependencies:

- Member 1 auth and user base models.
- Members 3, 4, and 5 may trigger notifications.

### Technical Specification

Database requirements:

- `Announcement`
- `Event`
- `Notification`
- Optional `ImportBatch`
- Optional `ImportError`

Backend requirements:

- Announcement/event CRUD.
- Audience targeting.
- Notification service.
- Notification read/unread APIs.
- User creation/update/archive.
- CSV import.

Frontend requirements:

- Announcements page.
- Events page.
- Notification bell and inbox.
- User admin pages.
- CSV import UI.

API requirements:

- `/api/announcements`
- `/api/events`
- `/api/notifications`
- `/api/users`
- `/api/users/import`

Security and validation:

- No public registration.
- Admin controls user creation/import.
- Users read only own notifications.
- Audience filtering enforced server-side.
- Duplicate emails rejected.

Testing:

- Announcement/event filtering.
- Notification read/unread.
- User creation/archive.
- CSV import validation.
- Authorization.

Definition of Done:

- Communication works end to end.
- Notifications can be triggered by other modules.
- User admin/import works.
- Tests and docs complete.

## 15. Member 6 Codex Prompt

```text
You are Codex implementing Member 6's ownership for the Smart Education System.

Analyze the repository first. Read AGENTS.md and docs. Follow existing Prisma, backend, frontend, API, and UI conventions. Avoid breaking existing functionality.

Architecture:
- React/Vite/Tailwind frontend.
- Node/Express backend.
- PostgreSQL on Supabase using Prisma ORM.
- Standard API response: { success, message, data }.
- In-app notifications are required for first release. Push notifications are deferred.

Your ownership:
- Announcements.
- Events.
- Notifications.
- Notification bell/inbox.
- Admin user management.
- Student/teacher manual creation.
- CSV bulk import.

Requirements:
- Add Prisma models/enums for Announcement, Event, Notification, and optional import tracking models if not present.
- Implement announcements and events with audience targeting.
- Implement notification service usable by other modules.
- Implement notification unread count, mark one read, and mark all read.
- Implement admin user creation/update/archive for students and teachers.
- Implement CSV bulk import with validation and clear error reporting.
- Build frontend announcements/events pages, notification bell/inbox, user admin pages, and import UI.
- Validate all inputs.
- Enforce no public registration.
- Enforce users only access own notifications.
- Write tests for communication, notifications, user admin, import validation, and authorization.
- Update documentation.

Definition of Done:
- Communication, notifications, and user admin/import work end to end.
- Other modules can trigger notifications through your service.
- Tests pass.
- Documentation updated.
- Existing functionality remains intact.
```

## 16. Team Integration Plan

1. Member 1 starts foundation first.
2. All members review Prisma schema naming and shared enums before adding feature models.
3. Member 2 builds courses/enrollments early because Members 3, 4, and 5 depend on them.
4. Member 6 exposes notification service contract early.
5. Member 3 integrates grade notifications.
6. Member 4 integrates quiz result notifications.
7. Member 5 integrates attendance audit and dashboard reads.
8. Final integration branch validates end-to-end flows.

## 17. Merge Strategy

Recommended merge order:

1. Member 1 foundation subset.
2. Member 2 courses/enrollments/content.
3. Member 6 communication/user admin notification service.
4. Member 3 assignments.
5. Member 4 quizzes.
6. Member 5 SIS dashboards.
7. Member 1 Library if it is not already merged with foundation.
8. Final integration PR.

Large Member 1 work may be split into:

- PR 1: foundation/auth/Prisma/audit.
- PR 2: Library.

## 18. Git Branch Strategy

- `main`: protected and deployable.
- Feature branches:
  - `feature/m1-foundation-library`
  - `feature/m2-lms-content`
  - `feature/m3-assignments`
  - `feature/m4-quizzes`
  - `feature/m5-sis-dashboards`
  - `feature/m6-comm-users`
- Optional integration branch:
  - `integration/full-system`

Commit convention:

- `[foundation] add prisma client`
- `[auth] add jwt middleware`
- `[library] add borrow approval`
- `[lms] add course enrollment`
- `[assignments] add grading workflow`
- `[quizzes] enforce attempt expiry`
- `[sis] add attendance upsert`
- `[comm] add notification inbox`
- `[users] add csv import`

## 19. Pull Request Guidelines

Each PR must include:

- Summary.
- Features implemented.
- Prisma schema/migration changes.
- API endpoints added or changed.
- Frontend pages/components added or changed.
- Tests added and run.
- Screenshots for UI work.
- Known limitations.
- Documentation updates.

Rules:

- Do not mix unrelated feature work.
- Do not edit another member's files without coordination.
- Do not commit `.env`, secrets, generated build output, or local upload files.
- Resolve Prisma schema conflicts carefully.

## 20. Final Delivery Checklist

Foundation:

- Prisma validates and migrations run.
- Supabase connection works.
- Auth works for Admin, Teacher, Student.
- RBAC works.
- Audit helper works.

LMS:

- Teacher creates course.
- Admin enrolls student.
- Teacher uploads content.
- Student sees enrolled course content only.

Assignments:

- Teacher creates assignment.
- Student submits assignment.
- Teacher grades submission.
- Student receives notification.

Quizzes:

- Teacher creates quiz.
- Student takes quiz.
- Server enforces timing and attempts.
- Results are stored.

SIS:

- Teacher marks attendance.
- Attendance correction audited.
- Timetable conflicts prevented.
- Dashboards load.
- Student summary works.

Communication and users:

- Admin creates/imports users.
- Announcements/events target correct audiences.
- Notification bell works.
- Users mark notifications read.

Library:

- Admin manages books/copies.
- Student searches catalog.
- Student requests borrowing.
- Admin approves/rejects.
- Admin records return.
- Student sees borrowing history.

Deployment:

- Backend deployed.
- Frontend deployed.
- Backend connects to Supabase.
- Cloudinary upload works.
- No hardcoded localhost URLs remain.
- Tests pass.
