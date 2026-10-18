"use client";
import { useOptimistic, useState, useTransition } from "react";
import { setTaskStatus } from "@/actions/tasks";
import type { Task, TaskStatus } from "@/lib/types";
import { cn, initials } from "@/lib/utils";

const COLUMNS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting", label: "Waiting" },
  { value: "done", label: "Done" },
];

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-danger",
  high: "bg-warning",
  medium: "bg-accent",
  low: "bg-faint",
};

/** Kanban board: drag cards between status columns. Pure data props so it can be a client component. */
export function TaskBoard({
  slug,
  tasks,
  people,
  projects,
  today,
}: {
  slug: string;
  tasks: Task[];
  people: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  today: string;
}) {
  const [, startTransition] = useTransition();
  const [optimistic, move] = useOptimistic(tasks, (state: Task[], a: { id: string; status: TaskStatus }) =>
    state.map((t) => (t.id === a.id ? { ...t, status: a.status } : t)),
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);

  function drop(status: TaskStatus) {
    const id = dragId;
    setDragId(null);
    setOver(null);
    if (!id) return;
    const task = optimistic.find((t) => t.id === id);
    if (!task || task.status === status) return;
    startTransition(async () => {
      move({ id, status });
      await setTaskStatus(slug, id, status);
    });
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="grid min-w-[880px] grid-cols-4 gap-3">
        {COLUMNS.map((col) => {
          const items = optimistic.filter((t) => t.status === col.value);
          return (
            <div
              key={col.value}
              onDragOver={(e: React.DragEvent) => {
                e.preventDefault();
                setOver(col.value);
              }}
              onDragLeave={() => setOver((o) => (o === col.value ? null : o))}
              onDrop={(e: React.DragEvent) => {
                e.preventDefault();
                drop(col.value);
              }}
              className={cn(
                "flex min-h-[320px] flex-col rounded-xl border bg-surface-2/60 p-2 transition-colors",
                over === col.value ? "border-accent bg-accent-soft/50" : "border-line",
              )}
            >
              <div className="mb-2 flex items-center justify-between px-1.5 pt-1">
                <p className="text-xs font-semibold text-fg">{col.label}</p>
                <span className="text-[11px] tabular-nums text-faint">{items.length}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {items.map((t) => {
                  const who = people.find((p) => p.id === t.assignee_id);
                  const project = projects.find((p) => p.id === t.project_id);
                  const overdue = t.status !== "done" && !!t.due_date && t.due_date < today;
                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e: React.DragEvent) => {
                        setDragId(t.id);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", t.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOver(null);
                      }}
                      className={cn(
                        "cursor-grab rounded-lg border border-line bg-surface p-2.5 shadow-sm active:cursor-grabbing",
                        dragId === t.id && "opacity-50",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", PRIORITY_DOT[t.priority])} />
                        <p className={cn("text-sm leading-snug", t.status === "done" && "text-faint line-through")}>{t.title}</p>
                      </div>
                      <div className="mt-2 flex items-center gap-2 pl-3.5 text-[11px] text-faint">
                        {project && <span className="truncate">{project.name}</span>}
                        <span className="flex-1" />
                        {t.due_date && <span className={cn("tabular-nums", overdue && "font-medium text-danger")}>{t.due_date.slice(5).replace("-", "/")}</span>}
                        {who && (
                          <span title={who.name} className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-[9px] font-semibold text-accent">
                            {initials(who.name)}
                          </span>
                        )}
                      </div>
                      {/* Keyboard / touch fallback */}
                      <select
                        aria-label="Move to"
                        value={t.status}
                        onChange={(e) => {
                          const status = e.target.value as TaskStatus;
                          startTransition(async () => {
                            move({ id: t.id, status });
                            await setTaskStatus(slug, t.id, status);
                          });
                        }}
                        className="mt-2 w-full rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px] text-muted sm:hidden"
                      >
                        {COLUMNS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
                {items.length === 0 && <p className="px-1.5 py-4 text-center text-[11px] text-faint">Drop tasks here</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
