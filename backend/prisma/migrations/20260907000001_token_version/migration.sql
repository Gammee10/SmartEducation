-- Session revocation counter (C2). New JWTs embed token_version as `tv`;
-- password change/reset and archive/reactivate bump it so previously
-- issued tokens are rejected by the auth middleware.
ALTER TABLE "users" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;
