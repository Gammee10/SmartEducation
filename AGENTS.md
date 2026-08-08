# Smart Education System - Codex Instructions

This repository uses Codex as the primary AI development agent.

## Project Baseline

Build a pilot-ready Smart Education System for Ethiopian high schools.
The first deployed version includes LMS, SIS, Communication, Library, testing, and deployment.

## Core Architecture Decisions

- Use a modular monolith, not microservices.
- Use React, Vite, and Tailwind CSS for the frontend.
- Use Node.js and Express for the backend.
- Use PostgreSQL with Prisma ORM.
- Use Supabase as the managed PostgreSQL-compatible database target.
- Use Cloudinary for persistent uploaded file storage.
- Use in-app notifications for the first release; push notifications are deferred.
- Use soft deletion/archival for students, teachers, and academic records.
- Use administrator-controlled user creation with CSV bulk import.
- Use a standardized API response shape:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

Paginated endpoints may additionally include pagination metadata.

## Agent Workflow

- Read this `AGENTS.md` before creating or changing files.
- Keep changes scoped to the requested module.
- Prefer simple, explicit code over clever abstractions.
- Do not introduce new packages without a clear reason.
- Keep database access in service/repository files through the shared Prisma client.
- Do not instantiate PrismaClient outside the approved shared database client.
- Validate request input before database writes.
- Never commit `.env` files, secrets, API keys, or passwords.
- Preserve user changes already present in the workspace.

## Sensitive Data Rules

Grades, attendance, quiz attempts, borrowing history, and user archival events are sensitive records.
Changes to these records must be authorized and auditable.

## Codex Terminology

Use Codex-oriented documentation and task language.
Do not add new Claude-specific instructions, filenames, prompts, or workflow names.
