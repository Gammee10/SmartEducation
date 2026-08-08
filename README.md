# Smart Education System

A pilot-ready full-stack platform for Ethiopian high schools. This repository contains the Member 1 implementation: Foundation, Auth, RBAC, Audit, and Library.

## Tech Stack

- **Frontend:** React, Vite, Tailwind CSS
- **Backend:** Node.js, Express
- **Database:** PostgreSQL (Supabase) with Prisma ORM
- **Auth:** JWT + bcrypt
- **File storage:** Cloudinary (deferred for Member 1 scope)

## Project Structure

```
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma    # Database source of truth
│   │   ├── client.js        # Shared Prisma client (single instance)
│   │   └── seed.js          # Initial admin/teacher/student + sample books
│   ├── src/
│   │   ├── config/          # Environment configuration
│   │   ├── controllers/     # HTTP request handlers
│   │   ├── middleware/      # Auth, RBAC, error handler
│   │   ├── routes/          # Express route definitions
│   │   ├── services/        # Business logic (auth, audit, library)
│   │   ├── utils/           # Response/error helpers
│   │   ├── app.js           # Express app
│   │   └── index.js         # Server entry
│   └── tests/               # Node test runner tests
└── frontend/
    └── src/
        ├── api/             # Axios client with JWT interceptor
        ├── components/      # Layout, ProtectedRoute
        ├── context/         # AuthContext
        └── pages/           # Login, Dashboard, Library pages
```

## Getting Started

### Prerequisites

- Node.js >= 18
- PostgreSQL database (Supabase recommended)

### Setup

1. **Install dependencies**

```bash
npm install
```

2. **Configure environment**

```bash
cd backend
cp .env.example .env
# Edit .env with your DATABASE_URL, DIRECT_URL, and JWT_SECRET
```

3. **Run Prisma migrations**

```bash
npm run prisma:migrate
```

4. **Seed the database**

```bash
npm run prisma:seed
```

5. **Start the backend**

```bash
npm run dev:backend
```

6. **Start the frontend** (in a separate terminal)

```bash
npm run dev:frontend
```

### Demo Accounts (seeded)

| Role    | Email                 | Password      |
|---------|-----------------------|---------------|
| Admin   | admin@school.edu      | Password123!  |
| Teacher | teacher@school.edu    | Password123!  |
| Student | student@school.edu    | Password123!  |

## API Endpoints

### Auth

| Method | Endpoint        | Description          | Access |
|--------|-----------------|----------------------|--------|
| POST   | /api/auth/login | Login and get JWT    | Public |
| GET    | /api/auth/me    | Get current user     | Auth   |

### Library

| Method | Endpoint                          | Description                    | Access  |
|--------|-----------------------------------|--------------------------------|---------|
| GET    | /api/library/books                | List/search books              | Auth    |
| GET    | /api/library/books/:id            | Get book detail                | Auth    |
| POST   | /api/library/books                | Create book                    | Admin   |
| PUT    | /api/library/books/:id            | Update book                    | Admin   |
| POST   | /api/library/books/:id/copies     | Add copies                     | Admin   |
| POST   | /api/library/requests             | Submit borrow request          | Student |
| GET    | /api/library/requests/mine        | My borrow requests             | Student |
| GET    | /api/library/requests             | List all requests              | Admin   |
| POST   | /api/library/requests/:id/decide  | Approve/reject request         | Admin   |
| GET    | /api/library/loans/mine           | My loans                       | Student |
| GET    | /api/library/loans                | List all loans                 | Admin   |
| POST   | /api/library/loans/:id/return     | Record return                  | Admin   |

### Health

| Method | Endpoint     | Description      |
|--------|--------------|------------------|
| GET    | /api/health  | Service health   |

## Standard API Response

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

Paginated endpoints include `pagination` metadata:

```json
{
  "success": true,
  "message": "Books retrieved",
  "data": [],
  "pagination": { "page": 1, "pageSize": 20, "total": 5, "totalPages": 1 }
}
```

## Testing

```bash
npm run test:backend
```

Tests cover:
- Response/error helpers
- RBAC middleware
- Auth service (login, current user, sanitization)
- Audit service
- Library workflows (catalog, search, requests, approvals, loans, returns)

## Security

- No public registration - admin controls user creation
- Passwords hashed with bcrypt
- JWT required for protected routes
- RBAC enforced server-side (Admin/Teacher/Student)
- Students can only access their own borrowing history
- Sensitive library actions are audited
- No hard deletion of historical records

## Documentation

- `docs/FINAL_ARCHITECTURE.md` - System architecture
- `docs/IMPLEMENTATION_PLAN.md` - Implementation phases
- `docs/DEVELOPMENT_HANDOFF_PACKAGE.md` - Team handoff packages
- `member-handoff-packages/MEMBER_1_FOUNDATION_AUTH_LIBRARY.md` - Member 1 scope