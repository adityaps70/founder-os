# Founder OS

The operating system for founders: goals, tasks, team, meetings, pipeline, finances and KPIs in one place, with an AI Copilot (Claude) that knows your company.

Multi-tenant SaaS: each company is a **workspace**, a founder can run several from one login, and teammates can be invited with their own accounts.

## Modules

| Area | What's inside |
| --- | --- |
| **Command Center** | AI morning brief, today's focus, waiting-on, today's meetings, deal next steps, cash & runway, KPIs, inbox, goal progress |
| **Copilot** | Chat over your live workspace data; creates tasks, updates tasks, logs decisions, saves notes; 1:1 prep, investor updates, weekly review |
| **Focus / Weekly review** | Eisenhower matrix; last-7 / next-7 day review |
| **Tasks / Projects / Goals** | List + kanban, recurring tasks, projects linked to quarterly goals with key results |
| **Team** | Directory & workload, weekly check-ins (wins / blockers / mood), 1:1 notes |
| **Waiting on** | Everything delegated, follow-up dates, snooze, email nudges |
| **Meetings / Decisions** | Agenda + notes, action items → tasks, searchable decision log |
| **Pipeline** | Sales, fundraising and partnership boards (drag & drop), contacts going cold |
| **Finance / Invoices / KPIs** | Cash, burn, runway, 6-month chart, invoices (paid → revenue), weekly KPI scorecard |
| **Settings** | Company settings, members & invites, plans & usage limits (billing stubbed) |
| **Quick capture** | ⌘K / Ctrl+K anywhere |

## Stack

- **Next.js 15** static export (`output: "export"`), React 19, TypeScript, Tailwind CSS v4 — hosted on **GitHub Pages**
- **Supabase**: Postgres, Auth (email/password, magic link, Google), Row Level Security for tenant isolation, and DB triggers for plan limits
- **Supabase Edge Function `founder-api`** for everything that needs a secret: the AI Copilot and morning brief (Anthropic API) and plan changes
- No other runtime dependencies (charts are hand-rolled SVG)

The browser talks to Supabase directly with the publishable key. That is safe because every table is protected by RLS: users only ever see rows of workspaces they belong to.

## Getting started

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor**: run `supabase/migrations/0001_init.sql`, then `0002_plan_limits.sql` (or `supabase db push` with the CLI).
3. **Edge Functions → Deploy a new function**: name it `founder-api`, paste `supabase/functions/founder-api/index.ts`, and turn **Verify JWT off** (the function checks the user itself). CLI: `supabase functions deploy founder-api --no-verify-jwt`.
4. **Edge Functions → Secrets**: add `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`, default `claude-sonnet-5-5`; `APP_TIMEZONE`, default `Asia/Kolkata`).
5. **Authentication → URL Configuration**: Site URL = your site (for example `https://<user>.github.io/founder-os/`); add `<site>/**` and `http://localhost:3000/**` to Redirect URLs.
6. Optional: enable **Google** under Authentication → Sign In / Providers.

### 2. Environment

```bash
cp .env.example .env.local   # Supabase URL + publishable key; base path empty for local dev
npm install
npm run dev                  # http://localhost:3000
npm run build                # static site in ./out
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project URL and publishable key (public by design) |
| `NEXT_PUBLIC_BASE_PATH` | `/founder-os` on `https://<user>.github.io/founder-os/`, empty locally or on a custom domain |
| `NEXT_PUBLIC_APP_TIMEZONE` | Defaults to `Asia/Kolkata`. Sets what "today" and "this week" mean |

### 3. Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds the static site and publishes it to GitHub Pages on every push to `main`. In the repo, **Settings → Pages → Source: GitHub Actions**. The workflow sets the public build variables (Supabase URL, publishable key, base path) — edit them there if you change projects or add a custom domain.

GitHub Pages on the free plan needs a **public** repository (private repos need GitHub Pro).

## How it's organised

```
supabase/migrations/0001_init.sql   schema, RLS policies, RPCs (create_workspace, accept_invitation)
supabase/migrations/0002_plan_limits.sql  plan limits enforced by triggers
supabase/functions/founder-api/     Edge Function: Copilot, morning brief, plan changes
src/app/
  page.tsx                          marketing landing + pricing
  (auth)/login, signup              auth pages
  auth/callback/                    OAuth / magic link / email confirmation handler
  onboarding/                       create a company workspace
  invite/?token=                    accept an invitation
  w/...                             the app (one folder per module); the current workspace is chosen with ?ws=<slug>
src/actions/*.ts                    all mutations (run in the browser, protected by RLS)
src/lib/
  workspace.ts                      client workspace store: getWorkspace(), refreshWorkspace()
  supabase/client.ts                browser Supabase client + callApi() for the Edge Function
  billing/plans.ts | limits.ts      plans and limits (enforced again in the database)
src/components/shell/async-page.tsx runs each page's async render function in the browser
src/components/ui                   design system (tokens in src/app/globals.css)
```

**Tenancy & security:** every business table has a `workspace_id`, and RLS lets only members of that workspace read or write its rows (`is_member()`). Admin-only operations use `is_admin()`. Billing columns can only be changed by the service role (DB trigger), so only the Edge Function can change plans, and nobody can grant the `owner` role from the client. Plan limits (seats, team members, open deals, AI messages) are enforced in the database and the Edge Function.

**Team vs members:** *team members* are the people you manage. They don't need a login, so you can assign and track work for anyone. *Members* are people with a login. When an invited person accepts, they are linked to their team entry by email.

## Adding real billing (Razorpay or Stripe)

In `supabase/functions/founder-api/index.ts`, replace the stub in the `change_plan` action with a checkout: create a Razorpay subscription or Stripe Checkout session and return `{ ok: true, url }` (the app redirects to it). Add a second action (or function) for the provider's webhook that verifies the signature and updates the workspace's billing columns with the service role.

## Roadmap ideas

- Google Calendar / Gmail sync (meetings and follow-ups)
- Slack / WhatsApp check-in reminders and digests
- Scheduled morning brief by email (Supabase cron + the `brief` action)
- Hiring pipeline, SOP / wiki module
- Investor update templates with KPI charts
