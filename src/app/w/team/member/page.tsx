"use client";
import { AsyncPage } from "@/components/shell/async-page";
import Link from "next/link";
import { notFound } from "@/lib/nav";
import { ArrowLeft, CalendarCheck, SquareCheckBig, MessagesSquare, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { createTask } from "@/actions/tasks";
import { createOneOnOne, deleteCheckin, deleteOneOnOne, setTeamMemberStatus, updateTeamMember, upsertCheckin } from "@/actions/team";
import { TaskFields } from "@/components/tasks/task-fields";
import { TaskList, TaskRow } from "@/components/tasks/task-row";
import { MemberFields } from "@/components/team/member-fields";
import { moodLabel, moodTone } from "@/components/team/mood";
import { CheckinFields, OneOnOneFields } from "@/components/team/people-fields";
import { Avatar, Badge, ButtonLink, Card, CardHeader, EmptyState, Stat } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { FormDialog } from "@/components/ui/form-dialog";
import { SubmitButton } from "@/components/ui/submit-button";
import { PRIORITY_RANK } from "@/lib/constants";
import type { Checkin, OneOnOne, Project, Task } from "@/lib/types";
import { formatDate, todayISO } from "@/lib/utils";
import { getWorkspace } from "@/lib/workspace";

async function TeamMemberPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await getWorkspace(slug);
  const { supabase, workspace, team } = ctx;
  const member = team.find((t) => t.id === id);
  if (!member) notFound();

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [{ data: tasks }, { data: projects }, { data: oneOnOnes }, { data: checkins }, { count: doneCount }] = await Promise.all([
    supabase.from("tasks").select("*").eq("workspace_id", workspace.id).eq("assignee_id", id).neq("status", "done"),
    supabase.from("projects").select("id, name").eq("workspace_id", workspace.id).neq("status", "done").order("name"),
    supabase.from("one_on_ones").select("*").eq("team_member_id", id).order("held_on", { ascending: false }).limit(20),
    supabase.from("checkins").select("*").eq("team_member_id", id).order("week_start", { ascending: false }).limit(12),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assignee_id", id)
      .eq("status", "done")
      .gte("completed_at", since.toISOString()),
  ]);

  const openTasks = ((tasks ?? []) as Task[]).sort(
    (a, b) =>
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
  );
  const projectList = (projects ?? []) as Pick<Project, "id" | "name">[];
  const meetings1 = (oneOnOnes ?? []) as OneOnOne[];
  const weekly = (checkins ?? []) as Checkin[];
  const today = todayISO();
  const overdue = openTasks.filter((t) => t.due_date && t.due_date < today).length;
  const isMe = member.user_id === ctx.user.id;
  const firstName = member.name.split(/\s+/)[0] ?? member.name;
  const prepHref = `/w/copilot?prompt=${encodeURIComponent(`Prepare talking points for my 1:1 with ${member.name}`)}`;

  return (
    <>
      <Link href={`/w/team`} className="mb-4 inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
        <ArrowLeft className="h-3.5 w-3.5" /> Team
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={member.name} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{member.name}</h1>
              <Badge tone={member.user_id ? "green" : "gray"}>{member.user_id ? "Has login" : "No login"}</Badge>
              {member.status === "inactive" && <Badge tone="amber">Inactive</Badge>}
            </div>
            <p className="text-sm text-muted">
              {[member.title, member.department].filter(Boolean).join(" · ") || "No title"}
              {member.email && (
                <>
                  {" · "}
                  <a href={`mailto:${member.email}`} className="hover:text-fg">
                    {member.email}
                  </a>
                </>
              )}
              {member.start_date && <> · since {formatDate(member.start_date, { month: "short", year: "numeric" })}</>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href={prepHref} variant="secondary">
            <Sparkles className="h-4 w-4" /> Prep my next 1:1
          </ButtonLink>
          <FormDialog title={`Edit ${member.name}`} trigger="Edit" triggerVariant="secondary" triggerIcon={<Pencil className="h-3.5 w-3.5" />} action={updateTeamMember.bind(null, slug, member.id)}>
            <MemberFields member={member} />
          </FormDialog>
          {!isMe && (
            <ActionForm action={setTeamMemberStatus.bind(null, slug, member.id, member.status === "active" ? "inactive" : "active")} resetOnSuccess={false}>
              <SubmitButton variant={member.status === "active" ? "ghost" : "secondary"}>
                {member.status === "active" ? "Deactivate" : "Reactivate"}
              </SubmitButton>
            </ActionForm>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Open tasks" value={openTasks.length} />
        <Stat label="Overdue" value={overdue} tone={overdue ? "bad" : "neutral"} hint={overdue ? "Needs attention" : "All on time"} />
        <Stat label="Done (30 days)" value={doneCount ?? 0} />
        <Stat
          label="Latest mood"
          value={weekly[0]?.mood ? `${weekly[0].mood}/5` : "—"}
          hint={weekly[0] ? `Week of ${formatDate(weekly[0].week_start)}` : "No check-ins yet"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader
              title="Open tasks"
              description={isMe ? "Your own work." : `Work you've handed to ${firstName}.`}
              action={
                <FormDialog
                  title={`Assign a task to ${firstName}`}
                  trigger="Assign task"
                  triggerSize="sm"
                  triggerIcon={<Plus className="h-3.5 w-3.5" />}
                  action={createTask.bind(null, slug)}
                >
                  <TaskFields team={team} projects={projectList} defaults={{ assignee_id: member.id }} />
                </FormDialog>
              }
            />
            {openTasks.length === 0 ? (
              <EmptyState icon={SquareCheckBig} title="Nothing open" description={`${firstName} has no open tasks.`} />
            ) : (
              <TaskList>
                {openTasks.map((t) => (
                  <TaskRow key={t.id} slug={slug} task={t} team={team} projects={projectList} showAssignee={false} showStatus />
                ))}
              </TaskList>
            )}
          </Card>

          <Card>
            <CardHeader
              title="1:1s"
              description="Talking points and notes, newest first."
              action={
                <FormDialog title={`New 1:1 with ${firstName}`} trigger="New 1:1" triggerSize="sm" triggerVariant="secondary" triggerIcon={<Plus className="h-3.5 w-3.5" />} action={createOneOnOne.bind(null, slug, member.id)} wide>
                  <OneOnOneFields name={firstName} />
                </FormDialog>
              }
            />
            {meetings1.length === 0 ? (
              <EmptyState icon={MessagesSquare} title="No 1:1s recorded" description="Regular 1:1s are the cheapest way to catch problems early." />
            ) : (
              <div className="divide-y divide-line">
                {meetings1.map((o) => (
                  <div key={o.id} className="group px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-muted">{formatDate(o.held_on, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</p>
                      <form action={deleteOneOnOne.bind(null, slug, o.id)}>
                        <button type="submit" className="rounded p-1 text-faint opacity-100 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100" aria-label="Delete 1:1">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </div>
                    {o.talking_points && (
                      <div className="mt-1">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-faint">Talking points</p>
                        <p className="whitespace-pre-line text-sm text-fg">{o.talking_points}</p>
                      </div>
                    )}
                    {o.notes && (
                      <div className="mt-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-faint">Notes</p>
                        <p className="whitespace-pre-line text-sm text-fg">{o.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Weekly check-ins"
              description="Wins, blockers and plans."
              action={
                <FormDialog title={`Log check-in for ${firstName}`} trigger="Log" triggerSize="sm" triggerVariant="secondary" triggerIcon={<Plus className="h-3.5 w-3.5" />} action={upsertCheckin.bind(null, slug, member.id)}>
                  <CheckinFields />
                </FormDialog>
              }
            />
            {weekly.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="No check-ins yet" description="Log one each week to spot trends in mood and blockers." />
            ) : (
              <div className="divide-y divide-line">
                {weekly.map((c) => (
                  <div key={c.id} className="group space-y-1.5 px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-muted">Week of {formatDate(c.week_start)}</p>
                      <div className="flex items-center gap-1">
                        {c.mood ? <Badge tone={moodTone(c.mood)}>{moodLabel(c.mood)}</Badge> : null}
                        <form action={deleteCheckin.bind(null, slug, c.id)}>
                          <button type="submit" className="rounded p-1 text-faint opacity-100 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100" aria-label="Delete check-in">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      </div>
                    </div>
                    {c.wins && (
                      <p className="whitespace-pre-line">
                        <span className="font-medium text-success">Wins: </span>
                        {c.wins}
                      </p>
                    )}
                    {c.blockers && (
                      <p className="whitespace-pre-line">
                        <span className="font-medium text-danger">Blockers: </span>
                        {c.blockers}
                      </p>
                    )}
                    {c.plans && (
                      <p className="whitespace-pre-line">
                        <span className="font-medium text-muted">Next: </span>
                        {c.plans}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return <AsyncPage render={TeamMemberPage} title={"Team member"} />;
}
