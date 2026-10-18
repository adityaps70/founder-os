import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { PlanId } from "./plans";

/**
 * Payment provider abstraction. Founder OS ships with a "stub" provider that switches
 * plans instantly (for development and early pilots). To charge real money, implement
 * this interface for Razorpay or Stripe and set BILLING_PROVIDER accordingly.
 *
 *  Razorpay: create a Subscription (plan_id per PlanId) → return its short_url.
 *            Webhook `subscription.activated|charged|cancelled` → call setWorkspacePlan().
 *  Stripe:   create a Checkout Session (mode: "subscription") → return session.url.
 *            Webhook `checkout.session.completed`, `customer.subscription.*` → setWorkspacePlan().
 * See src/app/api/billing/webhook/route.ts.
 */
export interface CheckoutArgs {
  workspaceId: string;
  plan: PlanId;
  email?: string;
  returnUrl: string;
}

export interface BillingProvider {
  id: string;
  /** Start an upgrade. Return a URL to redirect to, or { activated: true } if it took effect immediately. */
  startCheckout(args: CheckoutArgs): Promise<{ url?: string; activated?: boolean }>;
  /** Cancel at period end (or immediately for the stub). */
  cancel(workspaceId: string): Promise<void>;
}

/** Write billing fields with the service role (the DB blocks anyone else). */
export async function setWorkspacePlan(
  workspaceId: string,
  patch: { plan: PlanId; plan_status?: string; billing_customer_id?: string | null; billing_subscription_id?: string | null; current_period_end?: string | null },
) {
  const admin = createServiceClient();
  const { error } = await admin.from("workspaces").update({ plan_status: "active", ...patch }).eq("id", workspaceId);
  if (error) throw new Error(error.message);
}

const stubProvider: BillingProvider = {
  id: "stub",
  async startCheckout({ workspaceId, plan }) {
    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    await setWorkspacePlan(workspaceId, {
      plan,
      billing_customer_id: `stub_cus_${workspaceId.slice(0, 8)}`,
      billing_subscription_id: plan === "free" ? null : `stub_sub_${Date.now()}`,
      current_period_end: plan === "free" ? null : end.toISOString(),
    });
    return { activated: true };
  },
  async cancel(workspaceId) {
    await setWorkspacePlan(workspaceId, { plan: "free", billing_subscription_id: null, current_period_end: null });
  },
};

const notImplemented = (id: string): BillingProvider => ({
  id,
  async startCheckout() {
    throw new Error(`Billing provider "${id}" is not implemented yet — see src/lib/billing/provider.ts`);
  },
  async cancel() {
    throw new Error(`Billing provider "${id}" is not implemented yet`);
  },
});

export function getBillingProvider(): BillingProvider {
  const id = (process.env.BILLING_PROVIDER || "stub").toLowerCase();
  if (id === "stub") return stubProvider;
  return notImplemented(id); // "razorpay" | "stripe"
}
