import { getWorkspace } from "@/lib/workspace";
import { refreshWorkspace } from "@/lib/revalidate";
import { bool, isoDate, str, todayISO } from "@/lib/utils";
import type { ActionState, Task, TaskStatus } from "@/lib/types";

const STATUSES: TaskStatus[] = ["todo", "in_progress", "waiting", "done"];

function taskFields(fd: FormData) {
  const priority = str(fd, "priority") ?? "medium";
  return {
    title: str(fd, "title") ?? "",
    notes: str(fd, "notes"),
    priority,
    status: (str(fd, "status") as TaskStatus) ?? "todo",
    assignee_id: str(fd, "assignee_id"),
    project_id: str(fd, "project_id"),
    due_date: str(fd, "due_date"),
    follow_up_date: str(fd, "follow_up_date"),
    recurrence: str(fd, "recurrence"),
    is_important: bool(fd, "is_important"),
    is_urgent: bool(fd, "is_urgent"),
  };
}

/** Create a task. Bind: createTask.bind(null, slug). Optional hidden fields: meeting_id, source. */
export async function createTask(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, workspace, user, me } = await getWorkspace(slug);
  const f = taskFields(fd);
  if (!f.title) return { error: "Give the task a title." };
  const assignee = f.assignee_id ?? me?.id ?? null;
  const delegated = assignee && me && assignee !== me.id;
  const { error } = await supabase.from("tasks").insert({
    ...f,
    // New urgent/high tasks start in the right Focus quadrant.
    is_important: f.is_important || f.priority === "urgent" || f.priority === "high",
    is_urgent: f.is_urgent || f.priority === "urgent",
    status: STATUSES.includes(f.status) ? f.status : "todo",
    assignee_id: assignee,
    delegated_by_id: delegated ? me!.id : null,
    meeting_id: str(fd, "meeting_id"),
    source: str(fd, "source") ?? "manual",
    workspace_id: workspace.id,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  return { ok: true };
}

/** Update a task from a full edit form. Bind: updateTask.bind(null, slug, id). */
export async function updateTask(slug: string, id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, me } = await getWorkspace(slug);
  const f = taskFields(fd);
  if (!f.title) return { error: "Give the task a title." };
  const assignee = f.assignee_id ?? me?.id ?? null;
  const delegated = assignee && me && assignee !== me.id;
  const { error } = await supabase
    .from("tasks")
    .update({
      ...f,
      assignee_id: assignee,
      delegated_by_id: delegated ? me!.id : null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  // Keep the original completion time when editing an already-done task.
  if (f.status === "done") {
    await supabase.from("tasks").update({ completed_at: new Date().toISOString() }).eq("id", id).is("completed_at", null);
  } else {
    await supabase.from("tasks").update({ completed_at: null }).eq("id", id);
  }
  refreshWorkspace(slug);
  return { ok: true };
}

function nextDue(due: string | null, recurrence: Task["recurrence"]) {
  const d = new Date(`${due ?? todayISO()}T00:00:00`);
  if (recurrence === "daily") d.setDate(d.getDate() + 1);
  if (recurrence === "weekly") d.setDate(d.getDate() + 7);
  if (recurrence === "monthly") d.setMonth(d.getMonth() + 1);
  return isoDate(d);
}

/** Toggle done / not done. Recurring tasks spawn their next occurrence when completed. */
export async function toggleTask(slug: string, id: string): Promise<void> {
  const { supabase } = await getWorkspace(slug);
  const { data: task } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle<Task>();
  if (!task) return;
  const done = task.status !== "done";
  await supabase
    .from("tasks")
    .update({ status: done ? "done" : "todo", completed_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (done && task.recurrence) {
    const { id: _id, created_at: _c, completed_at: _d, ...rest } = task;
    await supabase.from("tasks").insert({ ...rest, status: "todo", due_date: nextDue(task.due_date, task.recurrence) });
  }
  refreshWorkspace(slug);
}

export async function setTaskStatus(slug: string, id: string, status: TaskStatus): Promise<void> {
  if (!STATUSES.includes(status)) return;
  const { supabase } = await getWorkspace(slug);
  await supabase
    .from("tasks")
    .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
    .eq("id", id);
  refreshWorkspace(slug);
}

/** Move a task in the Eisenhower matrix. */
export async function setTaskQuadrant(slug: string, id: string, important: boolean, urgent: boolean): Promise<void> {
  const { supabase } = await getWorkspace(slug);
  await supabase.from("tasks").update({ is_important: important, is_urgent: urgent }).eq("id", id);
  refreshWorkspace(slug);
}

/** Push a follow-up date forward (used by the delegation tracker). */
export async function snoozeFollowUp(slug: string, id: string, days: number): Promise<void> {
  const { supabase } = await getWorkspace(slug);
  await supabase.from("tasks").update({ follow_up_date: todayISO(days) }).eq("id", id);
  refreshWorkspace(slug);
}

export async function deleteTask(slug: string, id: string): Promise<void> {
  const { supabase } = await getWorkspace(slug);
  await supabase.from("tasks").delete().eq("id", id);
  refreshWorkspace(slug);
}
