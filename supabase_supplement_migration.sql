-- ============================================================
-- Supplement Tracking Migration for Momentum App
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. SUPPLEMENT ENTRIES TABLE (water, creatine, etc.)
CREATE TABLE IF NOT EXISTS supplement_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('water', 'creatine')),
  amount NUMERIC NOT NULL,  -- ml for water, g for creatine
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE supplement_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own supplement entries"
  ON supplement_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own supplement entries"
  ON supplement_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own supplement entries"
  ON supplement_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own supplement entries"
  ON supplement_entries FOR DELETE
  USING (auth.uid() = user_id);

-- Index for querying by user, date, and type
CREATE INDEX idx_supplement_entries_user_date_type
  ON supplement_entries (user_id, date DESC, type);

-- 2. SUPPLEMENT GOALS TABLE
CREATE TABLE IF NOT EXISTS supplement_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  water_goal NUMERIC NOT NULL DEFAULT 2500,  -- ml
  creatine_goal NUMERIC NOT NULL DEFAULT 5,  -- g
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE supplement_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own supplement goals"
  ON supplement_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own supplement goals"
  ON supplement_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own supplement goals"
  ON supplement_goals FOR UPDATE
  USING (auth.uid() = user_id);
