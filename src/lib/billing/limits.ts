import type { WorkspaceContext } from "@/lib/workspace";
import { planFor, type Plan } from "./plans";
import { todayISO, zonedDayRange } from "@/lib/utils";

export type LimitKey = keyof Plan["limits"];

/** Start of the current calendar month in the app's time zone, as a UTC instant. */
function monthStartISO() {
  return zonedDayRange(`${todayISO().slice(0, 7)}-01`).start;
}

/** Current usage for a limit. */
export async function usageFor(ctx: Pick<WorkspaceContext, "supabase" | "workspace">, key: LimitKey): Promise<number> {
  const { supabase, workspace } = ctx;
  const q = (table: string) => supabase.from(table).select("*", { count: "exact", head: true }).eq("workspace_id", workspace.id);
  switch (key) {
    case "teamMembers":
      return (await q("team_members").eq("status", "active")).count ?? 0;
    case "seats":
      return (await q("workspace_members")).count ?? 0;
    case "openDeals":
      return (await q("deals").eq("status", "open")).count ?? 0;
    case "aiMessages":
      return (await q("usage_events").eq("kind", "ai_message").gte("created_at", monthStartISO())).count ?? 0;
  }
}

/**
 * Returns an error message if adding `adding` more would exceed the plan, else null.
 * Usage in a server action:
 *   const over = await checkLimit(ctx, "teamMembers"); if (over) return { error: over };
 */
export async function checkLimit(ctx: Pick<WorkspaceContext, "supabase" | "workspace">, key: LimitKey, adding = 1): Promise<string | null> {
  const plan = planFor(ctx.workspace.plan);
  const limit = plan.limits[key];
  const used = await usageFor(ctx, key);
  if (used + adding <= limit) return null;
  const what: Record<LimitKey, string> = {
    teamMembers: "team members",
    seats: "seats",
    aiMessages: "Copilot messages this month",
    openDeals: "open deals",
  };
  return `You've reached the ${plan.name} plan limit of ${limit} ${what[key]}. Upgrade in Settings → Billing.`;
}
