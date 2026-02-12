-- Exercise Types Migration
-- Adds exercise_type column to support: weighted, bodyweight, duration, weighted_bodyweight

-- 1. Add exercise_type to exercises_catalog (global exercise list)
ALTER TABLE exercises_catalog
  ADD COLUMN IF NOT EXISTS exercise_type TEXT NOT NULL DEFAULT 'weighted';

-- 2. Add exercise_type to user_exercises (user custom exercises)
ALTER TABLE user_exercises
  ADD COLUMN IF NOT EXISTS exercise_type TEXT NOT NULL DEFAULT 'weighted';

-- 3. Add exercise_type to exercises (per-workout instance, preserves type at save time)
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS exercise_type TEXT NOT NULL DEFAULT 'weighted';

-- 4. Add exercise_type to routine_exercises
ALTER TABLE routine_exercises
  ADD COLUMN IF NOT EXISTS exercise_type TEXT NOT NULL DEFAULT 'weighted';

-- 5. Seed exercise types for existing catalog entries

-- Bodyweight exercises (reps only, no weight)
UPDATE exercises_catalog SET exercise_type = 'bodyweight'
  WHERE name IN (
    'Push-ups',
    'Pull-ups',
    'Chin-ups',
    'Hanging Leg Raise',
    'Ab Wheel Rollout',
    'Box Jump'
  );

-- Duration/timed exercises (seconds)
UPDATE exercises_catalog SET exercise_type = 'duration'
  WHERE name IN (
    'Plank',
    'Battle Ropes'
  );

-- Weighted bodyweight exercises (+KG added to bodyweight)
UPDATE exercises_catalog SET exercise_type = 'weighted_bodyweight'
  WHERE name IN (
    'Chest Dips',
    'Dips'
  );

-- All other exercises remain 'weighted' (the default)
