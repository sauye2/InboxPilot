-- Durable tasks, personal triage feedback, and Gmail operational audit tables.

do $$
begin
  if exists (
    select 1
    from information_schema.constraint_column_usage
    where table_schema = 'public'
      and table_name = 'tasks'
      and constraint_name = 'tasks_status_check'
  ) then
    alter table public.tasks drop constraint tasks_status_check;
  end if;
end $$;

alter table public.tasks
  add column if not exists provider text,
  add column if not exists provider_message_id text,
  add column if not exists provider_thread_id text,
  add column if not exists last_inbound_at timestamptz,
  add column if not exists last_outbound_at timestamptz,
  add column if not exists draft_subject text,
  add column if not exists draft_body text,
  add column if not exists draft_updated_at timestamptz;

update public.tasks
set status = case
  when status in ('open', 'in_progress') then 'to_reply'
  else status
end
where status in ('open', 'in_progress');

alter table public.tasks
  add constraint tasks_status_check
  check (status in ('to_reply', 'waiting', 'done', 'archived'));

create unique index if not exists tasks_user_email_message_unique_idx
on public.tasks(user_id, email_message_id)
where email_message_id is not null;

create index if not exists tasks_user_thread_status_idx
on public.tasks(user_id, provider, provider_thread_id, status);

create table if not exists public.triage_feedback_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('job_search', 'work', 'life_admin')),
  sender_email text,
  subject_fingerprint text,
  category_override text,
  priority_override text check (priority_override is null or priority_override in ('high', 'medium', 'low')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, mode, sender_email, subject_fingerprint)
);

create index if not exists triage_feedback_rules_user_mode_idx
on public.triage_feedback_rules(user_id, mode);

drop trigger if exists triage_feedback_rules_set_updated_at on public.triage_feedback_rules;
create trigger triage_feedback_rules_set_updated_at
before update on public.triage_feedback_rules
for each row execute function public.set_updated_at();

alter table public.triage_feedback_rules enable row level security;

drop policy if exists "Users can manage own triage feedback rules" on public.triage_feedback_rules;
create policy "Users can manage own triage feedback rules"
on public.triage_feedback_rules for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.provider_token_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid references public.email_connections(id) on delete set null,
  provider text not null,
  event_type text not null check (event_type in ('refresh_success', 'refresh_failed', 'revoked', 'send_success', 'send_failed')),
  message text,
  created_at timestamptz not null default now()
);

create index if not exists provider_token_audit_events_user_created_idx
on public.provider_token_audit_events(user_id, created_at desc);

alter table public.provider_token_audit_events enable row level security;

drop policy if exists "Users can read own provider token audit events" on public.provider_token_audit_events;
create policy "Users can read own provider token audit events"
on public.provider_token_audit_events for select
using (auth.uid() = user_id);
