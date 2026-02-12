-- routines table
CREATE TABLE IF NOT EXISTS routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own routines" ON routines FOR ALL USING (auth.uid() = user_id);

-- routine_exercises table
CREATE TABLE IF NOT EXISTS routine_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  exercise_order INTEGER NOT NULL,
  default_sets INTEGER NOT NULL DEFAULT 3
);
ALTER TABLE routine_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own routine exercises" ON routine_exercises
  FOR ALL USING (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_exercises.routine_id AND routines.user_id = auth.uid())
  );
