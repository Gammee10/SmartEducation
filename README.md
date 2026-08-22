# 🎓 Smart Education System

> **A pilot-ready full-stack platform for Ethiopian high schools** — built as a modular monolith with React, Express, and PostgreSQL.

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)

---

## ✨ What's Inside

A complete digital school platform with **five feature modules already built** and working end-to-end:

| 🏗️ Module | 📦 Status | 🎯 What it does |
|---|---|---|
| 🔐 **Foundation, Auth & Library** | ✅ Member 1 | JWT auth, RBAC (Admin/Teacher/Student), audit logging, library catalog, borrow requests, loans & returns |
| 📚 **LMS Courses & Content** | ✅ Member 2 | Course creation, enrollment, content uploads (Cloudinary), course detail pages |
| 📝 **Assignments & Grading** | ✅ Member 3 | Assignment creation, student submissions (text + files), teacher grading with feedback & notifications |
| 🧠 **Quizzes & Assessment** | ✅ Member 4 | Quiz builder, timed attempts, auto-grading, answer secrecy, attempt limits, results & notifications |
| 📊 **SIS, Attendance & Dashboards** | ✅ Member 5 | Attendance marking & corrections, weekly timetable with conflict detection, role-specific dashboards, student profiles |
| 💬 **Communication & Users** | 🚧 Member 6 | *Coming next* |

---

## 🚀 Quick Start

Get the whole platform running in **under 5 minutes**:

### 1. Prerequisites

- [Node.js](https://nodejs.org) **>= 18**
- A PostgreSQL database — [Supabase](https://supabase.com) is recommended (free tier works great)

### 2. Install & configure

```bash
# Clone the repo
git clone https://github.com/Gammee10/SmartEducation.git
cd SmartEducation

# Install all dependencies (backend + frontend workspaces)
npm install

# Configure environment
cd backend
cp .env.example .env
# ✏️ Edit .env with your DATABASE_URL, DIRECT_URL, and JWT_SECRET
cd ..
```

### 3. Set up the database

```bash
# Create the database schema
npm run prisma:migrate

# Seed demo users + sample library books
npm run prisma:seed
```

### 4. Start the platform 🎉

```bash
# Terminal 1 — Backend API (http://localhost:5000)
npm run dev:backend

# Terminal 2 — Frontend app (http://localhost:5173)
npm run dev:frontend
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser and log in!

---

## 👤 Demo Accounts

| Role | Email | Password | Can do |
|---|---|---|---|
| 🛡️ **Admin** | `admin@school.edu` | `Password123!` | Manage library, enroll students, view everything |
| 👩‍🏫 **Teacher** | `teacher@school.edu` | `Password123!` | Create courses, upload content, assign & grade, build quizzes |
| 🧑‍🎓 **Student** | `student@school.edu` | `Password123!` | Browse courses, submit work, take quizzes, borrow books |

---

## 🧩 Feature Tour

### 🔐 Authentication & Roles
- JWT-based login with bcrypt-hashed passwords
- Role-based access control enforced **server-side** (never trust the frontend!)
- No public registration — admins control user creation
- Every sensitive action is written to an **audit log**

### 📚 Library
- Full book catalog with search by title/author/ISBN
- Copy-level tracking (available, borrowed, lost, damaged)
- Student borrow requests → admin approval → loan with due dates
- Return tracking with full history — **no hard deletes**

### 📖 LMS Courses & Content
- Teachers create courses with subject, grade level, and status
- Admins enroll/unenroll students
- Content items (video, PDF, document, image, link) uploaded through **Cloudinary**
- Students see only their enrolled, active courses

### 📝 Assignments
- Teachers create assignments with instructions, max score, and due dates
- Students submit text and/or files (up to 50MB via Cloudinary)
- Late submissions automatically flagged
- Teachers grade with score + feedback → student gets an in-app **notification**

### 🧠 Quizzes
- Teachers build quizzes with single/multiple-choice questions and point values
- Configurable time limits, max attempts, and question/option shuffling
- **Server-side timing enforcement** — attempts auto-expire
- **Auto-grading** with exact-match anti-cheating logic
- Correct answers are **never leaked** to students before submission
- Results trigger `QUIZ_RESULT` notifications

### 📊 SIS: Attendance, Timetable & Dashboards
- Teachers **mark attendance per course per day** (Present / Absent / Late / Excused) in bulk
- Attendance corrections are **audited** with before/after snapshots
- Students see their own attendance history and rate; teachers only their own courses
- Weekly **timetable** grouped by day — admins create/delete slots with automatic **room & teacher conflict detection**
- Role-specific dashboards:
  - **Admin**: school-wide stats (courses, students, teachers, attendance rate, average scores)
  - **Teacher**: course list with counts + recent submissions & grades
  - **Student**: enrollment stats, attendance rate, average scores, course links
- **Student profile page**: summary stats, courses, recent quiz attempts, full attendance history

---

## 🗂️ Project Structure

```
SmartEducation/
├── backend/                    # Express API (TypeScript)
│   ├── prisma/
│   │   ├── schema.prisma       # Database source of truth (20+ models)
│   │   └── seed.ts             # Demo users + sample data
│   ├── src/
│   │   ├── config/             # Environment configuration
│   │   ├── controllers/        # HTTP request handlers
│   │   ├── middleware/         # Auth, RBAC, error handler
│   │   ├── routes/             # Express route definitions
│   │   ├── services/           # Business logic (auth, library, courses, assignments, quizzes, attendance, timetable, dashboards)
│   │   ├── utils/              # Response/error helpers
│   │   ├── app.ts              # Express app
│   │   └── index.ts            # Server entry
│   └── tests/                  # Node test runner tests (150 passing)
└── frontend/                   # React SPA (TypeScript + Vite + Tailwind)
    └── src/
        ├── api/                # Axios client with JWT interceptor
        ├── components/         # Layout, ProtectedRoute
        ├── context/            # AuthContext
        ├── pages/              # Login, Dashboard, Courses, Assignments, Quizzes, Library, Timetable, Attendance, Student Profile
        └── types/              # Shared TypeScript types
```

---

## 🔌 API Overview

All responses use a consistent shape:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

### 🔐 Auth
| Method | Endpoint | Description | Access |
|---|---|---|---|
| POST | `/api/auth/login` | Login and get JWT | Public |
| GET | `/api/auth/me` | Get current user | Auth |

### 📚 Library
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/api/library/books` | List/search books | Auth |
| GET | `/api/library/books/:id` | Book detail | Auth |
| POST | `/api/library/books` | Create book | Admin |
| PUT | `/api/library/books/:id` | Update book | Admin |
| POST | `/api/library/books/:id/copies` | Add copies | Admin |
| POST | `/api/library/requests` | Submit borrow request | Student |
| GET | `/api/library/requests/mine` | My requests | Student |
| GET | `/api/library/requests` | All requests | Admin |
| POST | `/api/library/requests/:id/decide` | Approve/reject | Admin |
| GET | `/api/library/loans/mine` | My loans | Student |
| GET | `/api/library/loans` | All loans | Admin |
| POST | `/api/library/loans/:id/return` | Record return | Admin |

### 📖 Courses & Content
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/api/courses` | List courses | Auth |
| GET | `/api/courses/:id` | Course detail | Auth |
| POST | `/api/courses` | Create course | Teacher |
| PUT | `/api/courses/:id` | Update course | Teacher |
| POST | `/api/courses/:id/enroll` | Enroll student | Admin |
| POST | `/api/courses/:id/unenroll` | Unenroll student | Admin |
| GET | `/api/courses/:id/content` | List content | Auth |
| POST | `/api/courses/:courseId/content` | Upload content | Teacher |
| POST | `/api/courses/content/:id/archive` | Archive content | Teacher |

### 📝 Assignments
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/api/courses/:id/assignments` | List course assignments | Auth |
| POST | `/api/courses/:id/assignments` | Create assignment | Teacher |
| GET | `/api/assignments/:id` | Assignment detail | Auth |
| PUT | `/api/assignments/:id` | Update assignment | Teacher |
| POST | `/api/assignments/:id/archive` | Archive assignment | Teacher |
| POST | `/api/assignments/:id/submit` | Submit work (text/file) | Student |
| GET | `/api/assignments/:id/submissions` | List submissions | Teacher |
| POST | `/api/submissions/:id/grade` | Grade submission | Teacher |

### 🧠 Quizzes
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/api/courses/:id/quizzes` | List course quizzes | Auth |
| POST | `/api/courses/:id/quizzes` | Create quiz | Teacher |
| GET | `/api/quizzes/:id` | Quiz detail (answers hidden for students) | Auth |
| PUT | `/api/quizzes/:id` | Update quiz | Teacher |
| POST | `/api/quizzes/:id/archive` | Archive quiz | Teacher |
| POST | `/api/quizzes/:id/questions` | Add question | Teacher |
| PUT | `/api/quizzes/questions/:questionId` | Update question | Teacher |
| DELETE | `/api/quizzes/questions/:questionId` | Delete question | Teacher |
| POST | `/api/quizzes/:id/attempt` | Start attempt | Student |
| POST | `/api/attempts/:id/submit` | Submit & auto-grade | Student |
| GET | `/api/attempts/:id` | Attempt detail | Auth |
| GET | `/api/quizzes/:id/results` | Quiz results | Auth |

### 📊 SIS - Attendance, Timetable & Dashboards
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/api/courses/:id/attendance` | Course attendance by date | Auth (role-filtered) |
| POST | `/api/attendance/upsert` | Mark attendance (bulk or single) | Teacher |
| PUT | `/api/attendance/:id` | Correct a record (audited) | Teacher/Admin |
| GET | `/api/students/:id/attendance` | Student attendance history | Self/Teacher/Admin |
| GET | `/api/timetable` | Weekly timetable slots | Auth (role-filtered) |
| POST | `/api/timetable` | Create slot (conflict-checked) | Admin |
| PUT | `/api/timetable/:id` | Update slot | Admin |
| DELETE | `/api/timetable/:id` | Delete slot | Admin |
| GET | `/api/dashboard/admin` | School-wide stats | Admin |
| GET | `/api/dashboard/teacher` | Teacher stats & activity | Teacher |
| GET | `/api/dashboard/student` | Student stats & courses | Student |
| GET | `/api/students/:id/summary` | Academic profile summary | Self/Teacher/Admin |

### 🩺 Health
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Service health check |

---

## 🧪 Testing

```bash
# Run the full backend test suite (150 tests)
npm run test:backend
```

**Coverage includes:**
- ✅ Response/error helpers
- ✅ RBAC middleware
- ✅ Auth service (login, current user, sanitization)
- ✅ Audit service
- ✅ Library workflows (catalog, requests, approvals, loans, returns)
- ✅ Course & enrollment workflows
- ✅ Assignment submission & grading
- ✅ Quiz creation, answer secrecy, attempt limits, expiry, and scoring
- ✅ Attendance marking, corrections with audit trail, and history access control
- ✅ Timetable slot CRUD with room/teacher conflict detection
- ✅ Admin/teacher/student dashboard aggregation

---

## 🛡️ Security

- 🔒 **No public registration** — admins control user creation
- 🔑 Passwords hashed with **bcrypt**
- 🎫 JWT required for all protected routes
- 👮 RBAC enforced **server-side** (Admin/Teacher/Student)
- 🧑‍🎓 Students can only access their **own** borrowing history, submissions, and attempts
- 🕵️ Correct quiz answers are **never exposed** to students before submission
- ⏱️ Quiz timing and attempt limits enforced **server-side**
- 📝 Sensitive actions are **audited**
- 🗄️ No hard deletion of historical records

---

## 🗺️ Roadmap

| Phase | Module | Status |
|---|---|---|
| 1 | Foundation, Auth, RBAC, Audit, Library | ✅ **Done** |
| 2 | LMS Courses, Enrollment, Content | ✅ **Done** |
| 3 | Assignments, Submissions, Grading | ✅ **Done** |
| 4 | Quizzes, Attempts, Assessment Engine | ✅ **Done** |
| 5 | SIS, Attendance, Timetable, Dashboards | ✅ **Done** |
| 6 | Communication, Notifications, User Admin | ⏳ Planned |
| 7 | Cross-module integration & deployment | ⏳ Planned |

---

## 🤝 Contributing

This project is built by a team of six members using **feature-based ownership**. Each member works on their own branch and merges via pull requests in a defined order.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

> ⚠️ **Merge order matters** — see `TEAM_WORK_ORDER.md` for the dependency order.

---

## 📚 Documentation

| Document | Description |
|---|---|
| [`docs/FINAL_ARCHITECTURE.md`](docs/FINAL_ARCHITECTURE.md) | System architecture & design decisions |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) | Implementation phases & exit criteria |
| [`docs/DEVELOPMENT_HANDOFF_PACKAGE.md`](docs/DEVELOPMENT_HANDOFF_PACKAGE.md) | Team handoff packages |
| [`TEAM_WORK_ORDER.md`](TEAM_WORK_ORDER.md) | Merge order & team coordination |
| [`member-handoff-packages/`](member-handoff-packages/) | Per-member Codex handoff files |

---

## 📄 License

This project is for educational use. Built with ❤️ for Ethiopian high schools.