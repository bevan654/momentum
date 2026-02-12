-- Add group session columns to live_sessions
ALTER TABLE live_sessions
  ADD COLUMN IF NOT EXISTS participant_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS participant_summaries JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS invite_code TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_participants INTEGER DEFAULT 2;

-- Unique index on invite_code (only for non-null codes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_live_sessions_invite_code
  ON live_sessions(invite_code) WHERE invite_code IS NOT NULL;

-- GIN index for participant_ids array lookups
CREATE INDEX IF NOT EXISTS idx_live_sessions_participant_ids
  ON live_sessions USING GIN(participant_ids);

-- Update RLS: SELECT policy to include participant_ids + invite code lookup
DROP POLICY IF EXISTS "Users can view own sessions" ON live_sessions;
CREATE POLICY "Users can view own sessions"
  ON live_sessions FOR SELECT
  TO authenticated
  USING (host_id = auth.uid() OR buddy_id = auth.uid() OR auth.uid() = ANY(participant_ids) OR invite_code IS NOT NULL);

-- Update RLS: UPDATE policy to include participant_ids
DROP POLICY IF EXISTS "Participants can update own sessions" ON live_sessions;
CREATE POLICY "Participants can update own sessions"
  ON live_sessions FOR UPDATE
  TO authenticated
  USING (host_id = auth.uid() OR buddy_id = auth.uid() OR auth.uid() = ANY(participant_ids));
