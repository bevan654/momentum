-- Add body stats columns to profiles table
-- Run this migration in Supabase SQL Editor

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS height NUMERIC,
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female'));
