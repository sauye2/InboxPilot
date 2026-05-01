# InboxPilot

InboxPilot is a premium, local-first MVP for AI-ready email triage. It helps a user scan a mock inbox, identify emails that need attention, categorize them by workflow mode, rank priority, and summarize the next action.

## MVP Status

This version supports signed-in Supabase users, mock inbox scans, Gmail read-only scans, optional OpenAI-assisted triage, persisted scan results, persisted review actions, and task-list reply suggestion groundwork. Outlook and Yahoo provider implementations remain intentionally deferred.

## Features

- Mode-aware triage for Job Search, Work, and Life Admin workflows
- Mock inbox import with realistic sender, subject, body, read state, labels, dates, and deadlines
- Deterministic local triage engine with keyword matching, action detection, deadline extraction, sender hints, category mapping, and priority scoring
- Dashboard summary metrics, priority queue, filters, search, sorting, and email detail panel
- Review workflow for marking reviewed, snoozing, pinning, hiding low priority items, and clearing reviewed items
- Gmail read-only OAuth scan path for signed-in users
- Provider adapter structure for future Outlook, Yahoo, and mock inbox implementations
- OpenAI triage abstraction with local-rule fallback
- Supabase persistence for normalized message metadata, triage results, review actions, and AI preferences
- Task-list reply suggestion endpoint using the OpenAI reply service when the user opts in

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- lucide-react
- OpenAI SDK
- Supabase SSR/client SDK
- Vitest

## Architecture

```txt
src/app                  Routes for landing, dashboard, settings, connections
src/components/ui        shadcn/ui primitives
src/components/dashboard Dashboard controls, metrics, filters
src/components/email     Priority queue, badges, detail panel
src/components/layout    Shared app shell
src/lib/mock             Mock email data
src/lib/triage           Local deterministic triage engine
src/lib/email-providers  Provider adapter contracts and mock provider
src/lib/ai               OpenAI-ready triage and reply service abstractions
src/lib/supabase         Browser, server, admin, and session proxy clients
src/types                Email and triage TypeScript models
```

## How Local Triage Works

The MVP uses local deterministic rules rather than claiming live AI. `analyzeEmail` combines action phrases, urgency phrases, deadline detection, unread state, and mode-specific category keywords. Scores map to high, medium, or low priority, then `analyzeInbox` sorts results and builds summary metrics.

Key files:

- `src/lib/triage/analyze-email.ts`
- `src/lib/triage/analyze-inbox.ts`
- `src/lib/triage/deadline.ts`
- `src/lib/triage/rules.ts`

## OpenAI Setup

Server-side OpenAI support lives behind the existing AI abstraction. The local dashboard can continue using deterministic rules, while `/api/triage` can use OpenAI structured output when `OPENAI_API_KEY` is configured.

Environment variables:

```bash
OPENAI_API_KEY=
OPENAI_TRIAGE_MODEL=gpt-5.4-mini
OPENAI_REPLY_MODEL=gpt-5.4-mini
```

Key files:

- `src/lib/ai/triage-service.ts`
- `src/lib/ai/reply-service.ts`
- `src/app/api/triage/route.ts`
- `src/app/api/reply-suggestion/route.ts`

## Supabase Setup

Supabase utilities now support authentication, Gmail connection metadata, encrypted Gmail refresh-token storage, user AI preferences, persisted message metadata, persisted triage results, and append-only review actions. Service-role usage stays server-only. The Gmail scan path stores snippets and metadata by default, not full email bodies.

Environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Key files:

- `src/lib/supabase/browser.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/admin.ts`
- `src/lib/supabase/proxy.ts`
- `src/lib/supabase/triage-persistence.ts`
- `src/proxy.ts`

## Future Cloud Roadmap

- Add richer saved triage history views
- Add production-grade provider sync jobs and rate-limit handling
- Add editable AI reply drafts and send/export workflows
- Add Outlook and Yahoo provider adapters
- Add account disconnect audit logs and retention controls

## Future Supabase Schema Plan

- `profiles`: user profile and onboarding state
- `email_connections`: provider, account email, encrypted token reference, status
- `email_messages`: normalized message metadata and optional retained snippets
- `triage_results`: priority, category, action summary, confidence, model/source metadata
- `user_preferences`: default mode, filters, privacy settings, notification preferences
- `review_actions`: reviewed, pinned, snoozed, archived, task-created actions

## Future Email Provider Integrations

`EmailProviderAdapter` defines:

- `id`
- `name`
- `connect()`
- `disconnect()`
- `fetchMessages()`
- `getConnectionStatus()`

Current implementation:

- `MockEmailProviderAdapter`
- Gmail OAuth read-only connection metadata

Future implementations:

- `OutlookProviderAdapter`
- `YahooProviderAdapter`

## Gmail OAuth Setup

The Gmail path currently uses the modify scope so InboxPilot can read recent
messages, send user-approved replies, and move user-confirmed messages to trash:

```txt
https://www.googleapis.com/auth/gmail.modify
```

Google Cloud OAuth client redirect URI:

```txt
https://inboxpilot-sa.us/api/email-providers/gmail/callback
```

Environment variables:

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_GMAIL_REDIRECT_URI=https://inboxpilot-sa.us/api/email-providers/gmail/callback
```

This first pass stores connection metadata in Supabase and stores Gmail refresh tokens encrypted with `TOKEN_ENCRYPTION_KEY` on the server.

## Security And Privacy Notes

Your inbox data should only be processed after you explicitly connect an account. This demo uses mock emails. Future production versions should store tokens securely, minimize email body retention, and make AI processing and retention settings clear before any real inbox sync.

## Local Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Copy `.env.example` to `.env.local` and fill in OpenAI/Supabase values for cloud-backed features.

Quality checks:

```bash
npm run lint
npm run test
npm run build
```

## Routes

- `/` - product intro and demo CTA
- `/dashboard` - mock/Gmail inbox triage dashboard
- `/connections` - Gmail connection flow plus Outlook/Yahoo placeholders
- `/settings` - AI, Supabase, and privacy preference controls

## Screenshots

Add screenshots here after local visual QA.

## Resume Bullet Examples

- Built a full-stack-ready AI email triage dashboard using Next.js, TypeScript, and a modular provider architecture for Gmail, Outlook, and Yahoo integrations.
- Designed a mode-aware priority scoring system that classifies emails by urgency, deadline, category, and required action across job search, work, and personal workflows.
- Created a premium productivity dashboard with filtering, priority queues, email detail panels, review actions, and future-ready Supabase persistence architecture.

## Known Limitations

- Gmail fetch currently uses Gmail metadata/snippets rather than full MIME body parsing
- Reply suggestions are generated in the task list but are not yet editable/saved as draft records
- Outlook and Yahoo sign-ins are not implemented yet
- Review actions are append-only; a dedicated compact current-state table can be added later if needed
