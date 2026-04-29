-- Stores encrypted OAuth refresh tokens. No end-user RLS policies are added:
-- runtime access should go through server-only service-role code.

create table if not exists public.email_connection_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.email_connections(id) on delete cascade,
  provider text not null check (provider in ('gmail', 'outlook', 'yahoo')),
  encrypted_refresh_token text not null,
  encryption_iv text not null,
  encryption_tag text not null,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id)
);

create index if not exists email_connection_tokens_user_provider_idx
on public.email_connection_tokens(user_id, provider);

drop trigger if exists email_connection_tokens_set_updated_at on public.email_connection_tokens;
create trigger email_connection_tokens_set_updated_at
before update on public.email_connection_tokens
for each row execute function public.set_updated_at();

alter table public.email_connection_tokens enable row level security;
