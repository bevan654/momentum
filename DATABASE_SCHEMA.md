# Supabase Database Schema with Authentication

## Setup Instructions

1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to the SQL Editor
3. Copy and paste the SQL below to update the tables with user authentication

## SQL Schema

```sql
-- Add user_id column to workouts table (if not exists)
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for user-based queries
CREATE INDEX IF NOT EXISTS idx_workouts_user_id ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_user_created ON workouts(user_id, created_at DESC);

-- Update Row Level Security policies for workouts
DROP POLICY IF EXISTS "Allow all operations on workouts" ON workouts;
CREATE POLICY "Users can view own workouts" ON workouts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own workouts" ON workouts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own workouts" ON workouts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own workouts" ON workouts FOR DELETE USING (auth.uid() = user_id);

-- Update RLS policies for exercises (inherited through workout)
DROP POLICY IF EXISTS "Allow all operations on exercises" ON exercises;
CREATE POLICY "Users can view own exercises" ON exercises FOR SELECT
  USING (EXISTS (SELECT 1 FROM workouts WHERE workouts.id = exercises.workout_id AND workouts.user_id = auth.uid()));
CREATE POLICY "Users can insert own exercises" ON exercises FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM workouts WHERE workouts.id = exercises.workout_id AND workouts.user_id = auth.uid()));
CREATE POLICY "Users can update own exercises" ON exercises FOR UPDATE
  USING (EXISTS (SELECT 1 FROM workouts WHERE workouts.id = exercises.workout_id AND workouts.user_id = auth.uid()));
CREATE POLICY "Users can delete own exercises" ON exercises FOR DELETE
  USING (EXISTS (SELECT 1 FROM workouts WHERE workouts.id = exercises.workout_id AND workouts.user_id = auth.uid()));

-- Update RLS policies for sets (inherited through exercise -> workout)
DROP POLICY IF EXISTS "Allow all operations on sets" ON sets;
CREATE POLICY "Users can view own sets" ON sets FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM exercises
    JOIN workouts ON workouts.id = exercises.workout_id
    WHERE exercises.id = sets.exercise_id AND workouts.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own sets" ON sets FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM exercises
    JOIN workouts ON workouts.id = exercises.workout_id
    WHERE exercises.id = sets.exercise_id AND workouts.user_id = auth.uid()
  ));
CREATE POLICY "Users can update own sets" ON sets FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM exercises
    JOIN workouts ON workouts.id = exercises.workout_id
    WHERE exercises.id = sets.exercise_id AND workouts.user_id = auth.uid()
  ));
CREATE POLICY "Users can delete own sets" ON sets FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM exercises
    JOIN workouts ON workouts.id = exercises.workout_id
    WHERE exercises.id = sets.exercise_id AND workouts.user_id = auth.uid()
  ));
```

## Table Structure

### workouts
- `id`: UUID (primary key)
- `created_at`: Timestamp (when workout started)
- `duration`: Integer (workout duration in seconds)
- `total_exercises`: Integer
- `total_sets`: Integer

### exercises
- `id`: UUID (primary key)
- `workout_id`: UUID (foreign key to workouts)
- `name`: Text (exercise name like "Bench Press")
- `exercise_order`: Integer (order in the workout)
- `created_at`: Timestamp

### sets
- `id`: UUID (primary key)
- `exercise_id`: UUID (foreign key to exercises)
- `set_number`: Integer (1, 2, 3, etc.)
- `kg`: Decimal (weight in kg)
- `reps`: Integer (number of repetitions)
- `completed`: Boolean
- `set_type`: Text ('warmup', 'working', or 'drop')
- `created_at`: Timestamp

## Relationships

- One workout has many exercises
- One exercise has many sets
- Cascade delete: Deleting a workout deletes all its exercises and sets
