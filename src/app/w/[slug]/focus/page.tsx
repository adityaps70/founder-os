import { ArrowDownRight, ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import { createTask, setTaskQuadrant } from "@/actions/tasks";
import { TaskFields } from "@/components/tasks/task-fields";
import { TaskList, TaskRow } from "@/components/tasks/task-row";
import { PageHeader } from "@/components/ui";
import { FormDialog } from "@/components/ui/form-dialog";
import { PRIORITY_RANK } from "@/lib/constants";
import type { Project, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getWorkspace } from "@/lib/workspace";

export const metadata = { title: "Focus" };

type Quadrant = { key: string; title: string; hint: string; important: boolean; urgent: boolean; accent: string };

const QUADRANTS: Quadrant[] = [
  { key: "do", title: "Do now", hint: "Important and urgent. Clear these today.", important: true, urgent: true, accent: "border-t-danger" },
  { key: "schedule", title: "Schedule", hint: "Important, not urgent. This is where the company is built. Block time for it.", important: true, urgent: false, accent: "border-t-accent" },
  { key: "delegate", title: "Delegate", hint: "Urgent, not important. Hand off to someone on your team.", important: false, urgent: true, accent: "border-t-warning" },
  { key: "drop", title: "Eliminate", hint: "Neither. Drop it, or batch it for later.", important: false, urgent: false, accent: "border-t-faint" },
];

export default async function FocusPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, workspace, me, team } = await getWorkspace(slug);
  const meId = me?.id ?? "00000000-0000-0000-0000-000000000000";

  const [{ data }, { data: projectRows }] = await Promise.all([
    supabase.from("tasks").select("*").eq("workspace_id", workspace.id).eq("assignee_id", meId).neq("status", "done").limit(300),
    supabase.from("projects").select("id, name").eq("workspace_id", workspace.id).order("name"),
  ]);
  const tasks = ((data ?? []) as Task[]).sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"),
  );
  const projects = (projectRows ?? []) as Pick<Project, "id" | "name">[];

  return (
    <div>
      <PageHeader
        title="Focus"
        description="Sort your open tasks by what matters, not just what's loud (the Eisenhower matrix)."
        actions={
          <FormDialog title="New task" trigger="New task" triggerIcon={<Plus className="h-4 w-4" />} action={createTask.bind(null, slug)} submitLabel="Add task">
            <TaskFields team={team} projects={projects} />
          </FormDialog>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        {QUADRANTS.map((q) => {
          const items = tasks.filter((t) => t.is_important === q.important && t.is_urgent === q.urgent);
          const others = QUADRANTS.filter((o) => o.key !== q.key);
          return (
            <section key={q.key} className={cn("flex flex-col rounded-xl border border-t-2 border-line bg-surface", q.accent)}>
              <div className="border-b border-line px-4 py-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">{q.title}</h2>
                  <span className="text-xs tabular-nums text-faint">{items.length}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted">{q.hint}</p>
              </div>
              <div className="max-h-[420px] flex-1 overflow-y-auto">
                {items.length === 0 ? (
                  <p className="px-4 py-8 text-center text-xs text-faint">Nothing here.</p>
                ) : (
                  <TaskList>
                    {items.map((t) => (
                      <div key={t.id}>
                        <TaskRow slug={slug} task={t} team={team} projects={projects} showAssignee={false} compact />
                        <div className="flex flex-wrap gap-1 px-4 pb-2 pl-11">
                          {others.map((o) => (
                            <form key={o.key} action={setTaskQuadrant.bind(null, slug, t.id, o.important, o.urgent)}>
                              <button
                                type="submit"
                                className="inline-flex items-center gap-0.5 rounded-md border border-line px-1.5 py-0.5 text-[11px] text-muted hover:border-accent hover:text-accent"
                              >
                                {o.key === "do" ? <ArrowUpRight className="h-3 w-3" /> : o.key === "drop" ? <ArrowDownRight className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
                                {o.title}
                              </button>
                            </form>
                          ))}
                        </div>
                      </div>
                    ))}
                  </TaskList>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-faint">
        Tip: tasks marked Urgent or High priority land in the top row automatically. Use the buttons to re-sort them.
      </p>
    </div>
  );
}
