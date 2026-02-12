-- ============================================================
-- Social Feature Migration for Momentum App
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. PROFILES TABLE
-- Public mirror of auth.users, auto-created via trigger on signup
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  share_workouts BOOLEAN NOT NULL DEFAULT true,
  show_streak BOOLEAN NOT NULL DEFAULT true,
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  leaderboard_opt_in BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view any profile" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block signup if profile creation fails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. FRIENDSHIPS TABLE
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'declined', 'blocked', 'removed');

CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status friendship_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own friendships" ON friendships
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can insert friendships as sender" ON friendships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update friendships they are part of" ON friendships
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete own friendships" ON friendships
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- 3. ACTIVITY FEED TABLE
CREATE TABLE IF NOT EXISTS activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE,
  duration INTEGER NOT NULL DEFAULT 0,
  total_volume NUMERIC NOT NULL DEFAULT 0,
  exercise_names TEXT[] NOT NULL DEFAULT '{}',
  total_exercises INTEGER NOT NULL DEFAULT 0,
  total_sets INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity" ON activity_feed
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view friends activity" ON activity_feed
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM friendships
      WHERE status = 'accepted'
      AND (
        (user_id = auth.uid() AND friend_id = activity_feed.user_id) OR
        (friend_id = auth.uid() AND user_id = activity_feed.user_id)
      )
    )
  );

CREATE POLICY "Users can insert own activity" ON activity_feed
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own activity" ON activity_feed
  FOR DELETE USING (auth.uid() = user_id);

-- 4. REACTIONS TABLE
CREATE TYPE reaction_type AS ENUM ('like', 'clap', 'fire');

CREATE TABLE IF NOT EXISTS reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activity_feed(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type reaction_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(activity_id, user_id)
);

ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reactions on visible activities" ON reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM activity_feed af
      WHERE af.id = reactions.activity_id
      AND (
        af.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM friendships
          WHERE status = 'accepted'
          AND (
            (user_id = auth.uid() AND friend_id = af.user_id) OR
            (friend_id = auth.uid() AND user_id = af.user_id)
          )
        )
      )
    )
  );

CREATE POLICY "Users can insert own reactions" ON reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reactions" ON reactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reactions" ON reactions
  FOR DELETE USING (auth.uid() = user_id);

-- 5. NUDGES TABLE
CREATE TABLE IF NOT EXISTS nudges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view received nudges" ON nudges
  FOR SELECT USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

CREATE POLICY "Users can insert nudges to friends" ON nudges
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM friendships
      WHERE status = 'accepted'
      AND (
        (user_id = auth.uid() AND friend_id = nudges.receiver_id) OR
        (friend_id = auth.uid() AND user_id = nudges.receiver_id)
      )
    )
  );

CREATE POLICY "Users can update received nudges" ON nudges
  FOR UPDATE USING (auth.uid() = receiver_id);

-- 6. NOTIFICATIONS TABLE
CREATE TYPE notification_type AS ENUM ('friend_request', 'friend_accepted', 'reaction', 'nudge', 'leaderboard_weekly');

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

-- 7. LEADERBOARD ENTRIES TABLE
CREATE TYPE leaderboard_type AS ENUM ('weekly_volume', 'workout_streak', 'total_workouts');

CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type leaderboard_type NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  week_start DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, type, week_start)
);

ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view leaderboard entries of opted-in users" ON leaderboard_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = leaderboard_entries.user_id
      AND profiles.leaderboard_opt_in = true
    )
  );

CREATE POLICY "Users can insert own leaderboard entries" ON leaderboard_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leaderboard entries" ON leaderboard_entries
  FOR UPDATE USING (auth.uid() = user_id);

-- 8. GET USER STREAK FUNCTION
CREATE OR REPLACE FUNCTION get_user_streak(target_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  streak INTEGER := 0;
  check_date DATE := CURRENT_DATE;
  has_workout BOOLEAN;
BEGIN
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM workouts
      WHERE user_id = target_user_id
      AND created_at::date = check_date
    ) INTO has_workout;

    IF has_workout THEN
      streak := streak + 1;
      check_date := check_date - INTERVAL '1 day';
    ELSE
      -- Allow today to not have a workout yet (check if yesterday had one)
      IF streak = 0 AND check_date = CURRENT_DATE THEN
        check_date := check_date - INTERVAL '1 day';
        CONTINUE;
      END IF;
      EXIT;
    END IF;
  END LOOP;

  RETURN streak;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);
CREATE INDEX IF NOT EXISTS idx_activity_feed_user_id ON activity_feed(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_created_at ON activity_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reactions_activity_id ON reactions(activity_id);
CREATE INDEX IF NOT EXISTS idx_nudges_receiver_id ON nudges(receiver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_week ON leaderboard_entries(type, week_start);

-- 9. ADD NEW LEADERBOARD TYPES
-- Drop existing enum type constraint and recreate with new values
-- NOTE: Run this section separately if tables already exist
DO $$
BEGIN
  -- Add new enum values if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'weekly_calories' AND enumtypid = 'leaderboard_type'::regtype) THEN
    ALTER TYPE leaderboard_type ADD VALUE 'weekly_calories';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'weekly_protein' AND enumtypid = 'leaderboard_type'::regtype) THEN
    ALTER TYPE leaderboard_type ADD VALUE 'weekly_protein';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'weekly_water' AND enumtypid = 'leaderboard_type'::regtype) THEN
    ALTER TYPE leaderboard_type ADD VALUE 'weekly_water';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'weekly_creatine' AND enumtypid = 'leaderboard_type'::regtype) THEN
    ALTER TYPE leaderboard_type ADD VALUE 'weekly_creatine';
  END IF;
END
$$;

-- Backfill profiles for existing users
INSERT INTO profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;
