import { getWorkspace, canAdmin } from "@/lib/workspace";
import { refreshWorkspace } from "@/lib/revalidate";
import { callApi } from "@/lib/supabase/client";
import type { PlanId } from "@/lib/billing/plans";
import type { ActionState } from "@/lib/types";

/** Switch plan via the founder-api Edge Function (billing fields can only be written server-side). */
export async function changePlan(slug: string, planId: PlanId, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  const ctx = await getWorkspace(slug);
  if (!canAdmin(ctx.role)) return { error: "Only owners and admins can change the plan." };
  if (planId === ctx.workspace.plan) return { ok: true };
  const res = await callApi<{ message?: string; url?: string }>({ action: "change_plan", workspace_id: ctx.workspace.id, plan: planId });
  if (!res.ok) return { error: res.error };
  if (res.url) {
    window.location.assign(res.url); // hosted checkout (Razorpay / Stripe) once a real provider is wired up
    return { ok: true };
  }
  refreshWorkspace(slug);
  return { ok: true, message: res.message ?? "Plan updated." };
}
