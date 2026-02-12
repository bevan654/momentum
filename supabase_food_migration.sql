-- Food Entries Table
CREATE TABLE IF NOT EXISTS food_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  calories NUMERIC NOT NULL DEFAULT 0,
  protein NUMERIC NOT NULL DEFAULT 0,
  carbs NUMERIC NOT NULL DEFAULT 0,
  fat NUMERIC NOT NULL DEFAULT 0,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE food_entries ENABLE ROW LEVEL SECURITY;

-- Users can only see their own food entries
CREATE POLICY "Users can view own food entries"
  ON food_entries FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own food entries
CREATE POLICY "Users can insert own food entries"
  ON food_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own food entries
CREATE POLICY "Users can delete own food entries"
  ON food_entries FOR DELETE
  USING (auth.uid() = user_id);

-- Index for querying by user and date
CREATE INDEX idx_food_entries_user_date ON food_entries (user_id, created_at);

-- Nutrition Goals Table
CREATE TABLE IF NOT EXISTS nutrition_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  calorie_goal NUMERIC NOT NULL DEFAULT 2000,
  protein_goal NUMERIC NOT NULL DEFAULT 150,
  carbs_goal NUMERIC NOT NULL DEFAULT 250,
  fat_goal NUMERIC NOT NULL DEFAULT 65,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE nutrition_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own nutrition goals"
  ON nutrition_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own nutrition goals"
  ON nutrition_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own nutrition goals"
  ON nutrition_goals FOR UPDATE
  USING (auth.uid() = user_id);
