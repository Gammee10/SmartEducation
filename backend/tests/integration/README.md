# Integration tests

`npm run test:integration` (from `backend/`) boots the real Express app with
supertest against a **throwaway PostgreSQL database** and covers:

- auth login flow + password change + forged-token rejection
- RBAC 401/403 matrix
- quiz attempt lifecycle (start → resume → submit → limit → results)
- library borrow / approve / return incl. double-approval and double-return races
- pagination bounds

## Setup

The suite expects a local Postgres reachable by Docker (container
`ses-test-pg`, host port **5434**):

```bash
docker run -d --name ses-test-pg -e POSTGRES_PASSWORD=testpw \
  -e POSTGRES_DB=ses_test -p 5434:5432 postgres:16-alpine
```

Prisma migrations are applied automatically before the suite runs.

If the database is not reachable, the whole integration suite **skips
itself** so `npm test` still passes. The configured `DATABASE_URL` /
`DIRECT_URL` (the pilot database) is overridden locally and is never touched.

Override the target with `TEST_DATABASE_URL` if needed.

## CI

A GitHub Actions service container (`postgres:16`) can be wired up later by
setting `TEST_DATABASE_URL` and adding `npm run test:integration` to the CI
workflow once secrets/service containers are approved for the repo.
