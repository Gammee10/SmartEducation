# Member 3 Handoff - Assignments, Submissions, Grading

## Shared Files To Give Codex

Feed Codex these shared files together with this member file:

- `AGENTS.md`
- `docs/FINAL_ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/DEVELOPMENT_HANDOFF_PACKAGE.md`

## Feature Ownership

You own assignment workflows.

Features:

- Assignments.
- Assignment submissions.
- Submission file uploads.
- Grading.
- Grade audit integration.
- Grade notification trigger.

## Responsibilities

- Implement Prisma models for assignments and submissions.
- Implement assignment creation, submission, and grading APIs.
- Implement frontend assignment and grading screens.
- Use Cloudinary for uploaded submission files.
- Integrate with audit and notification services.

## Database Scope

Prisma models:

- `Assignment`
- `AssignmentSubmission`

Use enums for:

- submission status

Use indexes for:

- course assignments
- assignment submissions
- student submissions
- status/date fields

## API Scope

- `/api/courses/:id/assignments`
- `/api/assignments/:id`
- `/api/assignments/:id/submit`
- `/api/assignments/:id/submissions`
- `/api/submissions/:id/grade`

## Codex Implementation Prompt

```text
You are Codex implementing Member 3's ownership for the Smart Education System.

Before making changes, analyze the repository first. Read AGENTS.md, docs/FINAL_ARCHITECTURE.md, docs/IMPLEMENTATION_PLAN.md, docs/DEVELOPMENT_HANDOFF_PACKAGE.md, existing Prisma schema, backend structure, frontend structure, and conventions. Reuse existing helpers/components. Avoid breaking existing functionality.

Project context:
- Smart Education System is a pilot-ready school platform.
- Architecture is a modular monolith.
- Frontend uses React, Vite, Tailwind CSS.
- Backend uses Node.js and Express.
- Database is PostgreSQL on Supabase using Prisma ORM.
- Cloudinary stores uploaded files.
- API response shape is { success, message, data }.

Your ownership:
- Assignments.
- Assignment submissions.
- Submission uploads.
- Grading.
- Grade notification triggers.

Requirements:
- Add or update Prisma models/enums for Assignment and AssignmentSubmission.
- Implement assignment CRUD for teachers on owned courses.
- Implement student submission for enrolled students.
- Implement submission upload through Cloudinary.
- Implement teacher grading.
- Create audit logs for grade changes using Member 1 audit helper.
- Trigger in-app notifications using Member 6 notification service when available.
- Build frontend assignment list, create form, submission UI, and grading UI.
- Validate required fields, due dates, max score, score limits, and submission permissions.
- Enforce server-side authorization.
- Write tests for assignment creation, submission, grading, validation, notifications, audit, and authorization.
- Update documentation.

Security:
- Teacher manages assignments only for owned courses.
- Student submits only for enrolled courses.
- Student sees only own submission.
- Score cannot exceed max score.
- Grade changes must be audited.

Definition of Done:
- Assignment workflows work end to end.
- Grade events are audited and notify students.
- Tests pass.
- Documentation updated.
- Existing functionality remains intact.
```
