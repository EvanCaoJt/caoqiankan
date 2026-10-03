-- Completion, rather than submission or a later note edit, starts the retention clock.
ALTER TABLE feedback ADD COLUMN completed_at timestamptz;
UPDATE feedback SET completed_at = updated_at WHERE status IN ('resolved', 'spam');
CREATE INDEX feedback_completed_at_idx ON feedback (completed_at)
  WHERE status IN ('resolved', 'spam');

-- Keep deletion work durable if the local filesystem is temporarily unavailable.
CREATE TABLE feedback_file_deletions (
  key text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
