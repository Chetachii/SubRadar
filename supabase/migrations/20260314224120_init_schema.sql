-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Subscriptions table
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  service_name text not null,
  source_domain text,
  subscription_date date,
  trial_end_date date,
  renewal_date date,
  reminder_date date,
  cost numeric(10, 2),
  currency text default 'USD',
  billing_frequency text check (billing_frequency in ('one_time', 'weekly', 'monthly', 'quarterly', 'yearly', 'unknown')),
  cancellation_url text,
  intent text not null check (intent in ('renew_automatically', 'remind_before_billing', 'cancel_before_trial_ends', 'undecided')),
  status text not null default 'active' check (status in ('active', 'cancel_soon', 'renew_soon', 'archived', 'canceled')),
  notes text,
  detection_source text not null check (detection_source in ('auto_detected', 'manual_entry')),
  snoozed_until date,
  last_reminder_sent_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Preferences table
create table public.preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notifications_enabled boolean not null default true,
  reminder_lead_days integer not null default 3,
  prompt_cooldown_hours integer not null default 24,
  default_sort text not null default 'renewal_date',
  updated_at timestamptz not null default now()
);

-- Auto-update updated_at on subscriptions
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create trigger preferences_updated_at
  before update on public.preferences
  for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.subscriptions enable row level security;
alter table public.preferences enable row level security;

create policy "Users can manage their own subscriptions"
  on public.subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own preferences"
  on public.preferences
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Indexes for common query patterns
create index subscriptions_user_id_status_idx on public.subscriptions(user_id, status);
create index subscriptions_reminder_date_idx on public.subscriptions(user_id, reminder_date) where status not in ('archived', 'canceled');
