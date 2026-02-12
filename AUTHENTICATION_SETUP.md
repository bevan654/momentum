# Authentication Setup Instructions

## What Was Added

Your Momentum app now has a complete authentication system using Supabase! Here's what changed:

### 1. Database Schema Updated
- Added `user_id` column to `workouts` table
- Updated Row Level Security (RLS) policies to ensure users only see their own workouts
- Each workout is now tied to a specific user

### 2. New Components
- **Auth.tsx**: Login and signup screen with email/password authentication
- Beautiful UI with Momentum branding

### 3. App Changes
- Authentication check on app startup
- Login/Signup screen shown when not authenticated
- Logout button (red button with arrow) in top-right header
- All workout operations now automatically tied to the logged-in user

## Setup Steps (IMPORTANT - Run These in Supabase)

### Step 1: Update Your Database

1. Go to your Supabase project: https://supabase.com/dashboard
2. Click on "SQL Editor" in the left sidebar
3. Copy and paste the SQL from `DATABASE_SCHEMA.md`
4. Click "Run" to execute the SQL

This will:
- Add the `user_id` column to your workouts table
- Set up Row Level Security so users only see their own data
- Create proper indexes for fast queries

### Step 2: Enable Email Authentication

1. In your Supabase dashboard, go to "Authentication" → "Providers"
2. Make sure "Email" is enabled
3. Configure email settings (you can use Supabase's built-in email service for testing)

### Step 3: Test the App

1. Start your app: `npm start`
2. You should see the login screen
3. Create a new account with any email and password (minimum 6 characters)
4. Check your email for verification (optional - you can disable this in Supabase settings)
5. Sign in and start using the app!

## Features

### Authentication
- **Sign Up**: Create a new account with email and password
- **Sign In**: Login with existing credentials
- **Sign Out**: Red logout button in the top-right corner
- **Session Persistence**: Stay logged in even after closing the app
- **Secure**: All data is protected by Row Level Security

### User-Specific Data
- Each user only sees their own workouts
- Workouts are automatically tagged with the user's ID
- Calendar, stats, and history are all user-specific
- Multiple users can use the same app without seeing each other's data

## Security Notes

- All passwords are hashed and secure (handled by Supabase)
- Row Level Security (RLS) ensures data isolation between users
- Users cannot access or modify other users' workouts
- Authentication tokens are stored securely

## Troubleshooting

### "Not authenticated" Error
- Make sure you ran the SQL from DATABASE_SCHEMA.md
- Verify you're logged in (check for the logout button)
- Try signing out and back in

### Can't See Old Workouts
- Old workouts created before authentication won't have a `user_id`
- You need to either:
  - Delete old workouts from Supabase dashboard
  - Or manually assign them a user_id in the database

### Email Not Arriving
- Check spam folder
- In Supabase dashboard, go to Authentication → Email Templates
- You can disable email confirmation for testing: Authentication → Providers → Email → "Enable email confirmations" (toggle off)

## Next Steps

1. Run the SQL from `DATABASE_SCHEMA.md` in Supabase
2. Test authentication by creating an account
3. Your app is now multi-user ready!

## Building the APK

Now that authentication is set up, you can build the APK:

1. Open terminal in project folder
2. Run: `npx eas-cli login`
3. Run: `npx eas-cli build:configure`
4. Run: `npx eas-cli build --platform android --profile preview`
5. Wait 10-20 minutes for the build
6. Download the APK from the link provided
