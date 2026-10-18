import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { PROJECT_STATUSES } from "@/lib/constants";
import type { Goal, Project, TeamMember } from "@/lib/types";

export function ProjectFields({
  team,
  goals,
  project,
  defaultGoalId,
}: {
  team: TeamMember[];
  goals: Pick<Goal, "id" | "title" | "quarter">[];
  project?: Project;
  defaultGoalId?: string;
}) {
  return (
    <>
      <Field label="Name">
        <Input name="name" required defaultValue={project?.name ?? ""} placeholder="Launch v2 onboarding" autoFocus />
      </Field>
      <Field label="Description">
        <Textarea name="description" defaultValue={project?.description ?? ""} placeholder="What does done look like?" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Owner">
          <Select name="owner_id" defaultValue={project?.owner_id ?? ""}>
            <option value="">Me</option>
            {team
              .filter((t) => t.status === "active")
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={project?.status ?? "active"}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Supports goal">
          <Select name="goal_id" defaultValue={project?.goal_id ?? defaultGoalId ?? ""}>
            <option value="">None</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.quarter} · {g.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due date">
          <Input type="date" name="due_date" defaultValue={project?.due_date ?? ""} />
        </Field>
      </div>
    </>
  );
}
