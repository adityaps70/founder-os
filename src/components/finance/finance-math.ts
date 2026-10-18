import type { Transaction } from "@/lib/types";
import { isoDate } from "@/lib/utils";

/** YYYY-MM key for a date string or Date. */
export function monthKey(d: string | Date) {
  return (typeof d === "string" ? d : isoDate(d)).slice(0, 7);
}

/** First day of the month `offset` months from now, as YYYY-MM-DD. */
export function monthStart(offset = 0, from = new Date()) {
  return isoDate(new Date(from.getFullYear(), from.getMonth() + offset, 1));
}

export function sumBy(txs: Pick<Transaction, "kind" | "amount">[], kind: "income" | "expense") {
  return txs.filter((t) => t.kind === kind).reduce((s, t) => s + Number(t.amount), 0);
}

export interface MonthTotals {
  key: string;
  label: string;
  income: number;
  expense: number;
}

/** Totals for each of the last `n` months (oldest first, including the current month). */
export function monthlyTotals(txs: Pick<Transaction, "kind" | "amount" | "occurred_on">[], n: number): MonthTotals[] {
  const now = new Date();
  const out: MonthTotals[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    const inMonth = txs.filter((t) => t.occurred_on.startsWith(key));
    out.push({
      key,
      label: new Intl.DateTimeFormat("en-IN", { month: "short" }).format(d),
      income: sumBy(inMonth, "income"),
      expense: sumBy(inMonth, "expense"),
    });
  }
  return out;
}

/**
 * Runway in months: cash / average monthly net burn over the last 3 full months.
 * Falls back to the last 30 days when there is no full-month history.
 * Returns null when the business is not burning cash.
 */
export function runwayMonths(cash: number, months: MonthTotals[], last30Net: number) {
  const full = months.slice(-4, -1).filter((m) => m.income > 0 || m.expense > 0);
  const avgNet = full.length ? full.reduce((s, m) => s + (m.income - m.expense), 0) / full.length : last30Net;
  if (avgNet >= 0) return { months: null as number | null, burn: 0 };
  const burn = -avgNet;
  return { months: cash > 0 ? cash / burn : 0, burn };
}
