"use client";
import { AsyncPage } from "@/components/shell/async-page";
import Link from "next/link";
import { TriangleAlert, UserPlus, Users } from "lucide-react";
import { createTeamMember } from "@/actions/team";
import { MemberFields } from "@/components/team/member-fields";
import { moodLabel, moodTone } from "@/components/team/mood";
import { Avatar, Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { FormDialog } from "@/components/ui/form-dialog";
import type { Checkin } from "@/lib/types";
import { cn, todayISO } from "@/lib/utils";
import { getWorkspace } from "@/lib/workspace";

const HEAVY_LOAD = 10;

async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { slug } = await params;
  const { status } = await searchParams;
  const showInactive = status === "inactive";
  const ctx = await getWorkspace(slug);
  const { supabase, workspace, team } = ctx;

  const [{ data: openTasks }, { data: checkins }] = await Promise.all([
    supabase.from("tasks").select("assignee_id, due_date").eq("workspace_id", workspace.id).neq("status", "done").not("assignee_id", "is", null),
    supabase
      .from("checkins")
      .select("team_member_id, week_start, mood, blockers")
      .eq("workspace_id", workspace.id)
      .order("week_start", { ascending: false })
      .limit(500),
  ]);

  const today = todayISO();
  const load = new Map<string, { open: number; overdue: number }>();
  for (const t of (openTasks ?? []) as { assignee_id: string; due_date: string | null }[]) {
    const l = load.get(t.assignee_id) ?? { open: 0, overdue: 0 };
    l.open += 1;
    if (t.due_date && t.due_date < today) l.overdue += 1;
    load.set(t.assignee_id, l);
  }
  const latest = new Map<string, Pick<Checkin, "week_start" | "mood" | "blockers">>();
  for (const c of (checkins ?? []) as Pick<Checkin, "team_member_id" | "week_start" | "mood" | "blockers">[]) {
    if (!latest.has(c.team_member_id)) latest.set(c.team_member_id, c);
  }

  const activeCount = team.filter((t) => t.status === "active").length;
  const inactiveCount = team.length - activeCount;
  const people = team.filter((t) => (showInactive ? t.status === "inactive" : t.status === "active"));
  const base = `/w/team`;

  return (
    <>
      <PageHeader
        title="Team"
        description="Everyone you work with — employees, contractors, advisors. They don't need an account; invite them to log in from Settings → Members."
        actions={
          <FormDialog title="Add team member" trigger="Add member" triggerIcon={<UserPlus className="h-4 w-4" />} action={createTeamMember.bind(null, slug)} submitLabel="Add member">
            <MemberFields />
          </FormDialog>
        }
      />

      <div className="mb-5 flex gap-1 border-b border-line">
        {[
          { href: base, label: `Active (${activeCount})`, on: !showInactive },
          { href: `${base}?status=inactive`, label: `Inactive (${inactiveCount})`, on: showInactive },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm", t.on ? "border-accent font-medium text-fg" : "border-transparent text-muted hover:text-fg")}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {people.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title={showInactive ? "No inactive team members" : "No one on the team yet"}
            description={showInactive ? "People you deactivate show up here." : "Add the people you delegate to so you can track their work, 1:1s and check-ins."}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {people.map((p) => {
            const l = load.get(p.id) ?? { open: 0, overdue: 0 };
            const c = latest.get(p.id);
            const heavy = l.open > HEAVY_LOAD;
            return (
              <Link
                key={p.id}
                href={`/w/team/member/?id=${p.id}`}
                className={cn(
                  "block rounded-xl border bg-surface p-4 transition-colors hover:border-accent/50",
                  heavy ? "border-amber-500/50" : "border-line",
                )}
              >
                <div className="flex items-start gap-3">
                  <Avatar name={p.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-fg">{p.name}</p>
                      {p.user_id === ctx.user.id && <Badge tone="purple">You</Badge>}
                    </div>
                    <p className="truncate text-xs text-muted">{[p.title, p.department].filter(Boolean).join(" · ") || "No title"}</p>
                  </div>
                  <Badge tone={p.user_id ? "green" : "gray"}>{p.user_id ? "Has login" : "No login"}</Badge>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                  <span className={cn("tabular-nums", heavy ? "font-medium text-warning" : "text-muted")}>{l.open} open</span>
                  {l.overdue > 0 && <span className="font-medium tabular-nums text-danger">· {l.overdue} overdue</span>}
                  {c?.mood ? <Badge tone={moodTone(c.mood)}>{moodLabel(c.mood)}</Badge> : null}
                  {heavy && (
                    <span className="inline-flex items-center gap-1 text-warning">
                      <TriangleAlert className="h-3 w-3" /> Heavy load
                    </span>
                  )}
                </div>
                {c?.blockers && (
                  <p className="mt-2 line-clamp-2 text-xs text-muted">
                    <span className="font-medium text-fg">Blocker:</span> {c.blockers}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function Page() {
  return <AsyncPage render={TeamPage} title={"Team"} />;
}
