-- Store the full multi-select selection on each quiz answer.
ALTER TABLE "quiz_answers" ADD COLUMN "selection" JSONB;
