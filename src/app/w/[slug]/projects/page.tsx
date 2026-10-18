import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { createProject } from "@/actions/projects";
import { ProjectFields } from "@/components/projects/project-fields";
import { Avatar, Badge, Card, EmptyState, PageHeader, Progress } from "@/components/ui";
import { FormDialog } from "@/components/ui/form-dialog";
import { labelFor, PROJECT_STATUSES } from "@/lib/constants";
import type { Goal, Project, Task } from "@/lib/types";
import { cn, formatDate, isOverdue } from "@/lib/utils";
import { getWorkspace } from "@/lib/workspace";

export const metadata = { title: "Projects" };

const ORDER: Record<string, number> = { active: 0, planned: 1, paused: 2, done: 3 };

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ show?: string }>;
}) {
  const { slug } = await params;
  const { show } = await searchParams;
  const showDone = show === "all";
  const { supabase, workspace, team } = await getWorkspace(slug);

  const [{ data: projectRows }, { data: taskRows }, { data: goalRows }] = await Promise.all([
    supabase.from("projects").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }),
    supabase.from("tasks").select("project_id, status").eq("workspace_id", workspace.id).not("project_id", "is", null),
    supabase.from("goals").select("id, title, quarter").eq("workspace_id", workspace.id).order("quarter", { ascending: false }),
  ]);
  const all = ((projectRows ?? []) as Project[]).sort((a, b) => ORDER[a.status]! - ORDER[b.status]!);
  const projects = showDone ? all : all.filter((p) => p.status !== "done");
  const doneCount = all.length - all.filter((p) => p.status !== "done").length;
  const tasks = (taskRows ?? []) as Pick<Task, "project_id" | "status">[];
  const goals = (goalRows ?? []) as Pick<Goal, "id" | "title" | "quarter">[];

  const stats = (id: string) => {
    const ts = tasks.filter((t) => t.project_id === id);
    const done = ts.filter((t) => t.status === "done").length;
    return { total: ts.length, done, pct: ts.length ? (done / ts.length) * 100 : 0 };
  };

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Bodies of work that move your goals forward."
        actions={
          <FormDialog title="New project" trigger="New project" triggerIcon={<Plus className="h-4 w-4" />} action={createProject.bind(null, slug)} submitLabel="Create project">
            <ProjectFields team={team} goals={goals} />
          </FormDialog>
        }
      />

      {all.length === 0 ? (
        <Card>
          <EmptyState icon={FolderKanban} title="No projects yet" description="Group related tasks into a project, link it to a goal, and track progress automatically." />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const s = stats(p.id);
              const st = labelFor(PROJECT_STATUSES, p.status);
              const owner = team.find((t) => t.id === p.owner_id);
              const goal = goals.find((g) => g.id === p.goal_id);
              const late = p.status !== "done" && isOverdue(p.due_date);
              return (
                <Link key={p.id} href={`/w/${slug}/projects/${p.id}`} className="group rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent/50">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold group-hover:text-accent">{p.name}</p>
                    {st && <Badge tone={st.tone}>{st.label}</Badge>}
                  </div>
                  {goal && <p className="mt-1 truncate text-xs text-muted">↳ {goal.title}</p>}
                  {p.description && <p className="mt-2 line-clamp-2 text-xs text-faint">{p.description}</p>}
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-[11px] text-muted">
                      <span>
                        {s.done}/{s.total} tasks
                      </span>
                      <span className="tabular-nums">{Math.round(s.pct)}%</span>
                    </div>
                    <Progress value={s.pct} tone={p.status === "done" ? "good" : "accent"} />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    {owner ? <Avatar name={owner.name} size="sm" /> : <span />}
                    {p.due_date && <span className={cn("text-xs", late ? "font-medium text-danger" : "text-muted")}>Due {formatDate(p.due_date)}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
          {doneCount > 0 && (
            <p className="mt-4 text-center text-xs">
              <Link className="text-muted hover:text-fg" href={`/w/${slug}/projects${showDone ? "" : "?show=all"}`}>
                {showDone ? "Hide completed projects" : `Show ${doneCount} completed project${doneCount === 1 ? "" : "s"}`}
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}
