-- InboxPilot initial Supabase schema.
-- Privacy posture: store metadata and triage state by default; full email bodies
-- remain nullable and should only be retained after explicit user consent.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_mode text not null default 'job_search'
    check (default_mode in ('job_search', 'work', 'life_admin')),
  ai_processing_enabled boolean not null default false,
  retain_email_bodies boolean not null default false,
  openai_triage_enabled boolean not null default false,
  openai_reply_suggestions_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('gmail', 'outlook', 'yahoo', 'mock')),
  provider_account_email text,
  status text not null default 'not_connected'
    check (status in ('not_connected', 'connected', 'expired', 'revoked', 'error')),
  scopes text[] not null default '{}',
  token_vault_key text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, provider_account_email)
);

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid references public.email_connections(id) on delete set null,
  provider text not null check (provider in ('gmail', 'outlook', 'yahoo', 'mock')),
  provider_message_id text not null,
  thread_id text,
  sender_name text,
  sender_email text,
  subject text,
  snippet text,
  body text,
  body_retained boolean not null default false,
  received_at timestamptz not null,
  is_read boolean not null default false,
  labels text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, provider_message_id)
);

create table if not exists public.triage_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_message_id uuid references public.email_messages(id) on delete cascade,
  mode text not null check (mode in ('job_search', 'work', 'life_admin')),
  priority text not null check (priority in ('high', 'medium', 'low')),
  category text not null,
  requires_action boolean not null default false,
  deadline_text text,
  deadline_at timestamptz,
  action_summary text not null,
  suggested_next_action text not null,
  reason text,
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  model_provider text not null default 'local',
  model_name text,
  source text not null default 'local_rules'
    check (source in ('local_rules', 'openai', 'manual')),
  raw_model_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.review_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_message_id uuid references public.email_messages(id) on delete cascade,
  triage_result_id uuid references public.triage_results(id) on delete set null,
  action_type text not null
    check (action_type in ('reviewed', 'unreviewed', 'pinned', 'unpinned', 'snoozed', 'unsnoozed', 'hidden', 'task_created')),
  snoozed_until timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_message_id uuid references public.email_messages(id) on delete set null,
  triage_result_id uuid references public.triage_results(id) on delete set null,
  title text not null,
  notes text,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'done', 'archived')),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_connections_user_id_idx on public.email_connections(user_id);
create index if not exists email_messages_user_received_idx on public.email_messages(user_id, received_at desc);
create index if not exists email_messages_user_thread_idx on public.email_messages(user_id, thread_id);
create index if not exists triage_results_user_priority_idx on public.triage_results(user_id, priority, created_at desc);
create index if not exists triage_results_user_category_idx on public.triage_results(user_id, category);
create index if not exists review_actions_user_created_idx on public.review_actions(user_id, created_at desc);
create index if not exists tasks_user_status_idx on public.tasks(user_id, status, created_at desc);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

drop trigger if exists email_connections_set_updated_at on public.email_connections;
create trigger email_connections_set_updated_at
before update on public.email_connections
for each row execute function public.set_updated_at();

drop trigger if exists email_messages_set_updated_at on public.email_messages;
create trigger email_messages_set_updated_at
before update on public.email_messages
for each row execute function public.set_updated_at();

drop trigger if exists triage_results_set_updated_at on public.triage_results;
create trigger triage_results_set_updated_at
before update on public.triage_results
for each row execute function public.set_updated_at();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.email_connections enable row level security;
alter table public.email_messages enable row level security;
alter table public.triage_results enable row level security;
alter table public.review_actions enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can read own preferences" on public.user_preferences;
create policy "Users can read own preferences"
on public.user_preferences for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own preferences" on public.user_preferences;
create policy "Users can insert own preferences"
on public.user_preferences for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own preferences" on public.user_preferences;
create policy "Users can update own preferences"
on public.user_preferences for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own email connections" on public.email_connections;
create policy "Users can manage own email connections"
on public.email_connections for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own email messages" on public.email_messages;
create policy "Users can manage own email messages"
on public.email_messages for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own triage results" on public.triage_results;
create policy "Users can manage own triage results"
on public.triage_results for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own review actions" on public.review_actions;
create policy "Users can manage own review actions"
on public.review_actions for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own tasks" on public.tasks;
create policy "Users can manage own tasks"
on public.tasks for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
