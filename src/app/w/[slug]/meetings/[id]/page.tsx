import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, SquareCheckBig, Gavel, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { createDecision } from "@/actions/decisions";
import { deleteMeeting, updateMeeting, updateMeetingNotes } from "@/actions/meetings";
import { createTask } from "@/actions/tasks";
import { DecisionCard } from "@/components/decisions/decision-card";
import { DecisionFields } from "@/components/decisions/decision-fields";
import { LocalTime } from "@/components/meetings/local-time";
import { MeetingFields } from "@/components/meetings/meeting-fields";
import { TaskFields } from "@/components/tasks/task-fields";
import { TaskList, TaskRow } from "@/components/tasks/task-row";
import { Avatar, ButtonLink, Card, CardBody, CardHeader, EmptyState } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { FormDialog } from "@/components/ui/form-dialog";
import { Field, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Decision, Meeting, Project, Task, TeamMember } from "@/lib/types";
import { getWorkspace } from "@/lib/workspace";

export const metadata = { title: "Meeting" };

export default async function MeetingPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await getWorkspace(slug);
  const { supabase, workspace, team } = ctx;

  const { data: row } = await supabase.from("meetings").select("*").eq("id", id).eq("workspace_id", workspace.id).maybeSingle();
  if (!row) notFound();
  const meeting = row as Meeting;

  const [{ data: taskRows }, { data: decisionRows }, { data: projectRows }] = await Promise.all([
    supabase.from("tasks").select("*").eq("meeting_id", id).order("created_at"),
    supabase.from("decisions").select("*").eq("meeting_id", id).order("created_at"),
    supabase.from("projects").select("id, name").eq("workspace_id", workspace.id).neq("status", "done").order("name"),
  ]);
  const tasks = ((taskRows ?? []) as Task[]).sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));
  const decisions = (decisionRows ?? []) as Decision[];
  const projects = (projectRows ?? []) as Pick<Project, "id" | "name">[];
  const attendees = meeting.attendee_ids.map((a) => team.find((t) => t.id === a)).filter((t): t is TeamMember => !!t);
  const meetingRef = [{ id: meeting.id, title: meeting.title, starts_at: meeting.starts_at }];
  const copilotHref = `/w/${slug}/copilot?prompt=${encodeURIComponent(
    `Summarise the notes from the meeting "${meeting.title}" and draft a short follow-up message to attendees with decisions and action items.`,
  )}`;

  return (
    <>
      <Link href={`/w/${slug}/meetings`} className="mb-4 inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
        <ArrowLeft className="h-3.5 w-3.5" /> Meetings
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{meeting.title}</h1>
          <p className="mt-1 text-sm text-muted">
            <LocalTime iso={meeting.starts_at} format="weekday" /> · <LocalTime iso={meeting.starts_at} format="time" />
          </p>
          {attendees.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {attendees.map((a) => (
                <Link key={a.id} href={`/w/${slug}/team/${a.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-0.5 pl-0.5 pr-2.5 text-xs hover:border-accent/50">
                  <Avatar name={a.name} size="sm" /> {a.name}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {meeting.notes && (
            <ButtonLink href={copilotHref} variant="secondary">
              <Sparkles className="h-4 w-4" /> Draft follow-up
            </ButtonLink>
          )}
          <FormDialog title="Edit meeting" trigger="Edit" triggerVariant="secondary" triggerIcon={<Pencil className="h-3.5 w-3.5" />} action={updateMeeting.bind(null, slug, meeting.id)} wide>
            <MeetingFields team={team} meeting={meeting} />
          </FormDialog>
          <form action={deleteMeeting.bind(null, slug, meeting.id)}>
            <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-muted hover:bg-red-500/10 hover:text-danger">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Agenda & notes" />
          <CardBody>
            <ActionForm action={updateMeetingNotes.bind(null, slug, meeting.id)} resetOnSuccess={false} className="space-y-4">
              <Field label="Agenda">
                <Textarea name="agenda" rows={5} defaultValue={meeting.agenda ?? ""} placeholder="What do we need to cover?" />
              </Field>
              <Field label="Notes">
                <Textarea name="notes" rows={12} defaultValue={meeting.notes ?? ""} placeholder="What was discussed…" />
              </Field>
              <div className="flex justify-end">
                <SubmitButton pendingText="Saving…">Save notes</SubmitButton>
              </div>
            </ActionForm>
          </CardBody>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Action items"
              description="Each one is a task with an owner."
              action={
                <FormDialog title="Add action item" trigger="Add" triggerSize="sm" triggerIcon={<Plus className="h-3.5 w-3.5" />} action={createTask.bind(null, slug)}>
                  <TaskFields team={team} projects={projects} defaults={{ meeting_id: meeting.id }} />
                </FormDialog>
              }
            />
            {tasks.length === 0 ? (
              <EmptyState icon={SquareCheckBig} title="No action items yet" />
            ) : (
              <TaskList>
                {tasks.map((t) => (
                  <TaskRow key={t.id} slug={slug} task={t} team={team} projects={projects} compact />
                ))}
              </TaskList>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Decisions"
              action={
                <FormDialog title="Log decision" trigger="Log" triggerSize="sm" triggerVariant="secondary" triggerIcon={<Plus className="h-3.5 w-3.5" />} action={createDecision.bind(null, slug)} wide>
                  <DecisionFields team={team} meetingId={meeting.id} defaultDecidedBy={ctx.me?.id} />
                </FormDialog>
              }
            />
            {decisions.length === 0 ? (
              <EmptyState icon={Gavel} title="No decisions logged" />
            ) : (
              <div className="divide-y divide-line">
                {decisions.map((d) => (
                  <DecisionCard key={d.id} slug={slug} decision={d} team={team} meetings={meetingRef} showMeeting={false} />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
