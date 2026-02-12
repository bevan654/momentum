-- Add leader_id column to live_sessions for session leader tracking
-- leader_id can change during a session (via transfer), while host_id stays as original creator
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS leader_id UUID;

-- Backfill existing rows: leader starts as the host
UPDATE live_sessions SET leader_id = host_id WHERE leader_id IS NULL;
