-- Meal Configuration Table
-- Allows users to configure up to 8 meal slots with custom labels, icons, times, and enable/disable
CREATE TABLE IF NOT EXISTS meal_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  slot TEXT NOT NULL,
  label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'restaurant-outline',
  time_start TEXT NOT NULL DEFAULT '08:00',
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, slot)
);

-- Enable RLS
ALTER TABLE meal_config ENABLE ROW LEVEL SECURITY;

-- Users can only see their own meal config
CREATE POLICY "Users can view own meal config"
  ON meal_config FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own meal config
CREATE POLICY "Users can insert own meal config"
  ON meal_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own meal config
CREATE POLICY "Users can update own meal config"
  ON meal_config FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own meal config
CREATE POLICY "Users can delete own meal config"
  ON meal_config FOR DELETE
  USING (auth.uid() = user_id);

-- Index for querying by user
CREATE INDEX idx_meal_config_user ON meal_config (user_id);

-- Add UPDATE policy for food_entries (missing from original migration)
CREATE POLICY "Users can update own food entries"
  ON food_entries FOR UPDATE
  USING (auth.uid() = user_id);

-- Update food_entries CHECK constraint to allow both legacy and new slot values
ALTER TABLE food_entries DROP CONSTRAINT IF EXISTS food_entries_meal_type_check;
ALTER TABLE food_entries ADD CONSTRAINT food_entries_meal_type_check
  CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'meal_1', 'meal_2', 'meal_3', 'meal_4', 'meal_5', 'meal_6', 'meal_7', 'meal_8'));
