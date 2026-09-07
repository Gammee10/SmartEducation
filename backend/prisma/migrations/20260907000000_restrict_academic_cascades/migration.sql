-- Stop destructive cascades on academic history (C1).
-- Re-creates the foreign keys below with ON DELETE RESTRICT so deleting a
-- course/quiz/assignment/book can no longer silently wipe enrollments,
-- content, submissions, grades, attempts, answers, attendance, timetable
-- slots, or library copies. Deletion must go through archival flows instead.
--
-- Constraint names are resolved dynamically via pg_constraint so this works
-- regardless of the names Prisma generated in earlier migrations.
DO $$
DECLARE
  r RECORD;
  stmt TEXT;
BEGIN
  FOR r IN
    SELECT 'course_enrollments' AS tbl, 'course_id' AS col
    UNION ALL SELECT 'content_items', 'course_id'
    UNION ALL SELECT 'assignments', 'course_id'
    UNION ALL SELECT 'assignment_submissions', 'assignment_id'
    UNION ALL SELECT 'quizzes', 'course_id'
    UNION ALL SELECT 'quiz_questions', 'quiz_id'
    UNION ALL SELECT 'quiz_options', 'question_id'
    UNION ALL SELECT 'quiz_attempts', 'quiz_id'
    UNION ALL SELECT 'quiz_answers', 'attempt_id'
    UNION ALL SELECT 'attendances', 'course_id'
    UNION ALL SELECT 'timetable_slots', 'course_id'
    UNION ALL SELECT 'library_book_copies', 'book_id'
  LOOP
    SELECT format(
      'ALTER TABLE %I DROP CONSTRAINT %I; ' ||
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(id) ON DELETE RESTRICT ON UPDATE CASCADE;',
      c.conrelid::regclass,
      c.conname,
      c.conrelid::regclass,
      c.conname,
      a.attname,
      c.confrelid::regclass
    )
    INTO stmt
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.conrelid = r.tbl::regclass
      AND a.attname = r.col;

    IF stmt IS NOT NULL THEN
      EXECUTE stmt;
    ELSE
      RAISE NOTICE 'No FK found on %.%, skipping', r.tbl, r.col;
    END IF;
  END LOOP;
END
$$;
