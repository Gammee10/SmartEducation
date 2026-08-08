# Team Work Order - Smart Education System

This file explains when each member should build, push, and merge their work.

Important rule:

- Members may push their own feature branches to GitHub at any time.
- Members should not merge into `main` in any random order.
- Merge order matters because some features depend on earlier foundation work.

## Required Shared Files

Every member should give Codex:

- the pulled project codebase folder
- `AGENTS.md`
- `docs/FINAL_ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/DEVELOPMENT_HANDOFF_PACKAGE.md`
- their own member file from `member-handoff-packages/`

## Recommended Timeline

| Stage | Member | Builds | Can Work? | Merge Order |
|---|---|---|---|---|
| 1 | M1 | Prisma setup, auth, RBAC, shared helpers, audit foundation | Starts first | Merge first |
| 2 | M2 | Courses, enrollment, content, Cloudinary | Can draft after M1 contracts, finish after M1 merge | Merge second |
| 3 | M6 | User admin, notifications, announcements/events | Can draft after M1 contracts, finish after M1 merge | Merge third |
| 4 | M3 | Assignments, submissions, grading | Can draft after M2 contracts, finish after M2 merge | Merge fourth |
| 5 | M4 | Quizzes, attempts, assessment engine | Can draft after M2 contracts, finish after M2 merge | Merge fifth |
| 6 | M5 | Attendance, timetable, dashboards, student summary | Can draft after M2 contracts, finish after M3/M4 APIs stabilize | Merge sixth |
| 7 | M1 | Library feature, if split from foundation PR | Can continue in parallel after foundation | Merge after foundation, preferably before final integration |
| 8 | All | Integration fixes, documentation, deployment | After all feature PRs | Merge final |

## Best Practical Flow

1. M1 opens the foundation PR first:
   - Prisma setup
   - shared Prisma client
   - auth
   - RBAC
   - response/error helpers
   - audit foundation

2. M1 may split Library into a second PR:
   - PR 1: `foundation/auth/prisma/audit`
   - PR 2: `library`

3. After M1 foundation merges:
   - M2 can merge LMS courses/content.
   - M6 can merge user admin/communication/notifications.

4. After M2 merges:
   - M3 can merge assignments.
   - M4 can merge quizzes.

5. After M3 and M4 stabilize:
   - M5 can merge dashboards/student summary.

6. After all feature PRs:
   - Create final integration PR.
   - Fix cross-module bugs.
   - Run final tests.
   - Prepare deployment.

## Branch Names

| Member | Branch |
|---|---|
| M1 | `feature/m1-foundation-library` |
| M2 | `feature/m2-lms-content` |
| M3 | `feature/m3-assignments` |
| M4 | `feature/m4-quizzes` |
| M5 | `feature/m5-sis-dashboards` |
| M6 | `feature/m6-comm-users` |
| All | `integration/full-system` |

## Member Workflow

Each member should do this before starting or continuing work:

```bash
git checkout main
git pull origin main
git checkout -b feature/member-branch-name
```

If the branch already exists:

```bash
git checkout main
git pull origin main
git checkout feature/member-branch-name
git merge main
```

## Pull Request Rules

Each PR must include:

- feature summary
- Prisma schema changes
- API endpoints added or changed
- frontend pages/components added
- tests added
- tests run
- screenshots for UI work
- known limitations

Do not merge until:

- the PR is reviewed
- tests pass
- the dependency order is satisfied
- merge conflicts are resolved

## Simple Rule To Remember

Push branches anytime.

Merge to `main` only in this order:

```text
M1 foundation -> M2 -> M6 -> M3 -> M4 -> M5 -> M1 library if separate -> final integration
```

