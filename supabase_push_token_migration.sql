-- ============================================================
-- Push Token & Notification Types Migration for Momentum App
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Add push_token column to profiles for push notification delivery
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- 2. Add missing notification_type enum values used by the live workout feature.
--    Without these, every INSERT with 'live_invite', 'live_accepted', or 'join_request'
--    silently fails and the push-notification edge function never fires.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'live_invite' AND enumtypid = 'notification_type'::regtype) THEN
    ALTER TYPE notification_type ADD VALUE 'live_invite';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'live_accepted' AND enumtypid = 'notification_type'::regtype) THEN
    ALTER TYPE notification_type ADD VALUE 'live_accepted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'join_request' AND enumtypid = 'notification_type'::regtype) THEN
    ALTER TYPE notification_type ADD VALUE 'join_request';
  END IF;
END
$$;
