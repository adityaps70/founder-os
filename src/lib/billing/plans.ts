/**
 * Plans and limits. Prices are per workspace (company) per month.
 * Limits are enforced in server actions via `checkLimit` (see ./limits.ts).
 */
export type PlanId = "free" | "pro" | "scale";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  price: { INR: number; USD: number };
  limits: {
    /** Team entries (people you track, with or without an account) */
    teamMembers: number;
    /** Signed-in seats (workspace_members) */
    seats: number;
    /** Copilot messages + briefs per calendar month */
    aiMessages: number;
    /** Open deals across all pipelines */
    openDeals: number;
  };
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "For solo founders getting organised",
    price: { INR: 0, USD: 0 },
    limits: { teamMembers: 5, seats: 2, aiMessages: 30, openDeals: 25 },
    features: ["Command Center & weekly review", "Tasks, projects & goals", "Up to 5 team members", "30 Copilot messages / month"],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For founders running a real team",
    price: { INR: 999, USD: 15 },
    limits: { teamMembers: 25, seats: 10, aiMessages: 600, openDeals: 500 },
    features: ["Everything in Free", "Pipeline, finance & KPIs without limits that bite", "10 seats, 25 team members", "600 Copilot messages / month", "Daily AI morning brief"],
  },
  {
    id: "scale",
    name: "Scale",
    tagline: "For multi-team companies",
    price: { INR: 2999, USD: 45 },
    limits: { teamMembers: 200, seats: 50, aiMessages: 3000, openDeals: 5000 },
    features: ["Everything in Pro", "50 seats, 200 team members", "3,000 Copilot messages / month", "Priority support"],
  },
];

export function planFor(id: string | null | undefined): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0]!;
}
