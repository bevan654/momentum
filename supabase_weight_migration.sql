-- ============================================================
-- Weight Tracking Migration for Momentum App
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. WEIGHT ENTRIES TABLE
CREATE TABLE IF NOT EXISTS weight_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  weight NUMERIC NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)  -- One entry per day
);

ALTER TABLE weight_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weight entries"
  ON weight_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weight entries"
  ON weight_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weight entries"
  ON weight_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own weight entries"
  ON weight_entries FOR DELETE
  USING (auth.uid() = user_id);

-- Index for querying by user and date
CREATE INDEX idx_weight_entries_user_date ON weight_entries (user_id, date DESC);

-- 2. ADD STARTING WEIGHT TO PROFILES
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS starting_weight NUMERIC DEFAULT NULL;
