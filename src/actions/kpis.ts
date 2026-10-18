"use server";
import { getWorkspace } from "@/lib/workspace";
import { refreshWorkspace } from "@/lib/revalidate";
import { num, str, weekStart } from "@/lib/utils";
import type { ActionState } from "@/lib/types";

function kpiFields(fd: FormData) {
  return {
    name: str(fd, "name") ?? "",
    unit: str(fd, "unit"),
    target: num(fd, "target"),
    direction: str(fd, "direction") === "down" ? "down" : "up",
    owner_id: str(fd, "owner_id"),
  };
}

export async function createKpi(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, workspace } = await getWorkspace(slug);
  const f = kpiFields(fd);
  if (!f.name) return { error: "Name the KPI." };
  const { error } = await supabase.from("kpis").insert({ ...f, workspace_id: workspace.id });
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  return { ok: true };
}

export async function updateKpi(slug: string, id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await getWorkspace(slug);
  const f = kpiFields(fd);
  if (!f.name) return { error: "Name the KPI." };
  const { error } = await supabase.from("kpis").update(f).eq("id", id);
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  return { ok: true };
}

export async function deleteKpi(slug: string, id: string): Promise<void> {
  const { supabase } = await getWorkspace(slug);
  await supabase.from("kpis").delete().eq("id", id);
  refreshWorkspace(slug);
}

/** Record the value for a week (defaults to the current week). Upserts on (kpi_id, week_start). */
export async function logKpiValue(slug: string, kpiId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, workspace } = await getWorkspace(slug);
  const value = num(fd, "value");
  if (value === null) return { error: "Enter a number." };
  const week = str(fd, "week_start") ?? weekStart();
  const { error } = await supabase
    .from("kpi_entries")
    .upsert({ workspace_id: workspace.id, kpi_id: kpiId, week_start: week, value }, { onConflict: "kpi_id,week_start" });
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  return { ok: true };
}

const STARTERS = [
  { name: "MRR", unit: "₹", direction: "up" },
  { name: "New customers", unit: null, direction: "up" },
  { name: "Burn", unit: "₹", direction: "down" },
  { name: "Weekly active users", unit: null, direction: "up" },
] as const;

export async function addStarterKpis(slug: string): Promise<void> {
  const { supabase, workspace, me } = await getWorkspace(slug);
  const currencyUnit = workspace.currency === "INR" ? "₹" : workspace.currency;
  await supabase.from("kpis").insert(
    STARTERS.map((s) => ({
      workspace_id: workspace.id,
      name: s.name,
      unit: s.unit === "₹" ? currencyUnit : s.unit,
      direction: s.direction,
      owner_id: me?.id ?? null,
    })),
  );
  refreshWorkspace(slug);
}
