-- ============================================================
-- Exercise Strength Leaderboard RPC Functions
-- ============================================================
-- Run this in the Supabase SQL Editor

-- Drop old version first (return type changed)
DROP FUNCTION IF EXISTS get_exercise_strength_leaderboard(TEXT);

-- 1. Get max weight lifted per user for a given exercise
--    Returns exercise_type so the client can compute the correct ratio:
--      weighted:          ratio = max_kg / bodyweight
--      weighted_bodyweight: ratio = (bodyweight + max_kg) / bodyweight
--    For weighted_bodyweight, kg=0 (bodyweight only) is still valid
CREATE OR REPLACE FUNCTION get_exercise_strength_leaderboard(p_exercise_name TEXT)
RETURNS TABLE(user_id UUID, max_kg NUMERIC, exercise_type TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT w.user_id, MAX(s.kg) as max_kg, MAX(e.exercise_type)::TEXT as exercise_type
  FROM workouts w
  JOIN exercises e ON w.id = e.workout_id
  JOIN sets s ON e.id = s.exercise_id
  JOIN profiles p ON w.user_id = p.id
  WHERE LOWER(e.name) = LOWER(p_exercise_name)
    AND s.completed = true
    AND (s.kg > 0 OR e.exercise_type = 'weighted_bodyweight')
    AND p.leaderboard_opt_in = true
  GROUP BY w.user_id
  ORDER BY max_kg DESC
  LIMIT 500;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Get most popular exercises ranked by how many distinct users have done them
--    Only includes weighted and weighted_bodyweight exercises (not bodyweight/duration)
CREATE OR REPLACE FUNCTION get_popular_exercises(result_limit INT DEFAULT 20)
RETURNS TABLE(exercise_name TEXT, user_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT e.name::TEXT as exercise_name, COUNT(DISTINCT w.user_id) as user_count
  FROM exercises e
  JOIN workouts w ON e.workout_id = w.id
  WHERE e.exercise_type IN ('weighted', 'weighted_bodyweight')
  GROUP BY e.name
  ORDER BY user_count DESC, e.name ASC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
