import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import type { Project, Task, TeamMember } from "@/lib/types";

/** Form fields for creating/editing a task. Use inside <FormDialog action={createTask.bind(null, slug)}>. */
export function TaskFields({
  team,
  projects = [],
  task,
  defaults = {},
  showStatus = !!task,
}: {
  team: TeamMember[];
  projects?: Pick<Project, "id" | "name">[];
  task?: Task;
  defaults?: Partial<Pick<Task, "assignee_id" | "project_id" | "due_date" | "priority" | "meeting_id" | "status">>;
  showStatus?: boolean;
}) {
  const v = { ...defaults, ...task };
  return (
    <>
      <Field label="Title">
        <Input name="title" required defaultValue={v.title ?? ""} placeholder="What needs to happen?" autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Owner">
          <Select name="assignee_id" defaultValue={v.assignee_id ?? ""}>
            <option value="">Me (default)</option>
            {team
              .filter((t) => t.status === "active")
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Priority">
          <Select name="priority" defaultValue={v.priority ?? "medium"}>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due date">
          <Input type="date" name="due_date" defaultValue={v.due_date ?? ""} />
        </Field>
        <Field label="Follow up on" hint="For delegated work">
          <Input type="date" name="follow_up_date" defaultValue={task?.follow_up_date ?? ""} />
        </Field>
        {projects.length > 0 && (
          <Field label="Project">
            <Select name="project_id" defaultValue={v.project_id ?? ""}>
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Repeats">
          <Select name="recurrence" defaultValue={task?.recurrence ?? ""}>
            <option value="">Never</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </Select>
        </Field>
        {showStatus && (
          <Field label="Status">
            <Select name="status" defaultValue={v.status ?? "todo"}>
              {TASK_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      <div className="flex flex-wrap gap-4">
        <Checkbox name="is_important" label="Important" defaultChecked={task?.is_important} />
        <Checkbox name="is_urgent" label="Urgent" defaultChecked={task?.is_urgent} />
      </div>
      <Field label="Notes">
        <Textarea name="notes" defaultValue={task?.notes ?? ""} placeholder="Context, links, definition of done…" />
      </Field>
      {defaults.meeting_id && (
        <>
          <input type="hidden" name="meeting_id" value={defaults.meeting_id} />
          <input type="hidden" name="source" value="meeting" />
        </>
      )}
      {!showStatus && defaults.status && <input type="hidden" name="status" value={defaults.status} />}
    </>
  );
}
