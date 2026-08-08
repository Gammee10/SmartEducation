# Member 1 Handoff - Foundation, Auth, Audit, Library

## Shared Files To Give Codex

Feed Codex these shared files together with this member file:

- `AGENTS.md`
- `docs/FINAL_ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/DEVELOPMENT_HANDOFF_PACKAGE.md`

## Feature Ownership

You own the essential platform foundation plus the Library feature.

Features:

- Prisma setup.
- Shared Prisma client.
- Express backend foundation if not present.
- Standard API response/error helpers.
- Authentication.
- JWT verification.
- Role-based access middleware.
- Audit log foundation.
- Library catalog.
- Book search.
- Borrowing requests.
- Borrowing history.
- Return tracking.
- Basic Admin library administration.

## Responsibilities

- Create or update `backend/prisma/schema.prisma` foundation models.
- Create shared auth, RBAC, response, error, and audit utilities.
- Ensure other members can safely build on the foundation.
- Implement Library database models, backend APIs, frontend pages, validation, security, tests, and docs.

## Database Scope

Prisma models:

- `User`
- `Student`
- `Teacher`
- `AuditLog`
- `LibraryBook`
- `LibraryBookCopy`
- `LibraryBorrowRequest`
- `LibraryLoan`

Use enums for:

- user roles
- library book copy status
- borrow request status
- loan status

Use indexes for:

- user email
- user role/status
- book title, author, isbn
- copy availability
- student loan history

## API Scope

- `POST /api/auth/login`
- `GET /api/auth/me`
- `/api/library/books`
- `/api/library/requests`
- `/api/library/loans`

## Codex Implementation Prompt

```text
You are Codex implementing Member 1's ownership for the Smart Education System.

Before making changes, analyze the repository first. Read AGENTS.md, docs/FINAL_ARCHITECTURE.md, docs/IMPLEMENTATION_PLAN.md, docs/DEVELOPMENT_HANDOFF_PACKAGE.md, package files, existing backend/frontend structure, and any Prisma files. Follow existing architecture and conventions. Avoid breaking existing functionality.

Project context:
- The Smart Education System is a pilot-ready platform for Ethiopian high schools.
- Users are Admin, Teacher, and Student.
- Architecture is a modular monolith.
- Frontend uses React, Vite, and Tailwind CSS.
- Backend uses Node.js and Express.
- Database is PostgreSQL on Supabase using Prisma ORM.
- File storage uses Cloudinary.
- API response shape is { success, message, data }.
- Development uses feature-based ownership.

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
- Set up Prisma if it is not present.
- Create or update Prisma schema for User, Student, Teacher, AuditLog, LibraryBook, LibraryBookCopy, LibraryBorrowRequest, and LibraryLoan.
- Add required enums, indexes, relations, createdAt/updatedAt fields, and soft-delete/status fields.
- Implement login and current-user endpoint.
- Implement auth and role middleware.
- Implement reusable audit helper/service.
- Implement Library catalog/search, borrow requests, approve/reject, loans, returns, and student borrowing history.
- Use Prisma transactions for borrow approval and return tracking.
- Build frontend login, protected routes, Library catalog, student borrowing history, and Admin Library management UI.
- Validate all inputs.
- Enforce Admin-only Library administration.
- Enforce student-only own-history access.
- Write tests for auth, RBAC, audit helper, and Library workflows.
- Update documentation.

Security:
- No public registration.
- Never return password hashes.
- JWT required for protected routes.
- Audit sensitive Library actions.
- Avoid hard deleting historical records.

Definition of Done:
- Foundation enables other members.
- Auth works for Admin, Teacher, and Student.
- Library works end to end.
- Tests pass.
- Documentation updated.
- Existing functionality remains intact.
```
