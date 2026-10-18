import { NextResponse } from "next/server";

/**
 * Payment webhook endpoint (placeholder).
 * When you add Razorpay or Stripe:
 *  1. Verify the signature (Razorpay: X-Razorpay-Signature HMAC with the webhook secret;
 *     Stripe: stripe.webhooks.constructEvent with STRIPE_WEBHOOK_SECRET).
 *  2. Map the event to a workspace (store workspace_id in subscription notes / metadata at checkout).
 *  3. Call setWorkspacePlan(workspaceId, { plan, plan_status, current_period_end, ... })
 *     from "@/lib/billing/provider".
 */
export async function POST() {
  return NextResponse.json({ error: "Billing webhooks are not configured (BILLING_PROVIDER=stub)." }, { status: 501 });
}
