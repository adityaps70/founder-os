-- Founder OS — initial schema
-- Multi-tenant: every business row belongs to a workspace (a company).
-- Access is enforced with Row Level Security via is_member()/is_admin().

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- Profiles
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- Workspaces & membership
-- ─────────────────────────────────────────────────────────────
create type public.member_role as enum ('owner', 'admin', 'member');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$'),
  currency text not null default 'INR',
  cash_balance numeric(14,2) not null default 0,
  -- billing (only writable by the service role, see protect_billing_columns)
  plan text not null default 'free',
  plan_status text not null default 'active',
  billing_customer_id text,
  billing_subscription_id text,
  current_period_end timestamptz,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index on public.workspace_members (user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  email text not null,
  role public.member_role not null default 'member',
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  invited_by uuid references auth.users on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);

create or replace function public.is_member(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from workspace_members where workspace_id = ws and user_id = auth.uid());
$$;

create or replace function public.is_admin(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

-- Billing columns can only change through the server (service role).
create or replace function public.protect_billing_columns()
returns trigger language plpgsql as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and current_user not in ('postgres', 'supabase_admin', 'service_role') and (
       new.plan is distinct from old.plan
    or new.plan_status is distinct from old.plan_status
    or new.billing_customer_id is distinct from old.billing_customer_id
    or new.billing_subscription_id is distinct from old.billing_subscription_id
    or new.current_period_end is distinct from old.current_period_end
  ) then
    raise exception 'Billing fields can only be changed by the billing system';
  end if;
  return new;
end $$;

create trigger workspaces_protect_billing
  before update on public.workspaces
  for each row execute function public.protect_billing_columns();

-- ─────────────────────────────────────────────────────────────
-- Team (people you work with — they don't need an account)
-- ─────────────────────────────────────────────────────────────
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid references auth.users on delete set null,
  name text not null,
  email text,
  title text,
  department text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  start_date date,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index on public.team_members (workspace_id);

-- Only admins (or server-side functions) may link/unlink a team entry to a login.
create or replace function public.protect_team_member_link()
returns trigger language plpgsql as $$
begin
  if new.user_id is distinct from old.user_id
     and current_user not in ('postgres', 'supabase_admin', 'service_role')
     and not public.is_admin(new.workspace_id) then
    raise exception 'Only admins can change which login a team member is linked to';
  end if;
  return new;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Goals → Projects → Tasks
-- ─────────────────────────────────────────────────────────────
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  title text not null,
  description text,
  quarter text not null,               -- e.g. '2026-Q4'
  owner_id uuid references public.team_members on delete set null,
  status text not null default 'on_track' check (status in ('on_track', 'at_risk', 'off_track', 'done')),
  target_date date,
  created_at timestamptz not null default now()
);
create index on public.goals (workspace_id, quarter);

create table public.key_results (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  goal_id uuid not null references public.goals on delete cascade,
  title text not null,
  start_value numeric not null default 0,
  target_value numeric not null,
  current_value numeric not null default 0,
  unit text,
  created_at timestamptz not null default now()
);
create index on public.key_results (goal_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  goal_id uuid references public.goals on delete set null,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('planned', 'active', 'paused', 'done')),
  owner_id uuid references public.team_members on delete set null,
  due_date date,
  created_at timestamptz not null default now()
);
create index on public.projects (workspace_id);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  agenda text,
  notes text,
  attendee_ids uuid[] not null default '{}',
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create index on public.meetings (workspace_id, starts_at);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  project_id uuid references public.projects on delete set null,
  meeting_id uuid references public.meetings on delete set null,
  title text not null,
  notes text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'waiting', 'done')),
  priority text not null default 'medium' check (priority in ('urgent', 'high', 'medium', 'low')),
  is_important boolean not null default false,
  is_urgent boolean not null default false,
  assignee_id uuid references public.team_members on delete set null,
  delegated_by_id uuid references public.team_members on delete set null,
  due_date date,
  follow_up_date date,
  recurrence text check (recurrence in ('daily', 'weekly', 'monthly')),
  source text not null default 'manual' check (source in ('manual', 'capture', 'meeting', 'copilot')),
  completed_at timestamptz,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create index on public.tasks (workspace_id, status);
create index on public.tasks (assignee_id);
create index on public.tasks (project_id);

-- Quick-capture inbox (private to each user)
create table public.captures (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  content text not null,
  kind text not null default 'note' check (kind in ('note', 'idea', 'task')),
  processed boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.captures (workspace_id, user_id, processed);

-- ─────────────────────────────────────────────────────────────
-- People management
-- ─────────────────────────────────────────────────────────────
create table public.one_on_ones (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  team_member_id uuid not null references public.team_members on delete cascade,
  held_on date not null default current_date,
  talking_points text,
  notes text,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create index on public.one_on_ones (team_member_id, held_on desc);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  team_member_id uuid not null references public.team_members on delete cascade,
  week_start date not null,
  wins text,
  blockers text,
  plans text,
  mood smallint check (mood between 1 and 5),
  created_at timestamptz not null default now(),
  unique (team_member_id, week_start)
);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  meeting_id uuid references public.meetings on delete set null,
  title text not null,
  context text,
  decision text,
  rationale text,
  status text not null default 'decided' check (status in ('proposed', 'decided', 'revisited')),
  decided_by_id uuid references public.team_members on delete set null,
  decided_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index on public.decisions (workspace_id, decided_on desc);

-- ─────────────────────────────────────────────────────────────
-- Pipeline / CRM
-- ─────────────────────────────────────────────────────────────
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  name text not null,
  email text,
  phone text,
  company text,
  title text,
  type text not null default 'lead' check (type in ('lead', 'client', 'investor', 'partner', 'candidate', 'other')),
  notes text,
  last_contacted_at date,
  created_at timestamptz not null default now()
);
create index on public.contacts (workspace_id, type);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  pipeline text not null default 'sales' check (pipeline in ('sales', 'investors', 'partners')),
  title text not null,
  contact_id uuid references public.contacts on delete set null,
  owner_id uuid references public.team_members on delete set null,
  stage text not null,
  value numeric(14,2) not null default 0,
  probability smallint not null default 10 check (probability between 0 and 100),
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  expected_close date,
  next_step text,
  next_step_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.deals (workspace_id, pipeline, status);

-- ─────────────────────────────────────────────────────────────
-- Finance & KPIs
-- ─────────────────────────────────────────────────────────────
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  amount numeric(14,2) not null check (amount >= 0),
  category text not null default 'Other',
  description text,
  occurred_on date not null default current_date,
  is_recurring boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.transactions (workspace_id, occurred_on desc);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  contact_id uuid references public.contacts on delete set null,
  number text not null,
  amount numeric(14,2) not null check (amount >= 0),
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'void')),
  issue_date date not null default current_date,
  due_date date,
  paid_on date,
  notes text,
  created_at timestamptz not null default now(),
  unique (workspace_id, number)
);

create table public.kpis (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  name text not null,
  unit text,
  target numeric,
  direction text not null default 'up' check (direction in ('up', 'down')),
  owner_id uuid references public.team_members on delete set null,
  created_at timestamptz not null default now()
);

create table public.kpi_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  kpi_id uuid not null references public.kpis on delete cascade,
  week_start date not null,
  value numeric not null,
  created_at timestamptz not null default now(),
  unique (kpi_id, week_start)
);

-- ─────────────────────────────────────────────────────────────
-- AI Copilot
-- ─────────────────────────────────────────────────────────────
create table public.copilot_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index on public.copilot_messages (workspace_id, user_id, created_at);

create table public.briefs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  brief_date date not null default current_date,
  content text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id, brief_date)
);

-- Metered usage for plan limits (e.g. AI messages per month)
create table public.usage_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid references auth.users on delete set null default auth.uid(),
  kind text not null,
  created_at timestamptz not null default now()
);
create index on public.usage_events (workspace_id, kind, created_at);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.invitations enable row level security;

create policy "profiles: read self and teammates" on public.profiles for select using (
  id = auth.uid() or exists (
    select 1 from workspace_members a join workspace_members b on a.workspace_id = b.workspace_id
    where a.user_id = auth.uid() and b.user_id = profiles.id
  )
);
create policy "profiles: update self" on public.profiles for update using (id = auth.uid());

create policy "workspaces: members read" on public.workspaces for select using (public.is_member(id));
create policy "workspaces: admins update" on public.workspaces for update using (public.is_admin(id));
create policy "workspaces: owner deletes" on public.workspaces for delete using (
  exists (select 1 from workspace_members m where m.workspace_id = workspaces.id and m.user_id = auth.uid() and m.role = 'owner')
);
-- Inserts go through create_workspace() below.

create policy "members: read" on public.workspace_members for select using (public.is_member(workspace_id));
-- Admins manage roles, but nobody can grant or change "owner" from the client.
create policy "members: admins manage" on public.workspace_members for update
  using (public.is_admin(workspace_id) and role <> 'owner')
  with check (public.is_admin(workspace_id) and role <> 'owner');
create policy "members: admins remove or self leave" on public.workspace_members for delete using (
  role <> 'owner' and (public.is_admin(workspace_id) or user_id = auth.uid())
);

create policy "invitations: admins all" on public.invitations for all
  using (public.is_admin(workspace_id)) with check (public.is_admin(workspace_id) and role <> 'owner');

-- Generic "any member can read/write" policy for workspace-scoped business tables
do $$
declare t text;
begin
  foreach t in array array[
    'team_members', 'goals', 'key_results', 'projects', 'meetings', 'tasks',
    'one_on_ones', 'checkins', 'decisions', 'contacts', 'deals',
    'transactions', 'invoices', 'kpis', 'kpi_entries'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%1$s: members all" on public.%1$I for all using (public.is_member(workspace_id)) with check (public.is_member(workspace_id))',
      t
    );
  end loop;
end $$;

-- Per-user private tables
alter table public.captures enable row level security;
alter table public.copilot_messages enable row level security;
alter table public.briefs enable row level security;
alter table public.usage_events enable row level security;

create policy "captures: own" on public.captures for all
  using (user_id = auth.uid() and public.is_member(workspace_id))
  with check (user_id = auth.uid() and public.is_member(workspace_id));
create policy "copilot: own" on public.copilot_messages for all
  using (user_id = auth.uid() and public.is_member(workspace_id))
  with check (user_id = auth.uid() and public.is_member(workspace_id));
create policy "briefs: own" on public.briefs for all
  using (user_id = auth.uid() and public.is_member(workspace_id))
  with check (user_id = auth.uid() and public.is_member(workspace_id));
create policy "usage: members read" on public.usage_events for select using (public.is_member(workspace_id));
create policy "usage: members insert" on public.usage_events for insert with check (public.is_member(workspace_id));

-- ─────────────────────────────────────────────────────────────
-- RPCs
-- ─────────────────────────────────────────────────────────────

-- Create a workspace, make the caller its owner and add them to the team.
create or replace function public.create_workspace(p_name text, p_slug text, p_currency text default 'INR')
returns public.workspaces language plpgsql security definer set search_path = public as $$
declare
  ws public.workspaces;
  uname text;
  uemail text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  insert into workspaces (name, slug, currency, created_by)
  values (p_name, lower(p_slug), coalesce(p_currency, 'INR'), auth.uid())
  returning * into ws;

  insert into workspace_members (workspace_id, user_id, role) values (ws.id, auth.uid(), 'owner');

  select coalesce(p.full_name, split_part(u.email, '@', 1)), u.email into uname, uemail
  from auth.users u left join profiles p on p.id = u.id where u.id = auth.uid();

  insert into team_members (workspace_id, user_id, name, email, title)
  values (ws.id, auth.uid(), uname, uemail, 'Founder');

  return ws;
end $$;

-- Accept an invitation by token (caller's email must match).
create or replace function public.accept_invitation(p_token text)
returns public.workspaces language plpgsql security definer set search_path = public as $$
declare
  inv public.invitations;
  ws public.workspaces;
  uemail text;
  uname text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  select * into inv from invitations
  where token = p_token and accepted_at is null and expires_at > now();
  if inv.id is null then raise exception 'Invitation is invalid or has expired'; end if;

  select u.email, coalesce(p.full_name, split_part(u.email, '@', 1)) into uemail, uname
  from auth.users u left join profiles p on p.id = u.id where u.id = auth.uid();
  if lower(uemail) <> lower(inv.email) then
    raise exception 'This invitation was sent to a different email address';
  end if;

  insert into workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, auth.uid(), inv.role)
  on conflict (workspace_id, user_id) do nothing;

  -- Link an existing team entry with the same email, or create one.
  update team_members set user_id = auth.uid()
  where workspace_id = inv.workspace_id and lower(email) = lower(uemail) and user_id is null;
  if not found then
    insert into team_members (workspace_id, user_id, name, email)
    values (inv.workspace_id, auth.uid(), uname, uemail)
    on conflict (workspace_id, user_id) do nothing;
  end if;

  update invitations set accepted_at = now() where id = inv.id;
  select * into ws from workspaces where id = inv.workspace_id;
  return ws;
end $$;

-- Public, minimal lookup so the invite page can show the workspace name.
create or replace function public.invitation_preview(p_token text)
returns table (workspace_name text, email text, expired boolean)
language sql stable security definer set search_path = public as $$
  select w.name, i.email, (i.accepted_at is not null or i.expires_at < now())
  from invitations i join workspaces w on w.id = i.workspace_id
  where i.token = p_token;
$$;

grant execute on function public.create_workspace(text, text, text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.invitation_preview(text) to anon, authenticated;

-- Keep deals.updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger deals_touch before update on public.deals
  for each row execute function public.touch_updated_at();

create trigger team_members_protect_link before update on public.team_members
  for each row execute function public.protect_team_member_link();
