# Member 4 Handoff - Quizzes, Attempts, Assessment Engine

## Shared Files To Give Codex

Feed Codex these shared files together with this member file:

- `AGENTS.md`
- `docs/FINAL_ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/DEVELOPMENT_HANDOFF_PACKAGE.md`

## Feature Ownership

You own the quiz and assessment engine.

Features:

- Quizzes.
- Quiz questions.
- Quiz options.
- Quiz attempts.
- Quiz answers.
- Server-side time enforcement.
- Attempt history.
- Auto-grading.
- Basic anti-cheating.

## Responsibilities

- Implement Prisma quiz/attempt models.
- Implement quiz builder APIs and UI.
- Implement student quiz-taking flow.
- Enforce server-side timing and attempt limits.
- Ensure correct answers are not leaked.
- Integrate result notifications and audit where appropriate.

## Database Scope

Prisma models:

- `Quiz`
- `QuizQuestion`
- `QuizOption`
- `QuizAttempt`
- `QuizAnswer`

Use enums for:

- question type
- attempt status

Use indexes for:

- course quizzes
- quiz attempts
- student attempts
- status/date fields

## API Scope

- `/api/courses/:id/quizzes`
- `/api/quizzes/:id`
- `/api/quizzes/:id/questions`
- `/api/quizzes/:id/attempt`
- `/api/attempts/:id/submit`
- `/api/quizzes/:id/results`

## Codex Implementation Prompt

```text
You are Codex implementing Member 4's ownership for the Smart Education System.

Before making changes, analyze the repository first. Read AGENTS.md, docs/FINAL_ARCHITECTURE.md, docs/IMPLEMENTATION_PLAN.md, docs/DEVELOPMENT_HANDOFF_PACKAGE.md, existing Prisma schema, backend structure, frontend structure, and conventions. Reuse existing helpers/components. Avoid breaking existing functionality.

Project context:
- Smart Education System is a pilot-ready school platform.
- Frontend uses React, Vite, Tailwind CSS.
- Backend uses Node.js and Express.
- Database is PostgreSQL on Supabase using Prisma ORM.
- API response shape is { success, message, data }.

Your ownership:
- Quizzes.
- Quiz questions and options.
- Attempts and answers.
- Server-side timing.
- Auto-grading.
- Basic anti-cheating.

Requirements:
- Add or update Prisma models/enums for Quiz, QuizQuestion, QuizOption, QuizAttempt, and QuizAnswer.
- Implement quiz creation and question management for teachers on owned courses.
- Implement start-attempt for enrolled students.
- Randomize questions and answer options.
- Enforce max attempts and server-side expiry.
- Implement submit-attempt and auto-grading.
- Preserve attempt history.
- Never expose correct answers to students before allowed.
- Trigger result notification using Member 6 notification service when available.
- Use Member 1 audit helper for sensitive attempt/result records where appropriate.
- Build quiz builder, take-quiz page, result page, and teacher results page.
- Write tests for quiz creation, answer secrecy, attempt limits, expiry, scoring, and authorization.
- Update documentation.

Security:
- Teacher manages quizzes only for owned courses.
- Student attempts only enrolled-course quizzes.
- Correct answers must not leak.
- Time and attempt limits must be enforced by the server.

Definition of Done:
- Quiz workflows work end to end.
- Timing and attempt rules are enforced server-side.
- Tests pass.
- Documentation updated.
- Existing functionality remains intact.
```
