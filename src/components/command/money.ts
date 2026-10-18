import type { Transaction } from "@/lib/types";
import { todayISO } from "@/lib/utils";

/**
 * Money snapshot from recent transactions.
 * burn30/income30: last 30 days. Runway uses average monthly net burn over the last 90 days.
 */
export function moneySnapshot(cash: number, txns: Pick<Transaction, "kind" | "amount" | "occurred_on">[]) {
  const d30 = todayISO(-30);
  let burn30 = 0;
  let income30 = 0;
  let exp90 = 0;
  let inc90 = 0;
  for (const t of txns) {
    const amt = Number(t.amount);
    if (t.kind === "expense") {
      exp90 += amt;
      if (t.occurred_on >= d30) burn30 += amt;
    } else {
      inc90 += amt;
      if (t.occurred_on >= d30) income30 += amt;
    }
  }
  const monthlyNetBurn = (exp90 - inc90) / 3;
  const runwayMonths = monthlyNetBurn > 0 ? Number(cash) / monthlyNetBurn : null;
  return { burn30, income30, net30: income30 - burn30, monthlyNetBurn, runwayMonths };
}
