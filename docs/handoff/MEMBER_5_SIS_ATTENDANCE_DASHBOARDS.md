# Member 5 Handoff - SIS, Attendance, Timetable, Dashboards

## Shared Files To Give Codex

Feed Codex these shared files together with this member file:

- `AGENTS.md`
- `docs/FINAL_ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/DEVELOPMENT_HANDOFF_PACKAGE.md`

## Feature Ownership

You own SIS operations and dashboards.

Features:

- Attendance.
- Attendance correction.
- Timetable.
- Role dashboards.
- Student academic profile summary.

## Responsibilities

- Implement attendance and timetable Prisma models.
- Implement attendance marking and correction.
- Implement timetable conflict checks.
- Implement dashboard aggregate APIs and UI.
- Implement student academic profile summary.

## Database Scope

Prisma models:

- `Attendance`
- `TimetableSlot`

Use enums for:

- attendance status
- day of week

Use indexes for:

- student/course/date attendance
- course/date attendance reports
- teacher/day timetable lookup
- course timetable lookup

## API Scope

- `/api/courses/:id/attendance`
- `/api/students/:id/attendance`
- `/api/attendance/:id`
- `/api/timetable`
- `/api/dashboard/admin`
- `/api/dashboard/teacher`
- `/api/dashboard/student`
- `/api/students/:id/summary`

## Codex Implementation Prompt

```text
You are Codex implementing Member 5's ownership for the Smart Education System.

Before making changes, analyze the repository first. Read AGENTS.md, docs/FINAL_ARCHITECTURE.md, docs/IMPLEMENTATION_PLAN.md, docs/DEVELOPMENT_HANDOFF_PACKAGE.md, existing Prisma schema, backend structure, frontend structure, and conventions. Reuse existing helpers/components. Avoid breaking existing functionality.

Project context:
- Smart Education System is a pilot-ready school platform.
- Frontend uses React, Vite, Tailwind CSS.
- Backend uses Node.js and Express.
- Database is PostgreSQL on Supabase using Prisma ORM.
- API response shape is { success, message, data }.

Your ownership:
- Attendance.
- Attendance correction.
- Timetable.
- Role dashboards.
- Student academic profile summary.

Requirements:
- Add or update Prisma models/enums for Attendance and TimetableSlot.
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

Security:
- Teacher marks attendance only for owned courses.
- Attendance corrections are sensitive and must be audited.
- Student can access only own dashboard/profile unless Admin/Teacher authorization applies.
- Timetable changes are Admin-only.

Definition of Done:
- Attendance, timetable, dashboards, and student profile summary work end to end.
- Sensitive attendance changes are audited.
- Tests pass.
- Documentation updated.
- Existing functionality remains intact.
```
