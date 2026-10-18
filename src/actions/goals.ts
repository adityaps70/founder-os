"use server";
import { getWorkspace } from "@/lib/workspace";
import { refreshWorkspace } from "@/lib/revalidate";
import { currentQuarter, num, str } from "@/lib/utils";
import type { ActionState, GoalStatus } from "@/lib/types";

const STATUSES: GoalStatus[] = ["on_track", "at_risk", "off_track", "done"];

function goalFields(fd: FormData) {
  const status = (str(fd, "status") ?? "on_track") as GoalStatus;
  const quarter = str(fd, "quarter") ?? currentQuarter();
  return {
    title: str(fd, "title") ?? "",
    description: str(fd, "description"),
    quarter: /^\d{4}-Q[1-4]$/.test(quarter) ? quarter : currentQuarter(),
    owner_id: str(fd, "owner_id"),
    status: STATUSES.includes(status) ? status : "on_track",
    target_date: str(fd, "target_date"),
  };
}

export async function createGoal(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, workspace, me } = await getWorkspace(slug);
  const f = goalFields(fd);
  if (!f.title) return { error: "Give the goal a title." };
  const { data: goal, error } = await supabase
    .from("goals")
    .insert({ ...f, owner_id: f.owner_id ?? me?.id ?? null, workspace_id: workspace.id })
    .select("id")
    .single();
  if (error || !goal) return { error: error?.message ?? "Could not create goal." };

  // Optional first key result, from the same dialog.
  const krTitle = str(fd, "kr_title");
  const krTarget = num(fd, "kr_target");
  if (krTitle && krTarget !== null) {
    await supabase.from("key_results").insert({
      workspace_id: workspace.id,
      goal_id: goal.id,
      title: krTitle,
      start_value: num(fd, "kr_start") ?? 0,
      current_value: num(fd, "kr_start") ?? 0,
      target_value: krTarget,
      unit: str(fd, "kr_unit"),
    });
  }
  refreshWorkspace(slug);
  return { ok: true };
}

export async function updateGoal(slug: string, id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, me } = await getWorkspace(slug);
  const f = goalFields(fd);
  if (!f.title) return { error: "Give the goal a title." };
  // "Me" (empty owner) means the signed-in user, same as on create.
  const { error } = await supabase.from("goals").update({ ...f, owner_id: f.owner_id ?? me?.id ?? null }).eq("id", id);
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  return { ok: true };
}

export async function deleteGoal(slug: string, id: string): Promise<void> {
  const { supabase } = await getWorkspace(slug);
  await supabase.from("goals").delete().eq("id", id);
  refreshWorkspace(slug);
}

export async function createKeyResult(slug: string, goalId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, workspace } = await getWorkspace(slug);
  const title = str(fd, "title");
  const target = num(fd, "target_value");
  if (!title) return { error: "Describe the key result." };
  if (target === null) return { error: "Set a target value." };
  const start = num(fd, "start_value") ?? 0;
  const { error } = await supabase.from("key_results").insert({
    workspace_id: workspace.id,
    goal_id: goalId,
    title,
    start_value: start,
    current_value: num(fd, "current_value") ?? start,
    target_value: target,
    unit: str(fd, "unit"),
  });
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  return { ok: true };
}

/** Inline progress update for a key result. */
export async function updateKeyResultValue(slug: string, id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await getWorkspace(slug);
  const value = num(fd, "current_value");
  if (value === null) return { error: "Enter a number." };
  const { error } = await supabase.from("key_results").update({ current_value: value }).eq("id", id);
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  return { ok: true };
}

export async function deleteKeyResult(slug: string, id: string): Promise<void> {
  const { supabase } = await getWorkspace(slug);
  await supabase.from("key_results").delete().eq("id", id);
  refreshWorkspace(slug);
}
