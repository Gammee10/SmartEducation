# Final Architecture Document - Smart Education System

## 1. Purpose

The Smart Education System is a pilot-ready full-stack platform for Ethiopian high schools.
It supports school learning, administration, communication, assessment, attendance, timetable, notifications, dashboards, and a lightweight integrated library feature.

The project goal is educational and practical. The system should be realistic enough for a school pilot while remaining achievable for a student team.

## 2. Updated Core Decisions

### Prisma ORM

Decision: Use PostgreSQL with Prisma ORM instead of raw SQL.

Why: The team changed direction because raw SQL may be too difficult for the project scope and timeline. Prisma reduces boilerplate, improves type safety, simplifies migrations, and lets the team focus on shipping the full feature set.

Alternatives considered:

- Raw SQL with `pg`.
- Supabase generated APIs.
- Sequelize or TypeORM.

Trade-offs:

- Prisma contradicts the earlier goal of deeper raw-SQL learning.
- The team loses some direct practice with query tuning and manual joins.
- The project gains speed, consistency, safer migrations, and easier onboarding.

Rules:

- `backend/prisma/schema.prisma` is the database source of truth.
- Use one shared Prisma client.
- Do not instantiate `PrismaClient` in multiple files.
- Do not manually edit generated migration SQL unless absolutely necessary and reviewed.

### Modular Monolith

Decision: Use one backend application with strong internal feature boundaries.

Why: A modular monolith is easier to build, test, deploy, and coordinate for a six-member team than microservices.

Alternatives considered:

- Microservices.
- Separate backend per module.
- Serverless-only architecture.

Trade-offs:

- Lower operational complexity.
- Requires discipline to avoid a tangled codebase.
- Can later split modules if needed.

### Six-Member Feature Ownership

Decision: Development is split across six feature owners with approximately equal workloads.

Why: The team size changed from five to six, and the previous split left some members with smaller or simpler work. The new split distributes features more evenly while keeping Member 1 responsible for essential foundation work and the Library feature.

Alternatives considered:

- Keep five-member split.
- Layer-based frontend/backend/database ownership.

Trade-offs:

- Feature ownership reduces handoff delays and merge conflicts.
- Member 1 has foundational dependencies, so their work must start first.
- Shared contracts must be agreed early.

## 3. Architecture Summary

- Frontend: React, Vite, Tailwind CSS.
- Backend: Node.js, Express.
- Database: PostgreSQL hosted on Supabase.
- ORM: Prisma.
- File storage: Cloudinary.
- Notifications: in-app database-backed notifications for first release.
- Auth: JWT and bcrypt password hashing.
- Authorization: role-based access control plus ownership checks.
- Deployment: free-tier frontend hosting, free-tier backend hosting, Supabase Postgres, Cloudinary.
- AI workflow: Codex with `AGENTS.md`.

## 4. Major Components

- Frontend SPA.
- Express API.
- Prisma data access layer.
- PostgreSQL database.
- Cloudinary file storage service.
- Authentication and RBAC middleware.
- Notification service.
- Audit service.
- CSV import service.
- Dashboard aggregation services.

## 5. Module Breakdown

### Member 1 - Foundation and Library

- Project foundation.
- Prisma setup.
- Auth.
- RBAC middleware.
- Shared response/error helpers.
- Shared Prisma client.
- Audit foundation.
- Library catalog/search/borrowing/returns.

### Member 2 - LMS Courses and Content

- Courses.
- Enrollment.
- Course content.
- Cloudinary learning-material uploads.
- Course list/detail UI.

### Member 3 - Assignments and Submissions

- Assignments.
- Assignment submissions.
- Submission upload.
- Grading.
- Grade audit and grade notification trigger.

### Member 4 - Quizzes and Assessment Engine

- Quiz builder.
- Questions and options.
- Quiz attempts.
- Server-side timing.
- Attempt history.
- Basic anti-cheating controls.

### Member 5 - SIS Operations

- Attendance.
- Attendance correction.
- Timetable.
- Student profile summary.
- Admin/teacher/student dashboards.

### Member 6 - Communication and User Administration

- Announcements.
- Events.
- In-app notifications.
- Notification bell/inbox.
- Admin user management.
- Student/teacher manual creation.
- CSV bulk import.

## 6. Data Flow

### Authentication

1. User submits credentials.
2. Backend verifies password.
3. Backend returns JWT and profile.
4. Frontend sends JWT on protected requests.
5. Auth middleware attaches `req.user`.

### Course Learning Flow

1. Admin creates/imports users.
2. Teacher creates course.
3. Admin enrolls students.
4. Teacher uploads content to Cloudinary.
5. Students view enrolled course content.

### Assignment Flow

1. Teacher creates assignment.
2. Student uploads submission.
3. Teacher grades submission.
4. System writes audit log and notification.

### Quiz Flow

1. Teacher creates quiz and questions.
2. Student starts attempt.
3. Server sets start and expiry timestamps.
4. Questions/options are randomized.
5. Server grades submission and preserves attempt history.

### SIS Flow

1. Teacher marks attendance.
2. Attendance is stored without hard deleting history.
3. Corrections are audited.
4. Timetable and dashboards read related course, user, attendance, assignment, and quiz data.

### Communication Flow

1. Admin/teacher creates announcement or admin creates event.
2. Backend targets audience.
3. Notifications are created.
4. Frontend notification bell reads unread counts.

### Library Flow

1. Admin manages books and copies.
2. Student searches catalog.
3. Student requests borrowing.
4. Admin approves/rejects request.
5. Approved request creates loan and marks copy borrowed.
6. Return updates loan and copy status.

## 7. API Boundaries

All API routes use `/api`.

Standard response:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

Route groups:

- `/api/auth`
- `/api/users`
- `/api/students`
- `/api/teachers`
- `/api/courses`
- `/api/content`
- `/api/assignments`
- `/api/submissions`
- `/api/quizzes`
- `/api/attempts`
- `/api/attendance`
- `/api/timetable`
- `/api/announcements`
- `/api/events`
- `/api/notifications`
- `/api/library/books`
- `/api/library/requests`
- `/api/library/loans`
- `/api/dashboard`

## 8. Service Boundaries

Internal services:

- `AuthService`
- `UserService`
- `CourseService`
- `ContentService`
- `AssignmentService`
- `QuizService`
- `SisService`
- `CommunicationService`
- `NotificationService`
- `LibraryService`
- `FileStorageService`
- `AuditService`
- `DashboardService`

Decision: Services remain internal to one backend.

Why: This keeps deployment simple while teaching modular architecture.

## 9. Database Design Recommendations

Use Prisma models for:

- `User`
- `Student`
- `Teacher`
- `Course`
- `CourseEnrollment`
- `ContentItem`
- `Assignment`
- `AssignmentSubmission`
- `Quiz`
- `QuizQuestion`
- `QuizOption`
- `QuizAttempt`
- `QuizAnswer`
- `Attendance`
- `TimetableSlot`
- `Announcement`
- `Event`
- `Notification`
- `AuditLog`
- `LibraryBook`
- `LibraryBookCopy`
- `LibraryBorrowRequest`
- `LibraryLoan`

Recommended Prisma rules:

- Use UUID primary keys.
- Add `createdAt` and `updatedAt` where useful.
- Use enums for roles, statuses, content types, attendance statuses, request statuses, loan statuses, and notification types.
- Add indexes in Prisma schema for role/status/date/search-heavy fields.
- Preserve records through `isActive`, `archivedAt`, or status fields.
- Use Prisma transactions for multi-step workflows.

Critical transactions:

- User creation with student/teacher profile.
- Bulk import.
- Assignment grading plus audit/notification.
- Quiz submission plus answers/results.
- Attendance correction plus audit.
- Borrow approval plus copy status plus loan creation.
- Book return plus copy status plus audit.

## 10. Security Design

- Public registration is disabled.
- Admin controls user creation/import.
- JWT required for protected APIs.
- RBAC enforced in middleware.
- Ownership checks enforced in services.
- Passwords hashed with bcrypt.
- Sensitive records audited.
- Students access only their own records.
- Teachers access only owned-course records.
- Admin manages user administration, events, library administration, and system dashboards.
- Correct quiz answers are never leaked to students before allowed.
- Cloudinary uploads are performed through backend-controlled logic.

## 11. Scalability Design

Target:

- Up to 5,000 users.
- Up to 1,000 courses.
- Tens of thousands of uploaded files.
- 100-300 concurrent quiz takers.

Measures:

- Stateless backend.
- Prisma indexes and pagination.
- Prisma transactions for consistency.
- Cloudinary for files.
- Supabase Postgres for managed database.
- Dashboard endpoints designed as aggregate reads.
- Notification unread-count endpoint.
- Avoid Redis/job queues in first release.

Trade-off:

- The first release stays simpler and free-tier friendly.
- Queues/caching may be added later if needed.

## 12. Deployment Design

- Frontend: Vercel or equivalent free static host.
- Backend: Render or equivalent free Node host.
- Database: Supabase PostgreSQL.
- File storage: Cloudinary.

Environment variables:

- `DATABASE_URL`
- `DIRECT_URL` if Prisma/Supabase migration setup requires it.
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLIENT_URL`
- `NODE_ENV`
- `PORT`

Deployment steps:

1. Configure Supabase.
2. Configure Cloudinary.
3. Run Prisma migrations.
4. Deploy backend.
5. Deploy frontend.
6. Seed initial admin.
7. Run smoke tests.

## 13. Monitoring and Logging

- Use structured backend logs.
- Add request logs with method, path, status, duration, and user id when available.
- Store audit logs in database.
- Use platform logs for free-tier hosting.
- Add frontend error boundary.
- Log Cloudinary upload failures.
- Add a health endpoint.

## 14. Risks and Future Improvements

Risks:

- Prisma reduces raw SQL learning.
- Full feature scope is large.
- Member 1 has early dependency pressure.
- Supabase and Cloudinary free limits may constrain usage.
- Quiz timing and concurrent attempts need careful tests.
- Cross-feature dashboards may create integration friction.

Future improvements:

- Dedicated librarian role.
- Push notifications.
- Parent/guardian portal.
- Redis/job queue.
- Full-text search.
- More advanced quiz anti-cheating.
- Co-teaching.
- Automated backups and restore drills.
