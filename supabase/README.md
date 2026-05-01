# InboxPilot Supabase Setup

This folder contains the database schema for the cloud-backed version of InboxPilot.

## What This Creates

- `profiles`
- `user_preferences`
- `email_connections`
- `email_messages`
- `triage_results`
- `review_actions`
- `tasks`
- updated-at triggers
- automatic profile/preferences creation when a Supabase Auth user signs up
- Row Level Security policies so users only access their own rows

## Apply Manually

1. Open the Supabase dashboard.
2. Select the InboxPilot project.
3. Go to `SQL Editor`.
4. Open `supabase/migrations/20260428212000_initial_inboxpilot_schema.sql`.
5. Paste the full SQL into the editor.
6. Run it.

## Access I Need To Apply It For You

Use one of these narrow access options:

1. **Temporary Supabase access token**
   - Create a temporary personal access token in Supabase.
   - Share the token and project ref.
   - I can use the Supabase Management API/CLI path.
   - Revoke the token when finished.

2. **Database connection string**
   - Share the Postgres connection string from Supabase project settings.
   - It should look like `postgresql://postgres:[password]@...supabase.com:5432/postgres`.
   - I can apply the SQL directly with a Postgres client.
   - Rotate the database password after setup if you want the cleanest security posture.

3. **Dashboard collaboration**
   - Invite a temporary collaborator to the Supabase project.
   - This is broader access than needed, so the token/connection-string route is preferred.

The existing anon key and service-role key are enough for app runtime calls, but they are not enough to run database DDL migrations through PostgREST.

## Auth URLs To Configure Later

When Supabase Auth UI is added, configure these URLs in Supabase Auth settings:

- Site URL: `https://inboxpilot-sa.us`
- Redirect URLs:
  - `https://inboxpilot-sa.us/auth/callback`
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3001/auth/callback`
