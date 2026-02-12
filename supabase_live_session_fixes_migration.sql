-- ============================================================
-- Live Session Bug Fixes Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Add missing participant_heartbeats JSONB column.
--    The background heartbeat system writes per-user timestamps here
--    and the stale-detection fallback reads from it.
ALTER TABLE live_sessions
  ADD COLUMN IF NOT EXISTS participant_heartbeats JSONB DEFAULT '{}';

-- 2. Fix max_participants default (was 2, should be 10).
--    New sessions write 10 explicitly, but old rows created before
--    the group migration defaulted to 2, incorrectly capping them.
ALTER TABLE live_sessions
  ALTER COLUMN max_participants SET DEFAULT 10;
UPDATE live_sessions
  SET max_participants = 10
  WHERE max_participants = 2;

-- 3. Fix RLS SELECT policy.
--    The previous policy had `OR invite_code IS NOT NULL` which exposed
--    ALL sessions with invite codes (i.e. every session) to ALL users.
--    Replace it with a tighter policy that only allows participants to see sessions.
DROP POLICY IF EXISTS "Users can view own sessions" ON live_sessions;
CREATE POLICY "Users can view own sessions"
  ON live_sessions FOR SELECT
  TO authenticated
  USING (
    host_id = auth.uid()
    OR buddy_id = auth.uid()
    OR auth.uid() = ANY(participant_ids)
  );

-- 4. Add a SECURITY DEFINER function for invite code lookups.
--    This bypasses RLS so any authenticated user can find a session
--    by invite code without the RLS policy leaking all sessions.
CREATE OR REPLACE FUNCTION find_session_by_invite_code(lookup_code TEXT)
RETURNS SETOF live_sessions
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM live_sessions
  WHERE invite_code = lookup_code
  AND status IN ('pending', 'active')
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
