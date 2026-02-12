-- ============================================================
-- RLS Policies for Momentum App
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ==================
-- 1. PROFILES
-- ==================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view any profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- ==================
-- 2. WORKOUTS
-- ==================
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workouts"
  ON workouts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own workouts"
  ON workouts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own workouts"
  ON workouts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own workouts"
  ON workouts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ==================
-- 3. EXERCISES (via workout_id)
-- ==================
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own exercises"
  ON exercises FOR SELECT
  TO authenticated
  USING (workout_id IN (SELECT id FROM workouts WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own exercises"
  ON exercises FOR INSERT
  TO authenticated
  WITH CHECK (workout_id IN (SELECT id FROM workouts WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own exercises"
  ON exercises FOR UPDATE
  TO authenticated
  USING (workout_id IN (SELECT id FROM workouts WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own exercises"
  ON exercises FOR DELETE
  TO authenticated
  USING (workout_id IN (SELECT id FROM workouts WHERE user_id = auth.uid()));

-- ==================
-- 4. SETS (via exercise_id -> workout)
-- ==================
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sets"
  ON sets FOR SELECT
  TO authenticated
  USING (exercise_id IN (
    SELECT e.id FROM exercises e
    JOIN workouts w ON e.workout_id = w.id
    WHERE w.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own sets"
  ON sets FOR INSERT
  TO authenticated
  WITH CHECK (exercise_id IN (
    SELECT e.id FROM exercises e
    JOIN workouts w ON e.workout_id = w.id
    WHERE w.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own sets"
  ON sets FOR UPDATE
  TO authenticated
  USING (exercise_id IN (
    SELECT e.id FROM exercises e
    JOIN workouts w ON e.workout_id = w.id
    WHERE w.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own sets"
  ON sets FOR DELETE
  TO authenticated
  USING (exercise_id IN (
    SELECT e.id FROM exercises e
    JOIN workouts w ON e.workout_id = w.id
    WHERE w.user_id = auth.uid()
  ));

-- ==================
-- 5. SUPPLEMENT_ENTRIES
-- ==================
ALTER TABLE supplement_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own supplement entries"
  ON supplement_entries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own supplement entries"
  ON supplement_entries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own supplement entries"
  ON supplement_entries FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own supplement entries"
  ON supplement_entries FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ==================
-- 6. SUPPLEMENT_GOALS
-- ==================
ALTER TABLE supplement_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own supplement goals"
  ON supplement_goals FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own supplement goals"
  ON supplement_goals FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own supplement goals"
  ON supplement_goals FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- ==================
-- 7. USER_EXERCISES
-- ==================
ALTER TABLE user_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own custom exercises"
  ON user_exercises FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own custom exercises"
  ON user_exercises FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own custom exercises"
  ON user_exercises FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ==================
-- 8. EXERCISES_CATALOG (global, read-only)
-- ==================
ALTER TABLE exercises_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read exercise catalog"
  ON exercises_catalog FOR SELECT
  TO authenticated
  USING (true);

-- ==================
-- 9. FOOD_ENTRIES
-- ==================
ALTER TABLE food_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own food entries"
  ON food_entries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own food entries"
  ON food_entries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own food entries"
  ON food_entries FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own food entries"
  ON food_entries FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ==================
-- 10. NUTRITION_GOALS
-- ==================
ALTER TABLE nutrition_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own nutrition goals"
  ON nutrition_goals FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own nutrition goals"
  ON nutrition_goals FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own nutrition goals"
  ON nutrition_goals FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- ==================
-- 11. MEAL_CONFIG
-- ==================
ALTER TABLE meal_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meal config"
  ON meal_config FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own meal config"
  ON meal_config FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own meal config"
  ON meal_config FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own meal config"
  ON meal_config FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ==================
-- 12. FOOD_CATALOG (global, read-only)
-- ==================
ALTER TABLE food_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read food catalog"
  ON food_catalog FOR SELECT
  TO authenticated
  USING (true);

-- ==================
-- 13. FRIENDSHIPS
-- ==================
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own friendships"
  ON friendships FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR friend_id = auth.uid());

CREATE POLICY "Users can send friend requests"
  ON friendships FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own friendships"
  ON friendships FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR friend_id = auth.uid());

CREATE POLICY "Users can delete own friendships"
  ON friendships FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR friend_id = auth.uid());

-- ==================
-- 14. ACTIVITY_FEED
-- ==================
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view friend activities"
  ON activity_feed FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT CASE
        WHEN user_id = auth.uid() THEN friend_id
        ELSE user_id
      END
      FROM friendships
      WHERE (user_id = auth.uid() OR friend_id = auth.uid())
        AND status = 'accepted'
    )
  );

CREATE POLICY "Users can insert own activities"
  ON activity_feed FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own activities"
  ON activity_feed FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ==================
-- 15. REACTIONS
-- ==================
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reactions"
  ON reactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own reactions"
  ON reactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own reactions"
  ON reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ==================
-- 16. NUDGES
-- ==================
ALTER TABLE nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own nudges"
  ON nudges FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can send nudges"
  ON nudges FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update received nudges"
  ON nudges FOR UPDATE
  TO authenticated
  USING (receiver_id = auth.uid());

-- ==================
-- 17. NOTIFICATIONS
-- ==================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ==================
-- 18. LEADERBOARD_ENTRIES
-- ==================
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all leaderboard entries"
  ON leaderboard_entries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own leaderboard entries"
  ON leaderboard_entries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own leaderboard entries"
  ON leaderboard_entries FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- ==================
-- 19. WEIGHT_ENTRIES
-- ==================
ALTER TABLE weight_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weight entries"
  ON weight_entries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own weight entries"
  ON weight_entries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own weight entries"
  ON weight_entries FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own weight entries"
  ON weight_entries FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ==================
-- 20. ROUTINES
-- ==================
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own routines"
  ON routines FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own routines"
  ON routines FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own routines"
  ON routines FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own routines"
  ON routines FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ==================
-- 21. ROUTINE_EXERCISES (via routine_id)
-- ==================
ALTER TABLE routine_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own routine exercises"
  ON routine_exercises FOR SELECT
  TO authenticated
  USING (routine_id IN (SELECT id FROM routines WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own routine exercises"
  ON routine_exercises FOR INSERT
  TO authenticated
  WITH CHECK (routine_id IN (SELECT id FROM routines WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own routine exercises"
  ON routine_exercises FOR UPDATE
  TO authenticated
  USING (routine_id IN (SELECT id FROM routines WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own routine exercises"
  ON routine_exercises FOR DELETE
  TO authenticated
  USING (routine_id IN (SELECT id FROM routines WHERE user_id = auth.uid()));

-- ==================
-- 22. LIVE_SESSIONS
-- ==================
CREATE TABLE IF NOT EXISTS live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES profiles(id),
  buddy_id UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  host_summary JSONB,
  buddy_summary JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON live_sessions FOR SELECT
  TO authenticated
  USING (host_id = auth.uid() OR buddy_id = auth.uid());

CREATE POLICY "Users can create sessions as host"
  ON live_sessions FOR INSERT
  TO authenticated
  WITH CHECK (host_id = auth.uid());

CREATE POLICY "Participants can update own sessions"
  ON live_sessions FOR UPDATE
  TO authenticated
  USING (host_id = auth.uid() OR buddy_id = auth.uid());
