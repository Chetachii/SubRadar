-- Add is_free_trial flag and remove cancellation_url
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS is_free_trial boolean;
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS cancellation_url;
