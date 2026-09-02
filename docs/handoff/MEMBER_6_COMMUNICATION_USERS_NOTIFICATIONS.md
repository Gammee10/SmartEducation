# Member 6 Handoff - Communication, Notifications, User Admin

## Shared Files To Give Codex

Feed Codex these shared files together with this member file:

- `AGENTS.md`
- `docs/FINAL_ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/DEVELOPMENT_HANDOFF_PACKAGE.md`

## Feature Ownership

You own communication, notifications, user administration, and bulk import.

Features:

- Announcements.
- Events.
- In-app notifications.
- Notification bell.
- Notification inbox.
- Admin user management.
- Student/teacher manual creation.
- CSV bulk import.

## Responsibilities

- Implement communication and notification Prisma models.
- Implement notification service usable by other members.
- Implement announcement/event audience targeting.
- Implement admin user management and import workflows.
- Implement frontend communication, notification, and admin user screens.

## Database Scope

Prisma models:

- `Announcement`
- `Event`
- `Notification`
- Optional `ImportBatch`
- Optional `ImportError`

Use enums for:

- announcement/event audience
- notification type
- import status if import tracking is added

Use indexes for:

- notification unread counts
- announcement/event audience and date filtering
- import batch lookup if used

## API Scope

- `/api/announcements`
- `/api/events`
- `/api/notifications`
- `/api/users`
- `/api/users/import`

## Codex Implementation Prompt

```text
You are Codex implementing Member 6's ownership for the Smart Education System.

Before making changes, analyze the repository first. Read AGENTS.md, docs/FINAL_ARCHITECTURE.md, docs/IMPLEMENTATION_PLAN.md, docs/DEVELOPMENT_HANDOFF_PACKAGE.md, existing Prisma schema, backend structure, frontend structure, and conventions. Reuse existing helpers/components. Avoid breaking existing functionality.

Project context:
- Smart Education System is a pilot-ready school platform.
- Frontend uses React, Vite, Tailwind CSS.
- Backend uses Node.js and Express.
- Database is PostgreSQL on Supabase using Prisma ORM.
- API response shape is { success, message, data }.
- In-app notifications are required for the first release.
- Push notifications are deferred.

Your ownership:
- Announcements.
- Events.
- Notifications.
- Notification bell/inbox.
- Admin user management.
- Student/teacher manual creation.
- CSV bulk import.

Requirements:
- Add or update Prisma models/enums for Announcement, Event, Notification, and optional import tracking models.
- Implement announcements and events with audience targeting.
- Implement notification service usable by other modules.
- Implement notification unread count, mark one read, and mark all read.
- Implement Admin user creation/update/archive for students and teachers.
- Implement CSV bulk import with validation and clear error reporting.
- Build frontend announcements/events pages, notification bell/inbox, user admin pages, and import UI.
- Validate all inputs.
- Enforce no public registration.
- Enforce users only access own notifications.
- Write tests for communication, notifications, user admin, import validation, and authorization.
- Update documentation.

Security:
- Admin controls user creation/import.
- Users read only their own notifications.
- Audience filtering must happen on the backend.
- Password hashes must never be returned.
- Duplicate emails must be rejected.

Definition of Done:
- Communication, notifications, and user admin/import work end to end.
- Other modules can trigger notifications through your service.
- Tests pass.
- Documentation updated.
- Existing functionality remains intact.
```
