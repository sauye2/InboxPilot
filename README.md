# InboxPilot

InboxPilot is a premium, local-first MVP for AI-ready email triage. It helps a user scan a mock inbox, identify emails that need attention, categorize them by workflow mode, rank priority, and summarize the next action.

## MVP Status

This version runs locally with realistic mock email data. It does not connect Gmail, Outlook, Yahoo, Supabase, or a live AI provider yet.

## Features

- Mode-aware triage for Job Search, Work, and Life Admin workflows
- Mock inbox import with realistic sender, subject, body, read state, labels, dates, and deadlines
- Deterministic local triage engine with keyword matching, action detection, deadline extraction, sender hints, category mapping, and priority scoring
- Dashboard summary metrics, priority queue, filters, search, sorting, and email detail panel
- Review workflow for marking reviewed, snoozing, pinning, hiding low priority items, and clearing reviewed items
- Provider adapter structure for future Gmail, Outlook, Yahoo, and mock inbox implementations
- AI service abstraction that can later be swapped to an OpenAI-powered implementation

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- lucide-react
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
src/lib/ai               Triage service abstraction
src/types                Email and triage TypeScript models
```

## How Local Triage Works

The MVP uses local deterministic rules rather than claiming live AI. `analyzeEmail` combines action phrases, urgency phrases, deadline detection, unread state, and mode-specific category keywords. Scores map to high, medium, or low priority, then `analyzeInbox` sorts results and builds summary metrics.

Key files:

- `src/lib/triage/analyze-email.ts`
- `src/lib/triage/analyze-inbox.ts`
- `src/lib/triage/deadline.ts`
- `src/lib/triage/rules.ts`

## Future Cloud Roadmap

- Add Supabase auth and persistence
- Add encrypted email provider token storage
- Add real provider sync jobs
- Add OpenAI-powered classification behind the existing triage service interface
- Add saved triage history, user preferences, and review audit trails
- Deploy on Vercel after production privacy controls are defined

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

Future implementations:

- `GmailProviderAdapter`
- `OutlookProviderAdapter`
- `YahooProviderAdapter`

## Security And Privacy Notes

Your inbox data should only be processed after you explicitly connect an account. This demo uses mock emails. Future production versions should store tokens securely, minimize email body retention, and make AI processing and retention settings clear before any real inbox sync.

## Local Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Quality checks:

```bash
npm run lint
npm run test
npm run build
```

## Routes

- `/` - product intro and demo CTA
- `/dashboard` - local mock inbox triage dashboard
- `/connections` - future provider connection placeholders
- `/settings` - future AI, Supabase, and privacy configuration placeholders

## Screenshots

Add screenshots here after local visual QA.

## Resume Bullet Examples

- Built a full-stack-ready AI email triage dashboard using Next.js, TypeScript, and a modular provider architecture for Gmail, Outlook, and Yahoo integrations.
- Designed a mode-aware priority scoring system that classifies emails by urgency, deadline, category, and required action across job search, work, and personal workflows.
- Created a premium productivity dashboard with filtering, priority queues, email detail panels, review actions, and future-ready Supabase persistence architecture.

## Known Limitations

- Uses deterministic local rules instead of a live AI model
- Uses mock email data only
- Review state is stored in React state and resets on refresh
- Provider OAuth, Supabase persistence, and deployment are intentionally deferred
