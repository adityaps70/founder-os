import Link from "next/link";
import { ChevronLeft, ChevronRight, FolderKanban, Pencil, Plus, Target, Trash2, X } from "lucide-react";
import { createGoal, createKeyResult, deleteGoal, deleteKeyResult, updateGoal, updateKeyResultValue } from "@/actions/goals";
import { GoalFields, KeyResultFields } from "@/components/goals/goal-fields";
import { goalProgress, krProgress, progressTone, shiftQuarter } from "@/components/goals/progress";
import { Avatar, Badge, buttonClass, Card, EmptyState, PageHeader, Progress } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { FormDialog } from "@/components/ui/form-dialog";
import { SubmitButton } from "@/components/ui/submit-button";
import { GOAL_STATUSES, labelFor } from "@/lib/constants";
import type { Goal, KeyResult, Project } from "@/lib/types";
import { currentQuarter, formatDate, formatNumber } from "@/lib/utils";
import { getWorkspace } from "@/lib/workspace";

export const metadata = { title: "Goals" };

export default async function GoalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug } = await params;
  const { q } = await searchParams;
  const quarter = q && /^\d{4}-Q[1-4]$/.test(q) ? q : currentQuarter();
  const { supabase, workspace, team } = await getWorkspace(slug);

  const { data: goalRows } = await supabase
    .from("goals")
    .select("*, key_results(*)")
    .eq("workspace_id", workspace.id)
    .eq("quarter", quarter)
    .order("created_at");
  const goals = (goalRows ?? []) as (Goal & { key_results: KeyResult[] })[];
  const goalIds = goals.map((g) => g.id);
  const { data: projectRows } = goalIds.length
    ? await supabase.from("projects").select("id, name, status, goal_id").in("goal_id", goalIds)
    : { data: [] };
  const projects = (projectRows ?? []) as Pick<Project, "id" | "name" | "status" | "goal_id">[];

  const overall = goals.length ? goals.reduce((s, g) => s + goalProgress(g.key_results ?? []), 0) / goals.length : 0;
  const base = `/w/${slug}/goals`;

  return (
    <div>
      <PageHeader
        title="Goals"
        description="Quarterly outcomes with measurable key results. Projects and tasks roll up to these."
        actions={
          <FormDialog title="New goal" trigger="New goal" triggerIcon={<Plus className="h-4 w-4" />} action={createGoal.bind(null, slug)} submitLabel="Create goal" wide>
            <GoalFields team={team} quarter={quarter} withKeyResult />
          </FormDialog>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-lg border border-line bg-surface">
          <Link href={`${base}?q=${shiftQuarter(quarter, -1)}`} className="p-2 text-muted hover:text-fg" aria-label="Previous quarter">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-20 text-center text-sm font-semibold tabular-nums">{quarter}</span>
          <Link href={`${base}?q=${shiftQuarter(quarter, 1)}`} className="p-2 text-muted hover:text-fg" aria-label="Next quarter">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        {quarter !== currentQuarter() && (
          <Link href={base} className="text-xs text-accent">
            Back to this quarter
          </Link>
        )}
        {goals.length > 0 && (
          <div className="ml-auto flex w-full items-center gap-3 sm:w-64">
            <span className="text-xs text-muted">Overall</span>
            <Progress value={overall} tone={progressTone(overall)} />
            <span className="text-xs font-medium tabular-nums">{Math.round(overall)}%</span>
          </div>
        )}
      </div>

      {goals.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title={`No goals for ${quarter}`}
            description="Pick 2–4 outcomes for the quarter and give each one or two measurable key results."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {goals.map((g) => {
            const krs = (g.key_results ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at));
            const p = goalProgress(krs);
            const st = labelFor(GOAL_STATUSES, g.status);
            const owner = team.find((t) => t.id === g.owner_id);
            const linked = projects.filter((pr) => pr.goal_id === g.id);
            return (
              <Card key={g.id}>
                <div className="flex flex-wrap items-start gap-3 border-b border-line px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold">{g.title}</h2>
                      {st && <Badge tone={st.tone}>{st.label}</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      {owner && (
                        <span className="inline-flex items-center gap-1.5">
                          <Avatar name={owner.name} size="sm" /> {owner.name}
                        </span>
                      )}
                      {g.target_date && <span>By {formatDate(g.target_date)}</span>}
                    </div>
                    {g.description && <p className="mt-1.5 text-xs text-faint">{g.description}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="mr-2 text-lg font-semibold tabular-nums">{Math.round(p)}%</span>
                    <FormDialog title="Edit goal" trigger={<Pencil className="h-3.5 w-3.5" />} triggerVariant="ghost" triggerSize="icon" action={updateGoal.bind(null, slug, g.id)}>
                      <GoalFields team={team} goal={g} quarter={quarter} />
                    </FormDialog>
                    <form action={deleteGoal.bind(null, slug, g.id)}>
                      <button type="submit" className="flex h-8 w-8 items-center justify-center rounded-lg text-faint hover:bg-surface-2 hover:text-danger" aria-label="Delete goal">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                </div>

                <div className="px-4 pt-3">
                  <Progress value={p} tone={progressTone(p)} />
                </div>

                <ul className="divide-y divide-line">
                  {krs.map((kr) => {
                    const kp = krProgress(kr);
                    const unit = kr.unit ? ` ${kr.unit}` : "";
                    return (
                      <li key={kr.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm">{kr.title}</p>
                            <span className="text-xs tabular-nums text-muted">
                              {formatNumber(Number(kr.current_value), 2)} / {formatNumber(Number(kr.target_value), 2)}
                              {unit}
                            </span>
                          </div>
                          <Progress value={kp} tone={progressTone(kp)} className="mt-1.5" />
                        </div>
                        <div className="flex items-center gap-1">
                          <ActionForm action={updateKeyResultValue.bind(null, slug, kr.id)} resetOnSuccess={false} className="flex items-center gap-1">
                            <input
                              name="current_value"
                              inputMode="decimal"
                              defaultValue={String(kr.current_value)}
                              aria-label={`Current value for ${kr.title}`}
                              className="h-8 w-24 rounded-lg border border-line bg-surface px-2 text-right text-sm tabular-nums focus:border-accent focus:outline-none"
                            />
                            <SubmitButton size="sm" variant="secondary">
                              Update
                            </SubmitButton>
                          </ActionForm>
                          <form action={deleteKeyResult.bind(null, slug, kr.id)}>
                            <button type="submit" className="flex h-8 w-8 items-center justify-center rounded-lg text-faint hover:text-danger" aria-label="Remove key result">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </form>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5">
                  <FormDialog
                    title="Add key result"
                    description={g.title}
                    trigger="Key result"
                    triggerVariant="ghost"
                    triggerSize="sm"
                    triggerIcon={<Plus className="h-3.5 w-3.5" />}
                    action={createKeyResult.bind(null, slug, g.id)}
                    submitLabel="Add"
                  >
                    <KeyResultFields />
                  </FormDialog>
                  {linked.length > 0 && <span className="h-4 w-px bg-line" />}
                  {linked.map((pr) => (
                    <Link
                      key={pr.id}
                      href={`/w/${slug}/projects/${pr.id}`}
                      className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-xs text-muted hover:text-fg"
                    >
                      <FolderKanban className="h-3 w-3" /> {pr.name}
                      {pr.status === "done" && <span className="text-success">✓</span>}
                    </Link>
                  ))}
                  {linked.length === 0 && (
                    <Link href={`/w/${slug}/projects`} className={buttonClass("ghost", "sm", "text-faint")}>
                      Link a project
                    </Link>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
