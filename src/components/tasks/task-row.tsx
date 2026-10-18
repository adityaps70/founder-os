import { Check, Pencil, Repeat, Trash2 } from "lucide-react";
import { deleteTask, toggleTask, updateTask } from "@/actions/tasks";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FormDialog } from "@/components/ui/form-dialog";
import { labelFor, PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import type { Project, Task, TeamMember } from "@/lib/types";
import { cn, isOverdue, relativeDay } from "@/lib/utils";
import { TaskFields } from "./task-fields";

/** One task line with complete toggle, metadata and an edit dialog. Server component. */
export function TaskRow({
  slug,
  task,
  team,
  projects = [],
  showAssignee = true,
  showStatus = false,
  compact = false,
}: {
  slug: string;
  task: Task;
  team: TeamMember[];
  projects?: Pick<Project, "id" | "name">[];
  showAssignee?: boolean;
  showStatus?: boolean;
  compact?: boolean;
}) {
  const done = task.status === "done";
  const assignee = team.find((t) => t.id === task.assignee_id);
  const project = projects.find((p) => p.id === task.project_id);
  const priority = labelFor(PRIORITIES, task.priority);
  const status = labelFor(TASK_STATUSES, task.status);
  const overdue = !done && isOverdue(task.due_date);

  return (
    <div className={cn("group flex items-center gap-3 px-4", compact ? "py-2" : "py-2.5")}>
      <form action={toggleTask.bind(null, slug, task.id)}>
        <button
          type="submit"
          aria-label={done ? "Mark as not done" : "Mark as done"}
          className={cn(
            "flex h-[18px] w-[18px] items-center justify-center rounded-full border transition-colors",
            done ? "border-success bg-success text-white" : "border-faint hover:border-accent",
          )}
        >
          {done && <Check className="h-3 w-3" strokeWidth={3} />}
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm", done ? "text-faint line-through" : "text-fg")}>{task.title}</p>
        {!compact && (project || task.notes) && (
          <p className="truncate text-xs text-faint">{[project?.name, task.notes].filter(Boolean).join(" · ")}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {task.recurrence && <Repeat className="h-3.5 w-3.5 text-faint" aria-label={`Repeats ${task.recurrence}`} />}
        {showStatus && status && <Badge tone={status.tone}>{status.label}</Badge>}
        {priority && (task.priority === "urgent" || task.priority === "high") && !done && <Badge tone={priority.tone}>{priority.label}</Badge>}
        {task.due_date && (
          <span className={cn("text-xs tabular-nums", overdue ? "font-medium text-danger" : "text-muted")}>{relativeDay(task.due_date)}</span>
        )}
        {showAssignee && assignee && <Avatar name={assignee.name} size="sm" />}

        <div className="flex items-center opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <FormDialog
            title="Edit task"
            trigger={<Pencil className="h-3.5 w-3.5" />}
            triggerVariant="ghost"
            triggerSize="icon"
            action={updateTask.bind(null, slug, task.id)}
          >
            <TaskFields team={team} projects={projects} task={task} />
          </FormDialog>
          <form action={deleteTask.bind(null, slug, task.id)}>
            <button type="submit" className="flex h-8 w-8 items-center justify-center rounded-lg text-faint hover:bg-surface-2 hover:text-danger" aria-label="Delete task">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/** A bordered list of TaskRows with dividers. */
export function TaskList({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-line">{children}</div>;
}
