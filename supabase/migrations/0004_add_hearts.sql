-- 0004: Add hearts/lives mechanic to quiz_attempts (legacy QCM design)
-- Hearts represent the number of wrong answers a student can give before
-- the quiz ends. Default 3 hearts per attempt.

ALTER TABLE quiz_attempts
  ADD COLUMN IF NOT EXISTS hearts_total int NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS hearts_remaining int NOT NULL DEFAULT 3;
