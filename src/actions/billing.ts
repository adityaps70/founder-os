"use server";
import { redirect } from "next/navigation";
import { canAdmin, getWorkspace } from "@/lib/workspace";
import { refreshWorkspace } from "@/lib/revalidate";
import { getBillingProvider } from "@/lib/billing/provider";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { usageFor, type LimitKey } from "@/lib/billing/limits";
import type { ActionState } from "@/lib/types";

/** Switch plan. Downgrades are blocked if current usage exceeds the target plan's limits. */
export async function changePlan(slug: string, planId: PlanId, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  const ctx = await getWorkspace(slug);
  if (!canAdmin(ctx.role)) return { error: "Only owners and admins can change the plan." };
  const target = PLANS.find((p) => p.id === planId);
  if (!target) return { error: "Unknown plan." };
  if (target.id === ctx.workspace.plan) return { ok: true };

  for (const key of ["seats", "teamMembers", "openDeals"] as LimitKey[]) {
    const used = await usageFor(ctx, key);
    if (used > target.limits[key]) {
      return { error: `You're using ${used} ${key === "teamMembers" ? "team members" : key === "openDeals" ? "open deals" : "seats"}; the ${target.name} plan allows ${target.limits[key]}.` };
    }
  }

  let url: string | undefined;
  try {
    const provider = getBillingProvider();
    const res = await provider.startCheckout({
      workspaceId: ctx.workspace.id,
      plan: target.id,
      email: ctx.user.email,
      returnUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/w/${slug}/settings/billing`,
    });
    url = res.url;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not start checkout." };
  }
  if (url) redirect(url);
  refreshWorkspace(slug);
  return { ok: true, message: `You're now on the ${target.name} plan.` };
}
