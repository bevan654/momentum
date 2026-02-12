# Troubleshooting: User Data Not Loading

## Most Likely Issue: Haven't Run the SQL Update

If login works but you can't see any workouts, it's because:

1. **The `user_id` column doesn't exist yet** in your database
2. **OR** your old workouts don't have a `user_id`
3. **OR** Row Level Security is blocking the queries

## Fix: Run This SQL in Supabase

### Option A: If You Have Old Workouts You Want to Keep

```sql
-- First, check if user_id column exists
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'workouts' AND column_name = 'user_id';

-- If it doesn't exist, add it (allow NULL for now)
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Get your user ID (run after logging in to the app)
SELECT id, email FROM auth.users;

-- Update all existing workouts to belong to your user
-- REPLACE 'your-user-id-here' with the actual ID from above
UPDATE workouts SET user_id = 'your-user-id-here' WHERE user_id IS NULL;

-- Now add the NOT NULL constraint
ALTER TABLE workouts ALTER COLUMN user_id SET NOT NULL;
```

### Option B: Fresh Start (Delete Old Workouts)

```sql
-- Delete all existing workouts
DELETE FROM workouts;

-- Add user_id column
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_workouts_user_id ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_user_created ON workouts(user_id, created_at DESC);
```

### Option C: Temporarily Disable RLS (For Testing Only)

If you want to test without RLS first:

```sql
-- DISABLE RLS (allows all users to see all data - NOT SECURE!)
ALTER TABLE workouts DISABLE ROW LEVEL SECURITY;
ALTER TABLE exercises DISABLE ROW LEVEL SECURITY;
ALTER TABLE sets DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own workouts" ON workouts;
DROP POLICY IF EXISTS "Users can insert own workouts" ON workouts;
DROP POLICY IF EXISTS "Users can update own workouts" ON workouts;
DROP POLICY IF EXISTS "Users can delete own workouts" ON workouts;

DROP POLICY IF EXISTS "Users can view own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can insert own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can update own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can delete own exercises" ON exercises;

DROP POLICY IF EXISTS "Users can view own sets" ON sets;
DROP POLICY IF EXISTS "Users can insert own sets" ON sets;
DROP POLICY IF EXISTS "Users can update own sets" ON sets;
DROP POLICY IF EXISTS "Users can delete own sets" ON sets;
```

**WARNING**: Option C makes all data public! Only use for testing, then re-enable RLS.

## How to Check What's Wrong

### 1. Check if user_id column exists
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'workouts';
```

### 2. Check if you have workouts
```sql
SELECT id, created_at, user_id FROM workouts LIMIT 10;
```

### 3. Check your user ID
```sql
SELECT id, email FROM auth.users;
```

### 4. Check RLS policies
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('workouts', 'exercises', 'sets');
```

## Debug Steps

1. Open the app
2. Login
3. Open browser console / React Native debugger
4. Look for console.log messages:
   - "Loading workouts for month: YYYY MM"
   - "Result: { success: true/false, ... }"
   - "Workouts loaded: X"

5. If you see errors like:
   - "column user_id does not exist" → Run Option A or B above
   - "new row violates row-level security" → RLS policies are wrong
   - Empty result but no errors → Old workouts don't have user_id

## Recommended Solution

**For fresh start (recommended):**
1. Run Option B SQL above (deletes old workouts)
2. Run the RLS policies from DATABASE_SCHEMA.md
3. Restart app and try creating a new workout
4. It should work!

**To keep old workouts:**
1. Run Option A SQL above
2. Make sure to replace 'your-user-id-here' with your actual user ID
3. Run the RLS policies from DATABASE_SCHEMA.md
4. Restart app

## Still Not Working?

Try Option C (temporarily disable RLS) to verify the issue is RLS-related. If workouts load with RLS disabled, then the problem is with the policies, not the data.
