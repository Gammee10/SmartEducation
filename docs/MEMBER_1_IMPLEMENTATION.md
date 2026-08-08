# Member 1 Implementation - Foundation, Auth, Audit, Library

## Status: Complete

This document records the Member 1 implementation for the Smart Education System.

## Delivered Features

### Foundation

- Monorepo structure with npm workspaces (`backend`, `frontend`).
- Express backend with modular route structure.
- React + Vite + Tailwind CSS frontend.
- Prisma ORM configured with PostgreSQL.
- Shared Prisma client (`backend/prisma/client.js`) - single instance.
- Standard API response helpers (`success`, `created`, `paginated`).
- Custom error classes (`AppError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ValidationError`, `ConflictError`).
- Central error handler with Prisma error mapping.
- Health endpoint (`GET /api/health`).

### Auth

- `POST /api/auth/login` - login with email/password, returns JWT + sanitized user.
- `GET /api/auth/me` - returns current authenticated user.
- JWT signing with configurable secret and expiry.
- bcrypt password hashing.
- Auth middleware (`authenticate`) - verifies JWT, loads user, attaches `req.user`.
- No public registration.

### RBAC

- `requireRole(...roles)` middleware.
- Convenience wrappers: `requireAdmin`, `requireTeacher`, `requireStudent`.
- Server-side enforcement - never trust frontend.

### Audit

- `writeAuditLog({ actorId, action, entity, entityId, metadata, ipAddress })`.
- `auditLibraryAction(...)` convenience wrapper.
- Audit logs stored in `AuditLog` table.
- Library actions audited: book created/updated, copies added, borrow requested, approved, rejected, loan returned.

### Library

- Book catalog with search (title, author, ISBN) and category filter.
- Book management (Admin): create, update, add copies.
- Borrow requests (Student): create, view own.
- Request management (Admin): list all, approve/reject.
- Loans (Student): view own history.
- Loan management (Admin): list all, record return.
- Prisma transactions for borrow approval and return workflows.
- Copy status tracking (AVAILABLE, BORROWED, LOST, DAMAGED, ARCHIVED).

## Database Models

| Model | Purpose |
|-------|---------|
| `User` | Identity for Admin/Teacher/Student |
| `Student` | Student profile linked to User |
| `Teacher` | Teacher profile linked to User |
| `AuditLog` | Audit trail for sensitive operations |
| `LibraryBook` | Book catalog entry |
| `LibraryBookCopy` | Physical copy of a book |
| `LibraryBorrowRequest` | Student request to borrow a copy |
| `LibraryLoan` | Active/returned loan record |

## Enums

- `UserRole`: ADMIN, TEACHER, STUDENT
- `UserStatus`: ACTIVE, SUSPENDED, ARCHIVED
- `LibraryBookCopyStatus`: AVAILABLE, BORROWED, LOST, DAMAGED, ARCHIVED
- `LibraryBorrowRequestStatus`: PENDING, APPROVED, REJECTED, CANCELLED
- `LibraryLoanStatus`: ACTIVE, RETURNED, OVERDUE

## Shared Contracts for Other Members

### Response Shape

All API responses use:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

Paginated endpoints add:

```json
"pagination": { "page": 1, "pageSize": 20, "total": 5, "totalPages": 1 }
```

### Auth Middleware Usage

```js
const authenticate = require('../middleware/auth');
const { requireRole, requireAdmin } = require('../middleware/rbac');

router.use(authenticate);
router.get('/protected', requireAdmin, handler);
```

`req.user` contains: `{ id, email, fullName, role, status, student, teacher }`.

### Audit Service Usage

```js
const { writeAuditLog } = require('../services/auditService');

await writeAuditLog({
  actorId: req.user.id,
  action: 'YOUR_ACTION',
  entity: 'YourEntity',
  entityId: recordId,
  metadata: { key: 'value' },
  ipAddress: req.ip,
});
```

### Prisma Client

Always import from `../../prisma/client` (relative to `src/`):

```js
const prisma = require('../../prisma/client');
```

Do NOT instantiate `PrismaClient` elsewhere.

## Frontend Pages

| Route | Page | Access |
|-------|------|--------|
| `/login` | LoginPage | Public |
| `/` | DashboardPage | Auth |
| `/library` | LibraryCatalogPage | Auth |
| `/library/my-borrowing` | MyBorrowingPage | Student |
| `/library/admin` | AdminLibraryPage | Admin |

## Tests

Run with `npm run test:backend`.

| File | Coverage |
|------|----------|
| `helpers.test.js` | Response/error helpers |
| `rbac.test.js` | Role middleware |
| `auth.test.js` | Login, current user, sanitization |
| `audit.test.js` | Audit service |
| `library.test.js` | Catalog, search, requests, approvals, loans, returns |

## Setup

1. `npm install`
2. `cd backend && cp .env.example .env` and fill in values
3. `npm run prisma:migrate`
4. `npm run prisma:seed`
5. `npm run dev:backend`
6. `npm run dev:frontend`

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@school.edu | Password123! |
| Teacher | teacher@school.edu | Password123! |
| Student | student@school.edu | Password123! |