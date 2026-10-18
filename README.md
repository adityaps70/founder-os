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

- **Next.js 15** (App Router, Server Components, Server Actions), React 19, TypeScript, Tailwind CSS v4
- **Supabase**: Postgres, Auth (email/password, magic link, Google) and Row Level Security for tenant isolation
- **Anthropic API** for the Copilot and the morning brief
- No other runtime dependencies (charts are hand-rolled SVG)

## Getting started

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste `supabase/migrations/0001_init.sql` and run it. Or, with the Supabase CLI: `supabase link` then `supabase db push`.
3. **Authentication → URL Configuration**: set Site URL to your app URL, for example `http://localhost:3000`. Add `http://localhost:3000/**` and your production URL `/**` to Redirect URLs.
4. Optional: enable **Google** under Authentication → Providers.
5. For invite emails, set the **Invite user** email template link to:
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next={{ .RedirectTo }}`
   You can do the same for Magic Link (`type=magiclink`). Even without email, every invite has a copyable link in Settings → Members.

### 2. Environment

```bash
cp .env.example .env.local
# fill in the Supabase URL + anon key + service role key, and your ANTHROPIC_API_KEY
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Used for billing plan changes and invite emails |
| `NEXT_PUBLIC_APP_URL` | Public URL, used in auth redirects and invite links |
| `NEXT_PUBLIC_APP_TIMEZONE` | Defaults to `Asia/Kolkata`. Sets what "today" and "this week" mean |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Copilot (default model `claude-sonnet-4-5`) |
| `BILLING_PROVIDER` | `stub` (default) switches plans instantly without payment |

### 3. Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build + type check
```

### 4. Deploy (Cloudflare Workers)

Founder OS runs on Cloudflare Workers through [OpenNext](https://opennext.js.org/cloudflare). The config is in `wrangler.jsonc` and `open-next.config.ts`.

**From the dashboard (Workers Builds):** go to Workers & Pages, then Create, then Import a repository, and pick this repo.
- Build command: `npx opennextjs-cloudflare build`
- Deploy command: `npx opennextjs-cloudflare deploy`
- **Build variables** (inlined at build time): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_TIMEZONE`
- **Runtime variables and secrets** (Worker, then Settings, then Variables and Secrets): the same `NEXT_PUBLIC_*` values, plus `SUPABASE_SERVICE_ROLE_KEY` (secret), `ANTHROPIC_API_KEY` (secret), `ANTHROPIC_MODEL` and `BILLING_PROVIDER`

**From your machine:** `npx wrangler login`, then `npm run deploy`. To test in the Workers runtime locally, copy `.dev.vars.example` to `.dev.vars` and run `npm run preview`.

After the first deploy, add `https://<your-worker>.workers.dev/**` (or your custom domain) to Supabase's Redirect URLs, and set it as the Site URL.

The Workers free plan caps the compressed Worker at 3 MB. If the deploy fails on size, switch to Workers Paid, which allows 10 MB.

## How it's organised

```
supabase/migrations/0001_init.sql   schema, RLS policies, RPCs (create_workspace, accept_invitation)
src/middleware.ts                   session refresh + auth gate
src/app/
  page.tsx                          marketing landing + pricing
  (auth)/login, signup              auth pages
  auth/callback, auth/confirm       OAuth / email-link handlers
  onboarding/                       create a company workspace
  invite/[token]/                   accept an invitation
  w/[slug]/...                      the app (one folder per module)
src/actions/*.ts                    server actions (all mutations)
src/lib/
  workspace.ts                      getWorkspace(slug): user + workspace + role + team (use everywhere)
  ai/context.ts                     builds the Copilot's company snapshot
  ai/copilot.ts                     Claude tool-use loop + morning brief
  billing/plans.ts | limits.ts      plans, limits, usage metering (checkLimit)
  billing/provider.ts               payment provider interface (stub today)
src/components/ui                   design system (tokens in src/app/globals.css)
```

**Tenancy & security:** every business table has a `workspace_id`, and RLS lets only members of that workspace read or write its rows (`is_member()`). Admin-only operations use `is_admin()`. Billing columns can only be changed with the service role (DB trigger), and nobody can grant the `owner` role from the client.

**Team vs members:** *team members* are the people you manage. They don't need a login, so you can assign and track work for anyone. *Members* are people with a login. When an invited person accepts, they are linked to their team entry by email.

## Adding real billing (Razorpay or Stripe)

1. Implement `BillingProvider` in `src/lib/billing/provider.ts`. `startCheckout` returns the hosted checkout URL (a Razorpay subscription `short_url` or a Stripe Checkout `session.url`).
2. Implement `src/app/api/billing/webhook/route.ts`: verify the signature, find the workspace (store `workspace_id` in subscription notes or metadata), then call `setWorkspacePlan()`.
3. Set `BILLING_PROVIDER=razorpay` (or `stripe`) and the provider's keys.

Plan limits are enforced in server actions with `checkLimit(ctx, "teamMembers" | "seats" | "openDeals" | "aiMessages")`.

## Roadmap ideas

- Google Calendar / Gmail sync (meetings and follow-ups)
- Slack / WhatsApp check-in reminders and digests
- Scheduled morning brief by email (cron + `runBrief`)
- Hiring pipeline, SOP / wiki module
- Investor update templates with KPI charts
