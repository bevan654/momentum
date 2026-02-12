-- Add username column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Index for fast username lookups and search
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- Allow users to update their own username
CREATE POLICY "Users can update own username"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
