-- Add is_locked column to profiles for admin account locking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;
