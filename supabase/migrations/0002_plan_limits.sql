-- Founder OS — plan limits enforced in the database.
-- The web app is a static site talking to Supabase directly, so limits checked in the
-- browser are only a convenience. These triggers are the real enforcement.
-- Keep the numbers in sync with src/lib/billing/plans.ts and supabase/functions/founder-api.

create or replace function public.plan_limit(p_plan text, p_key text)
returns int language sql immutable as $$
  select case coalesce(p_plan, 'free')
    when 'scale' then case p_key when 'seats' then 50 when 'teamMembers' then 200 when 'openDeals' then 5000 when 'aiMessages' then 3000 end
    when 'pro'   then case p_key when 'seats' then 10 when 'teamMembers' then 25  when 'openDeals' then 500  when 'aiMessages' then 600 end
    else              case p_key when 'seats' then 2  when 'teamMembers' then 5   when 'openDeals' then 25   when 'aiMessages' then 30 end
  end;
$$;

-- Trusted server-side code (migrations, security-definer RPCs, the service role) is exempt.
-- The trigger functions below are SECURITY INVOKER on purpose, so current_user is the real caller.
create or replace function public.is_trusted_caller()
returns boolean language sql stable as $$
  select current_user in ('postgres', 'supabase_admin', 'service_role')
      or coalesce(auth.role(), '') = 'service_role';
$$;

create or replace function public.workspace_plan(ws uuid)
returns text language sql stable security definer set search_path = public as $$
  select plan from workspaces where id = ws;
$$;

-- ─── Team members (active people) ───
create or replace function public.enforce_team_member_limit()
returns trigger language plpgsql set search_path = public as $$
declare
  lim int;
  used int;
begin
  if new.status <> 'active' or public.is_trusted_caller() then return new; end if;
  -- Only check when the row is new or is becoming active.
  if tg_op = 'UPDATE' and old.status = 'active' then return new; end if;
  lim := public.plan_limit(public.workspace_plan(new.workspace_id), 'teamMembers');
  select count(*) into used from team_members
  where workspace_id = new.workspace_id and status = 'active' and id <> new.id;
  if used >= lim then
    raise exception 'Your plan allows % team members. Upgrade in Settings → Plan & billing.', lim
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists team_members_plan_limit on public.team_members;
create trigger team_members_plan_limit
  before insert or update of status on public.team_members
  for each row execute function public.enforce_team_member_limit();

-- ─── Open deals ───
create or replace function public.enforce_open_deal_limit()
returns trigger language plpgsql set search_path = public as $$
declare
  lim int;
  used int;
begin
  if new.status <> 'open' or public.is_trusted_caller() then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'open' then return new; end if;
  lim := public.plan_limit(public.workspace_plan(new.workspace_id), 'openDeals');
  select count(*) into used from deals
  where workspace_id = new.workspace_id and status = 'open' and id <> new.id;
  if used >= lim then
    raise exception 'Your plan allows % open deals. Close some deals or upgrade in Settings → Plan & billing.', lim
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists deals_plan_limit on public.deals;
create trigger deals_plan_limit
  before insert or update of status on public.deals
  for each row execute function public.enforce_open_deal_limit();

-- ─── Seats (members + pending invitations) ───
create or replace function public.enforce_seat_limit()
returns trigger language plpgsql set search_path = public as $$
declare
  lim int;
  members int;
  pending int;
begin
  if public.is_trusted_caller() then return new; end if;
  lim := public.plan_limit(public.workspace_plan(new.workspace_id), 'seats');
  select count(*) into members from workspace_members where workspace_id = new.workspace_id;
  select count(*) into pending from invitations
  where workspace_id = new.workspace_id and accepted_at is null and expires_at > now();
  if members + pending >= lim then
    raise exception 'Your plan includes % seats (members + pending invites). Upgrade in Settings → Plan & billing.', lim
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists invitations_seat_limit on public.invitations;
create trigger invitations_seat_limit
  before insert on public.invitations
  for each row execute function public.enforce_seat_limit();

-- ─── AI usage ───
-- Usage is recorded only by the founder-api Edge Function (service role), so users can't
-- write usage rows themselves.
drop policy if exists "usage: members insert" on public.usage_events;
