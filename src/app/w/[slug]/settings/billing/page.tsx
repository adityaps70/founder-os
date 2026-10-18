import { Check } from "lucide-react";
import { changePlan } from "@/actions/billing";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Badge, Card, CardBody, CardHeader, PageHeader, Progress } from "@/components/ui";
import { usageFor, type LimitKey } from "@/lib/billing/limits";
import { PLANS, planFor } from "@/lib/billing/plans";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import { canAdmin, getWorkspace } from "@/lib/workspace";
import { SettingsTabs } from "../settings-tabs";

export const metadata = { title: "Plan & billing" };

const LABELS: Record<LimitKey, string> = {
  seats: "Seats",
  teamMembers: "Team members",
  openDeals: "Open deals",
  aiMessages: "Copilot messages this month",
};

export default async function BillingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspace(slug);
  const { workspace, role } = ctx;
  const plan = planFor(workspace.plan);
  const keys = Object.keys(LABELS) as LimitKey[];
  const usage = await Promise.all(keys.map((k) => usageFor(ctx, k)));
  const admin = canAdmin(role);
  const currency = workspace.currency === "INR" ? "INR" : "USD";
  const stub = (process.env.BILLING_PROVIDER || "stub") === "stub";

  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs slug={slug} />

      {stub && (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-warning">
          Test mode: payments are stubbed, so plan changes apply instantly without charging. Set BILLING_PROVIDER when you connect Razorpay or Stripe.
        </p>
      )}

      <Card className="mb-6">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              Current plan: {plan.name} <Badge tone="purple">{workspace.plan_status}</Badge>
            </span>
          }
          description={workspace.current_period_end ? `Renews ${formatDate(workspace.current_period_end, { day: "numeric", month: "short", year: "numeric" })}` : plan.tagline}
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          {keys.map((k, i) => {
            const limit = plan.limits[k];
            const pct = (usage[i]! / limit) * 100;
            return (
              <div key={k}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted">{LABELS[k]}</span>
                  <span className="tabular-nums">
                    {usage[i]} / {limit}
                  </span>
                </div>
                <Progress value={pct} tone={pct >= 100 ? "bad" : pct >= 80 ? "warn" : "accent"} />
              </div>
            );
          })}
        </CardBody>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const current = p.id === plan.id;
          return (
            <Card key={p.id} className={cn("flex flex-col", current && "border-accent ring-1 ring-accent")}>
              <CardBody className="flex flex-1 flex-col">
                <p className="text-sm font-semibold">{p.name}</p>
                <p className="text-xs text-muted">{p.tagline}</p>
                <p className="mt-3 text-2xl font-semibold tabular-nums">
                  {p.price[currency] === 0 ? "Free" : formatMoney(p.price[currency], currency)}
                  {p.price[currency] > 0 && <span className="text-xs font-normal text-muted"> / month</span>}
                </p>
                <ul className="mt-4 flex-1 space-y-1.5 text-xs text-muted">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  {current ? (
                    <p className="text-center text-xs font-medium text-accent">Your current plan</p>
                  ) : admin ? (
                    <ActionForm action={changePlan.bind(null, slug, p.id)}>
                      <SubmitButton variant={p.price[currency] > plan.price[currency] ? "primary" : "secondary"} className="w-full">
                        {p.price[currency] > plan.price[currency] ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}
                      </SubmitButton>
                    </ActionForm>
                  ) : (
                    <p className="text-center text-xs text-faint">Ask an admin to change plans</p>
                  )}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </>
  );
}
