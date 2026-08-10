# Member 3 Implementation - Assignments, Submissions, Grading

## Status: Complete

This document records the Member 3 implementation for the Smart Education System.

## Delivered Features

### Assignments

- Assignment CRUD for teachers on owned courses.
- Course-scoped assignment listing with role-based filtering:
  - Admin sees all non-archived course assignments.
  - Teacher sees all non-archived assignments on owned courses.
  - Student sees published assignments on active, enrolled courses.
- Assignment status tracking (DRAFT, PUBLISHED, CLOSED, ARCHIVED).
- Assignment detail endpoint with role-based submission visibility.
- Soft archival of assignments (no hard delete of academic records).
- Audit logging for assignment creation, updates, and archival.

### Submissions

- Students submit text answers and/or upload files for enrolled, published assignments.
- Submission files are stored on Cloudinary (folder `assignment-submissions`).
- Late submissions are flagged with `isLate` when the due date has passed.
- One submission per student per assignment (duplicate submission rejected).
- Students only ever see their own submission.

### Grading

- Teachers grade submissions on owned courses.
- Score is validated and can never exceed the assignment max score.
- Feedback is optional.
- Re-grading is supported; every grade change is audited with the previous score.
- Grading, audit log, and student notification are written inside a single Prisma transaction.

### Notifications (contract for Member 6)

- Added a minimal `Notification` model and `notificationService.createNotification()`.
- Grade events create an in-app notification for the student:
  - title: `Assignment graded`
  - message: `Your assignment "<title>" was graded: <score>/<maxScore>`
  - type: `GRADE`
  - metadata: `{ assignmentId, submissionId, score, maxScore }`
- Member 6 owns the full notification feature (bell, inbox, read/unread) and should build on
  the `Notification` model and `createNotification` helper rather than redefine them.

## Database Models

| Model | Purpose |
|-------|---------|
| `Assignment` | Assignment tied to a course, created by a teacher |
| `AssignmentSubmission` | Student submission with Cloudinary file fields and grade |
| `Notification` | In-app notification row (shared contract with Member 6) |

## Enums

- `AssignmentStatus`: DRAFT, PUBLISHED, CLOSED, ARCHIVED
- `SubmissionStatus`: SUBMITTED, GRADED
- `NotificationType`: ASSIGNMENT, GRADE, QUIZ_RESULT, ANNOUNCEMENT, EVENT, GENERAL

## Indexes

- `Assignment`: `[courseId, status]`, `[courseId, dueDate]`, `[status, dueDate]`, `[createdById]`
- `AssignmentSubmission`: unique `[assignmentId, studentId]`, `[assignmentId, status]`, `[studentId, status]`, `[status, submittedAt]`
- `Notification`: `[userId, isRead]`, `[type, createdAt]`

## API Endpoints

### Assignments (course-scoped)

- `GET /api/courses/:id/assignments` - List course assignments (role-filtered)
- `POST /api/courses/:id/assignments` - Create assignment (Teacher owner only)

### Assignments (top-level)

- `GET /api/assignments/:id` - Assignment detail (access-controlled)
- `PUT /api/assignments/:id` - Update assignment (Teacher owner only)
- `POST /api/assignments/:id/archive` - Archive assignment (Teacher owner only)

### Submissions & Grading

- `POST /api/assignments/:id/submit` - Submit assignment (Enrolled Student, multipart file upload)
- `GET /api/assignments/:id/submissions` - List submissions (Teacher owner only)
- `POST /api/submissions/:id/grade` - Grade submission (Teacher owner only)

## Audit Actions

- `ASSIGNMENT_CREATED`, `ASSIGNMENT_UPDATED`, `ASSIGNMENT_ARCHIVED`
- `SUBMISSION_SUBMITTED`
- `SUBMISSION_GRADED` (includes `score`, `maxScore`, `previousScore`, `feedback`)

## Backend Structure

- `src/services/assignmentService.ts` - assignment CRUD, submissions, grading business logic
- `src/services/notificationService.ts` - minimal in-app notification helper (contract for Member 6)
- `src/controllers/assignmentController.ts` - HTTP handlers
- `src/routes/assignmentRoutes.ts` - top-level assignment/submission routes with multer memory storage
- `src/routes/courseRoutes.ts` - course-scoped assignment list/create routes
- `src/services/auditService.ts` - `writeAuditLog` extended with an optional transaction client
  so grading audit entries are written inside the grading transaction (additive, non-breaking)

## Frontend Pages

| Route | Page | Access |
|-------|------|--------|
| `/courses/:id` | CourseDetailPage (assignments section) | Auth (access-controlled) |
| `/courses/:id/assignments/:assignmentId` | AssignmentDetailPage | Auth (access-controlled) |

The assignments section on the course detail page lists assignments, lets teachers create
assignments, and links to the detail page. The detail page provides the student submission UI
(text + file upload) and the teacher grading UI (score + feedback per submission).

## Tests

Run with `npm test` in `backend/`.

| File | Coverage |
|------|----------|
| `assignment.test.ts` | Assignment CRUD, access control, submission, Cloudinary upload, late submissions, grading, score limits, audit, notifications, re-grading |

31 new tests added. Total: 96 tests passing (previous baseline was 65).

## Setup

1. `cd backend && npx prisma db push` (creates `assignments`, `assignment_submissions`, `notifications` tables)
2. `npx prisma generate`
3. `npm run dev:backend`
4. `npm run dev:frontend`

Cloudinary credentials in `backend/.env` are reused by submission file uploads.

## Notes

- Submission uploads use multer with in-memory storage (50MB limit, matching the Cloudinary service).
- Files never touch local disk; they are streamed to Cloudinary.
- The `Notification` model is intentionally minimal so Member 6 can extend it for the full
  notification product without migration workarounds.