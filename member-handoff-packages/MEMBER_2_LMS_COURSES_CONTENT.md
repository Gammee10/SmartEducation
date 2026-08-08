# Member 2 Handoff - LMS Courses, Enrollment, Content

## Shared Files To Give Codex

Feed Codex these shared files together with this member file:

- `AGENTS.md`
- `docs/FINAL_ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/DEVELOPMENT_HANDOFF_PACKAGE.md`

## Feature Ownership

You own course delivery and learning materials.

Features:

- Courses.
- Course enrollment.
- Course content.
- Cloudinary-backed learning material uploads.
- Course list UI.
- Course detail content view.

## Responsibilities

- Implement Prisma models for courses, enrollments, and content.
- Implement backend APIs for course and content workflows.
- Implement frontend course and content pages.
- Enforce course ownership and enrollment access.
- Integrate Cloudinary for persistent learning-material storage.

## Database Scope

Prisma models:

- `Course`
- `CourseEnrollment`
- `ContentItem`

Use enums for:

- enrollment status
- content type

Use indexes for:

- teacher/course ownership
- student enrollment
- active/status filtering
- content lookup by course

## API Scope

- `/api/courses`
- `/api/courses/:id/enroll`
- `/api/courses/:id/content`
- `/api/content/:id`

## Codex Implementation Prompt

```text
You are Codex implementing Member 2's ownership for the Smart Education System.

Before making changes, analyze the repository first. Read AGENTS.md, docs/FINAL_ARCHITECTURE.md, docs/IMPLEMENTATION_PLAN.md, docs/DEVELOPMENT_HANDOFF_PACKAGE.md, existing Prisma schema, backend structure, frontend structure, and conventions. Reuse existing helpers/components. Avoid breaking existing functionality.

Project context:
- Smart Education System is a pilot-ready school platform.
- Frontend uses React, Vite, Tailwind CSS.
- Backend uses Node.js and Express.
- Database is PostgreSQL on Supabase using Prisma ORM.
- Cloudinary stores uploaded files.
- API response shape is { success, message, data }.

Your ownership:
- LMS courses.
- Course enrollment.
- Course content.
- Cloudinary-backed learning material uploads.

Requirements:
- Add or update Prisma models/enums for Course, CourseEnrollment, and ContentItem.
- Implement course CRUD with teacher ownership checks.
- Implement Admin enrollment of students into courses.
- Implement role-filtered course listing:
  - Admin sees all active courses.
  - Teacher sees owned courses.
  - Student sees enrolled courses.
- Implement content upload/list/update/archive.
- Integrate Cloudinary for uploaded course materials.
- Build frontend Courses page, Course Detail page, content list, and content upload UI.
- Add loading, error, and empty states.
- Validate course title, subject, grade level, enrollment inputs, and upload type/size.
- Enforce authorization on the backend.
- Write tests for course CRUD, enrollment, content upload, and access control.
- Update documentation.

Security:
- Teacher manages only owned courses.
- Student views only enrolled course content.
- Admin controls enrollment.
- Do not expose Cloudinary secrets.

Definition of Done:
- Teacher can create courses and upload content.
- Admin can enroll students.
- Student sees enrolled course content only.
- Tests pass.
- Documentation updated.
- Existing functionality remains intact.
```
