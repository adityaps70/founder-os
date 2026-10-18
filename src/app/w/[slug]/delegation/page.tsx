import Link from "next/link";
import { BellRing, Check, Clock, Hourglass, Mail } from "lucide-react";
import { snoozeFollowUp, toggleTask } from "@/actions/tasks";
import { Avatar, Badge, Card, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui";
import { PRIORITIES, labelFor } from "@/lib/constants";
import type { Task, TeamMember } from "@/lib/types";
import { cn, formatDate, relativeDay, todayISO } from "@/lib/utils";
import { getWorkspace } from "@/lib/workspace";

export const metadata = { title: "Waiting on" };

function ageInDays(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

function nudgeHref(person: TeamMember, task: Task) {
  if (!person.email) return null;
  const first = person.name.split(/\s+/)[0] ?? person.name;
  const due = task.due_date ? ` (due ${formatDate(task.due_date, { day: "numeric", month: "short" })})` : "";
  const subject = `Quick check-in: ${task.title}`;
  const body = `Hi ${first},\n\nJust checking in on "${task.title}"${due}. How is it going? If anything is blocking you, let me know and I'll help clear it.\n\nThanks!`;
  return `mailto:${person.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default async function DelegationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspace(slug);
  const { supabase, workspace, team, me } = ctx;

  let query = supabase.from("tasks").select("*").eq("workspace_id", workspace.id).neq("status", "done").not("assignee_id", "is", null);
  if (me) query = query.neq("assignee_id", me.id);
  const { data } = await query.order("follow_up_date", { ascending: true, nullsFirst: false }).order("due_date", { ascending: true, nullsFirst: false });
  const tasks = (data ?? []) as Task[];

  const today = todayISO();
  const followUpDue = tasks.filter((t) => t.follow_up_date && t.follow_up_date <= today).length;
  const overdue = tasks.filter((t) => t.due_date && t.due_date < today).length;

  const groups = new Map<string, Task[]>();
  for (const t of tasks) {
    const list = groups.get(t.assignee_id!) ?? [];
    list.push(t);
    groups.set(t.assignee_id!, list);
  }
  const people = [...groups.entries()]
    .map(([id, list]) => ({ person: team.find((p) => p.id === id), list }))
    .filter((g): g is { person: TeamMember; list: Task[] } => !!g.person)
    .sort((a, b) => b.list.length - a.list.length);

  return (
    <>
      <PageHeader
        title="Waiting on"
        description="Everything you've delegated that isn't done yet. Set a follow-up date on a task and it surfaces here when it's time to check in."
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Waiting on others" value={tasks.length} hint={`${people.length} ${people.length === 1 ? "person" : "people"}`} />
        <Stat label="Follow-ups due" value={followUpDue} tone={followUpDue ? "bad" : "neutral"} hint={followUpDue ? "Check in today" : "Nothing to chase"} />
        <Stat label="Past due date" value={overdue} tone={overdue ? "bad" : "good"} hint={overdue ? "Slipping" : "All on schedule"} />
      </div>

      {people.length === 0 ? (
        <Card>
          <EmptyState
            icon={Hourglass}
            title="You're not waiting on anyone"
            description="When you assign a task to someone on your team, it shows up here so nothing you hand off gets lost."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {people.map(({ person, list }) => (
            <Card key={person.id}>
              <CardHeader
                title={
                  <Link href={`/w/${slug}/team/${person.id}`} className="inline-flex items-center gap-2 hover:text-accent">
                    <Avatar name={person.name} size="sm" /> {person.name}
                  </Link>
                }
                description={person.title ?? undefined}
                action={<Badge tone="gray">{list.length} open</Badge>}
              />
              <div className="divide-y divide-line">
                {list.map((t) => {
                  const fuDue = !!t.follow_up_date && t.follow_up_date <= today;
                  const late = !!t.due_date && t.due_date < today;
                  const priority = labelFor(PRIORITIES, t.priority);
                  const nudge = nudgeHref(person, t);
                  const age = ageInDays(t.created_at);
                  return (
                    <div key={t.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3", fuDue && "bg-amber-500/5")}>
                      <div className="min-w-0 flex-1 basis-60">
                        <p className="truncate text-sm text-fg">{t.title}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                          <span>
                            Assigned {age === 0 ? "today" : `${age}d ago`}
                          </span>
                          {t.due_date && <span className={cn(late && "font-medium text-danger")}>· Due {relativeDay(t.due_date)}</span>}
                          {t.follow_up_date && (
                            <span className={cn("inline-flex items-center gap-1", fuDue && "font-medium text-warning")}>
                              · <BellRing className="h-3 w-3" /> Follow up {relativeDay(t.follow_up_date)}
                            </span>
                          )}
                          {t.status === "waiting" && <Badge tone="amber">Blocked</Badge>}
                          {priority && (t.priority === "urgent" || t.priority === "high") && <Badge tone={priority.tone}>{priority.label}</Badge>}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {nudge && (
                          <a href={nudge} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-muted hover:bg-surface-2 hover:text-fg">
                            <Mail className="h-3.5 w-3.5" /> Nudge
                          </a>
                        )}
                        <form action={snoozeFollowUp.bind(null, slug, t.id, 2)}>
                          <button type="submit" className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-muted hover:bg-surface-2 hover:text-fg" title="Follow up in 2 days">
                            <Clock className="h-3.5 w-3.5" /> +2d
                          </button>
                        </form>
                        <form action={snoozeFollowUp.bind(null, slug, t.id, 7)}>
                          <button type="submit" className="inline-flex h-8 items-center rounded-lg px-2 text-xs text-muted hover:bg-surface-2 hover:text-fg" title="Follow up in a week">
                            +1w
                          </button>
                        </form>
                        <form action={toggleTask.bind(null, slug, t.id)}>
                          <button type="submit" className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-success hover:bg-emerald-500/10">
                            <Check className="h-3.5 w-3.5" /> Done
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
