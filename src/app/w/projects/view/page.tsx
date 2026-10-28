"use client";
import { AsyncPage } from "@/components/shell/async-page";
import Link from "next/link";
import { notFound } from "@/lib/nav";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { createTask } from "@/actions/tasks";
import { deleteProject, setProjectStatus, updateProject } from "@/actions/projects";
import { ProjectFields } from "@/components/projects/project-fields";
import { TaskFields } from "@/components/tasks/task-fields";
import { TaskList, TaskRow } from "@/components/tasks/task-row";
import { Avatar, Badge, Card, CardHeader, EmptyState, Stat } from "@/components/ui";
import { FormDialog } from "@/components/ui/form-dialog";
import { labelFor, PRIORITY_RANK, PROJECT_STATUSES } from "@/lib/constants";
import type { Goal, Project, Task } from "@/lib/types";
import { cn, formatDate, isOverdue } from "@/lib/utils";
import { getWorkspace } from "@/lib/workspace";

async function ProjectPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { supabase, workspace, team } = await getWorkspace(slug);

  const [{ data: project }, { data: taskRows }, { data: goalRows }, { data: projectRows }] = await Promise.all([
    supabase.from("projects").select("*").eq("workspace_id", workspace.id).eq("id", id).maybeSingle(),
    supabase.from("tasks").select("*").eq("workspace_id", workspace.id).eq("project_id", id).limit(500),
    supabase.from("goals").select("id, title, quarter").eq("workspace_id", workspace.id).order("quarter", { ascending: false }),
    supabase.from("projects").select("id, name").eq("workspace_id", workspace.id).order("name"),
  ]);
  if (!project) notFound();
  const p = project as Project;
  const tasks = (taskRows ?? []) as Task[];
  const goals = (goalRows ?? []) as Pick<Goal, "id" | "title" | "quarter">[];
  const projects = (projectRows ?? []) as Pick<Project, "id" | "name">[];

  const open = tasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  const done = tasks.filter((t) => t.status === "done").sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
  const pct = tasks.length ? (done.length / tasks.length) * 100 : 0;
  const overdue = open.filter((t) => isOverdue(t.due_date)).length;
  const st = labelFor(PROJECT_STATUSES, p.status);
  const owner = team.find((t) => t.id === p.owner_id);
  const goal = goals.find((g) => g.id === p.goal_id);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/w/projects`} className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
          <ArrowLeft className="h-3 w-3" /> Projects
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{p.name}</h1>
              {st && <Badge tone={st.tone}>{st.label}</Badge>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              {owner && (
                <span className="inline-flex items-center gap-1.5">
                  <Avatar name={owner.name} size="sm" /> {owner.name}
                </span>
              )}
              {goal && (
                <Link href={`/w/goals?q=${goal.quarter}`} className="hover:text-fg">
                  ↳ {goal.title}
                </Link>
              )}
              {p.due_date && <span className={cn(isOverdue(p.due_date) && p.status !== "done" && "text-danger")}>Due {formatDate(p.due_date)}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FormDialog title="Edit project" trigger="Edit" triggerVariant="secondary" triggerIcon={<Pencil className="h-3.5 w-3.5" />} action={updateProject.bind(null, slug, p.id)}>
              <ProjectFields team={team} goals={goals} project={p} />
            </FormDialog>
            <FormDialog title="New task" trigger="Add task" triggerIcon={<Plus className="h-4 w-4" />} action={createTask.bind(null, slug)} submitLabel="Add task">
              <TaskFields team={team} projects={projects} defaults={{ project_id: p.id }} />
            </FormDialog>
          </div>
        </div>
        {p.description && <p className="mt-3 max-w-3xl whitespace-pre-line text-sm text-muted">{p.description}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Progress" value={`${Math.round(pct)}%`} hint={`${done.length} of ${tasks.length} tasks done`} />
        <Stat label="Open tasks" value={open.length} />
        <Stat label="Completed" value={done.length} />
        <Stat label="Overdue" value={overdue} tone={overdue ? "bad" : "good"} hint={overdue ? "Needs attention" : "On schedule"} />
      </div>

      <Card>
        <CardHeader title="Open tasks" description={`${open.length} remaining`} />
        {open.length === 0 ? (
          <EmptyState title="No open tasks" description={tasks.length ? "Everything here is done. Mark the project complete?" : "Break the project down into the first few tasks."} />
        ) : (
          <TaskList>
            {open.map((t) => (
              <TaskRow key={t.id} slug={slug} task={t} team={team} projects={projects} showStatus={t.status !== "todo"} />
            ))}
          </TaskList>
        )}
      </Card>

      {done.length > 0 && (
        <Card>
          <CardHeader title="Completed" description={`${done.length} done`} />
          <TaskList>
            {done.slice(0, 30).map((t) => (
              <TaskRow key={t.id} slug={slug} task={t} team={team} projects={projects} compact />
            ))}
          </TaskList>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <div className="flex flex-wrap gap-1.5">
          <span className="self-center text-xs text-muted">Set status:</span>
          {PROJECT_STATUSES.filter((s) => s.value !== p.status).map((s) => (
            <form key={s.value} action={setProjectStatus.bind(null, slug, p.id, s.value)}>
              <button type="submit" className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:border-accent hover:text-accent">
                {s.label}
              </button>
            </form>
          ))}
        </div>
        <form action={deleteProject.bind(null, slug, p.id)}>
          <button type="submit" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-faint hover:text-danger">
            <Trash2 className="h-3.5 w-3.5" /> Delete project (tasks are kept)
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Page() {
  return <AsyncPage render={ProjectPage} title={"Project"} />;
}
