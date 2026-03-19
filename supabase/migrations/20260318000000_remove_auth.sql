-- Drop RLS policies first (they reference user_id)
DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can manage their own preferences" ON public.preferences;
ALTER TABLE public.subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferences DISABLE ROW LEVEL SECURITY;

-- Remove auth dependency from subscriptions
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS user_id;

-- Fix intent constraint to match TypeScript types
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_intent_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_intent_check
  CHECK (intent IN ('cancel', 'renew', 'remind_before_billing'));

-- Fix status constraint to match TypeScript types
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'archived', 'canceled'));

-- Drop stale indexes that referenced user_id
DROP INDEX IF EXISTS subscriptions_user_id_status_idx;
DROP INDEX IF EXISTS subscriptions_reminder_date_idx;

-- Replacement indexes without user_id
CREATE INDEX subscriptions_status_idx ON public.subscriptions(status);
CREATE INDEX subscriptions_reminder_date_idx ON public.subscriptions(reminder_date)
  WHERE status NOT IN ('archived', 'canceled');
