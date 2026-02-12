-- Add routine and sync columns to live_sessions for buddy workout sync
ALTER TABLE live_sessions
  ADD COLUMN IF NOT EXISTS routine_data JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sync_mode TEXT DEFAULT NULL
    CHECK (sync_mode IS NULL OR sync_mode IN ('strict', 'soft')),
  ADD COLUMN IF NOT EXISTS routine_name TEXT DEFAULT NULL;
