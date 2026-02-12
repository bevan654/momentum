-- ============================================================
-- Exercise Catalog & User Custom Exercises
-- ============================================================

-- 1. Global exercises catalog (admin-managed)
CREATE TABLE IF NOT EXISTS exercises_catalog (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: everyone can read, no user mutations
ALTER TABLE exercises_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read exercises_catalog"
  ON exercises_catalog FOR SELECT
  USING (true);

-- 2. User custom exercises
CREATE TABLE IF NOT EXISTS user_exercises (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Custom',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

ALTER TABLE user_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own exercises"
  ON user_exercises FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own exercises"
  ON user_exercises FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own exercises"
  ON user_exercises FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own exercises"
  ON user_exercises FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Seed exercises catalog
INSERT INTO exercises_catalog (name, category) VALUES
  -- Chest
  ('Bench Press', 'Chest'),
  ('Incline Bench Press', 'Chest'),
  ('Decline Bench Press', 'Chest'),
  ('Dumbbell Bench Press', 'Chest'),
  ('Incline Dumbbell Press', 'Chest'),
  ('Cable Fly', 'Chest'),
  ('Dumbbell Fly', 'Chest'),
  ('Chest Dips', 'Chest'),
  ('Push-ups', 'Chest'),
  ('Machine Chest Press', 'Chest'),
  ('Pec Deck', 'Chest'),
  -- Back
  ('Barbell Row', 'Back'),
  ('Dumbbell Row', 'Back'),
  ('Lat Pulldown', 'Back'),
  ('Pull-ups', 'Back'),
  ('Chin-ups', 'Back'),
  ('Seated Cable Row', 'Back'),
  ('T-Bar Row', 'Back'),
  ('Face Pull', 'Back'),
  ('Straight Arm Pulldown', 'Back'),
  ('Machine Row', 'Back'),
  -- Legs
  ('Squat', 'Legs'),
  ('Front Squat', 'Legs'),
  ('Leg Press', 'Legs'),
  ('Romanian Deadlift', 'Legs'),
  ('Leg Curl', 'Legs'),
  ('Leg Extension', 'Legs'),
  ('Bulgarian Split Squat', 'Legs'),
  ('Lunges', 'Legs'),
  ('Hip Thrust', 'Legs'),
  ('Calf Raise', 'Legs'),
  ('Seated Calf Raise', 'Legs'),
  ('Hack Squat', 'Legs'),
  ('Goblet Squat', 'Legs'),
  -- Shoulders
  ('Overhead Press', 'Shoulders'),
  ('Dumbbell Shoulder Press', 'Shoulders'),
  ('Lateral Raise', 'Shoulders'),
  ('Front Raise', 'Shoulders'),
  ('Reverse Fly', 'Shoulders'),
  ('Arnold Press', 'Shoulders'),
  ('Upright Row', 'Shoulders'),
  ('Shrugs', 'Shoulders'),
  -- Arms
  ('Bicep Curl', 'Arms'),
  ('Hammer Curl', 'Arms'),
  ('Preacher Curl', 'Arms'),
  ('Concentration Curl', 'Arms'),
  ('Cable Curl', 'Arms'),
  ('Tricep Extension', 'Arms'),
  ('Tricep Pushdown', 'Arms'),
  ('Overhead Tricep Extension', 'Arms'),
  ('Skull Crushers', 'Arms'),
  ('Dips', 'Arms'),
  -- Compound
  ('Deadlift', 'Compound'),
  ('Sumo Deadlift', 'Compound'),
  ('Clean and Press', 'Compound'),
  ('Farmers Walk', 'Compound'),
  -- Core
  ('Plank', 'Core'),
  ('Cable Crunch', 'Core'),
  ('Hanging Leg Raise', 'Core'),
  ('Ab Wheel Rollout', 'Core'),
  -- Cardio/Other
  ('Battle Ropes', 'Cardio'),
  ('Box Jump', 'Cardio'),
  ('Kettlebell Swing', 'Cardio')
ON CONFLICT (name) DO NOTHING;
