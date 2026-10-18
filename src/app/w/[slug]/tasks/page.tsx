import Link from "next/link";
import { SquareCheckBig, LayoutList, Columns3, Plus } from "lucide-react";
import { createTask } from "@/actions/tasks";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskFields } from "@/components/tasks/task-fields";
import { TaskList, TaskRow } from "@/components/tasks/task-row";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { FormDialog } from "@/components/ui/form-dialog";
import { PRIORITY_RANK } from "@/lib/constants";
import type { Project, Task } from "@/lib/types";
import { cn, todayISO } from "@/lib/utils";
import { getWorkspace } from "@/lib/workspace";

export const metadata = { title: "Tasks" };

type Who = "mine" | "all" | "delegated";
type Status = "open" | "done";
type View = "list" | "board";

function pick<T extends string>(v: string | undefined, allowed: T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

export default async function TasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ who?: string; status?: string; view?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const who = pick<Who>(sp.who, ["mine", "all", "delegated"], "mine");
  const view = pick<View>(sp.view, ["list", "board"], "list");
  const status = view === "board" ? "open" : pick<Status>(sp.status, ["open", "done"], "open");

  const { supabase, workspace, me, team } = await getWorkspace(slug);
  const meId = me?.id ?? "00000000-0000-0000-0000-000000000000";
  const today = todayISO();
  const weekEnd = todayISO(7);

  let q = supabase.from("tasks").select("*").eq("workspace_id", workspace.id);
  if (who === "mine") q = q.eq("assignee_id", meId);
  if (who === "delegated") q = q.neq("assignee_id", meId);
  if (view === "list") {
    q = status === "done" ? q.eq("status", "done").order("completed_at", { ascending: false }).limit(100) : q.neq("status", "done").limit(500);
  } else {
    // Board shows open work plus anything finished in the last 7 days.
    q = q.or(`status.neq.done,completed_at.gte."${new Date(Date.now() - 7 * 864e5).toISOString()}"`).limit(500);
  }

  const [{ data }, { data: projectRows }] = await Promise.all([
    q,
    supabase.from("projects").select("id, name").eq("workspace_id", workspace.id).order("name"),
  ]);
  const tasks = (data ?? []) as Task[];
  const projects = (projectRows ?? []) as Pick<Project, "id" | "name">[];

  const byPriority = (a: Task, b: Task) =>
    (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];

  const groups =
    status === "done"
      ? [{ key: "done", label: "Recently completed", items: tasks }]
      : [
          { key: "overdue", label: "Overdue", items: tasks.filter((t) => t.due_date && t.due_date < today) },
          { key: "today", label: "Today", items: tasks.filter((t) => t.due_date === today) },
          { key: "week", label: "Next 7 days", items: tasks.filter((t) => t.due_date && t.due_date > today && t.due_date <= weekEnd) },
          { key: "later", label: "Later", items: tasks.filter((t) => t.due_date && t.due_date > weekEnd) },
          { key: "none", label: "No date", items: tasks.filter((t) => !t.due_date) },
        ].map((g) => ({ ...g, items: g.items.sort(byPriority) }));

  const href = (patch: Partial<{ who: Who; status: Status; view: View }>) => {
    const p = new URLSearchParams({ who, status, view, ...patch });
    return `/w/${slug}/tasks?${p.toString()}`;
  };
  const pill = (active: boolean) =>
    cn("rounded-md px-2.5 py-1 text-xs font-medium", active ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg");

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Everything on your plate and your team's."
        actions={
          <FormDialog title="New task" trigger="New task" triggerIcon={<Plus className="h-4 w-4" />} action={createTask.bind(null, slug)} submitLabel="Add task">
            <TaskFields team={team} projects={projects} />
          </FormDialog>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-surface-2 p-0.5">
          {(
            [
              ["mine", "Mine"],
              ["delegated", "Delegated"],
              ["all", "Everyone"],
            ] as const
          ).map(([v, l]) => (
            <Link key={v} href={href({ who: v })} className={pill(who === v)}>
              {l}
            </Link>
          ))}
        </div>
        {view === "list" && (
          <div className="flex rounded-lg bg-surface-2 p-0.5">
            <Link href={href({ status: "open" })} className={pill(status === "open")}>
              Open
            </Link>
            <Link href={href({ status: "done" })} className={pill(status === "done")}>
              Done
            </Link>
          </div>
        )}
        <span className="flex-1" />
        <div className="flex rounded-lg bg-surface-2 p-0.5">
          <Link href={href({ view: "list" })} className={cn(pill(view === "list"), "inline-flex items-center gap-1")}>
            <LayoutList className="h-3.5 w-3.5" /> List
          </Link>
          <Link href={href({ view: "board" })} className={cn(pill(view === "board"), "inline-flex items-center gap-1")}>
            <Columns3 className="h-3.5 w-3.5" /> Board
          </Link>
        </div>
      </div>

      {view === "board" ? (
        <TaskBoard
          slug={slug}
          tasks={tasks}
          people={team.map((t) => ({ id: t.id, name: t.name }))}
          projects={projects}
          today={today}
        />
      ) : tasks.length === 0 ? (
        <Card>
          <EmptyState
            icon={SquareCheckBig}
            title={status === "done" ? "Nothing completed yet" : "No open tasks"}
            description={
              who === "delegated"
                ? "Assign a task to someone on your team and track it here."
                : "Add a task, or press ⌘K anywhere to capture one."
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <Card key={g.key}>
                <div className="flex items-center justify-between border-b border-line px-4 py-2">
                  <p className={cn("text-xs font-semibold", g.key === "overdue" ? "text-danger" : "text-fg")}>{g.label}</p>
                  <span className="text-[11px] tabular-nums text-faint">{g.items.length}</span>
                </div>
                <TaskList>
                  {g.items.map((t) => (
                    <TaskRow key={t.id} slug={slug} task={t} team={team} projects={projects} showAssignee={who !== "mine"} showStatus={t.status !== "todo" && t.status !== "done"} />
                  ))}
                </TaskList>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
