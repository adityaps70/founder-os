import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, FileText, Landmark, Minus, Plus, Repeat, Trash2, Wallet } from "lucide-react";
import { updateCashBalance } from "@/actions/workspace";
import { createTransaction, deleteTransaction } from "@/actions/finance";
import { monthlyTotals, monthStart, runwayMonths, sumBy } from "@/components/finance/finance-math";
import { TransactionFields } from "@/components/finance/transaction-fields";
import { BarChart, Badge, ButtonLink, Card, CardBody, CardHeader, EmptyState, Field, Input, PageHeader, Progress, Stat } from "@/components/ui";
import { FormDialog } from "@/components/ui/form-dialog";
import type { Invoice, Transaction } from "@/lib/types";
import { cn, formatDate, formatMoney, formatNumber, todayISO } from "@/lib/utils";
import { getWorkspace } from "@/lib/workspace";

export const metadata = { title: "Finance" };

export default async function FinancePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  const { slug } = await params;
  const { kind } = await searchParams;
  const filterKind = kind === "income" || kind === "expense" ? kind : null;
  const { supabase, workspace } = await getWorkspace(slug);
  const currency = workspace.currency;
  const cash = Number(workspace.cash_balance ?? 0);
  const money = (n: number) => formatMoney(n, currency);

  let listQuery = supabase
    .from("transactions")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  if (filterKind) listQuery = listQuery.eq("kind", filterKind);

  const [{ data: historyRows }, { data: listRows }, { data: invoiceRows }] = await Promise.all([
    supabase
      .from("transactions")
      .select("kind, amount, category, occurred_on")
      .eq("workspace_id", workspace.id)
      .gte("occurred_on", monthStart(-6))
      .limit(5000),
    listQuery,
    supabase.from("invoices").select("amount, status, due_date").eq("workspace_id", workspace.id).eq("status", "sent"),
  ]);

  const history = ((historyRows ?? []) as Pick<Transaction, "kind" | "amount" | "category" | "occurred_on">[]).map((t) => ({
    ...t,
    amount: Number(t.amount),
  }));
  const transactions = (listRows ?? []) as Transaction[];
  const outstanding = ((invoiceRows ?? []) as Pick<Invoice, "amount" | "status" | "due_date">[]).reduce((s, i) => s + Number(i.amount), 0);

  const since30 = todayISO(-30);
  const last30 = history.filter((t) => t.occurred_on >= since30);
  const income30 = sumBy(last30, "income");
  const expense30 = sumBy(last30, "expense");
  const net30 = income30 - expense30;

  const months = monthlyTotals(history, 7);
  const chartMonths = months.slice(-6);
  const runway = runwayMonths(cash, months, net30);

  const thisMonth = monthStart(0);
  const byCategory = new Map<string, number>();
  for (const t of history) {
    if (t.kind === "expense" && t.occurred_on >= thisMonth) byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount);
  }
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const categoryMax = categories[0]?.[1] ?? 1;
  const monthExpense = categories.reduce((s, [, v]) => s + v, 0);

  const runwayValue = runway.months === null ? "Profitable" : `${formatNumber(runway.months, 1)} mo`;
  const runwayTone = runway.months === null ? "good" : runway.months < 6 ? "bad" : "neutral";

  const addButtons = (
    <>
      <FormDialog
        title="Add expense"
        trigger="Expense"
        triggerIcon={<Minus className="h-4 w-4" />}
        triggerVariant="secondary"
        action={createTransaction.bind(null, slug)}
        submitLabel="Add expense"
      >
        <TransactionFields kind="expense" currency={currency} />
      </FormDialog>
      <FormDialog title="Add income" trigger="Income" triggerIcon={<Plus className="h-4 w-4" />} action={createTransaction.bind(null, slug)} submitLabel="Add income">
        <TransactionFields kind="income" currency={currency} />
      </FormDialog>
    </>
  );

  const filterLink = (k: string | null, label: string) => (
    <Link
      href={`/w/${slug}/finance${k ? `?kind=${k}` : ""}`}
      className={cn("rounded-md px-2 py-1 text-xs", filterKind === k ? "bg-surface-2 font-medium text-fg" : "text-muted hover:text-fg")}
    >
      {label}
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Finance"
        description="Cash, burn and runway at a glance."
        actions={
          <>
            <ButtonLink href={`/w/${slug}/finance/invoices`}>
              <FileText className="h-4 w-4" /> Invoices
            </ButtonLink>
            {addButtons}
          </>
        }
      />

      <div className="mb-6 grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardBody>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <Landmark className="h-3.5 w-3.5" /> Cash in bank
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-fg">{money(cash)}</p>
              </div>
              <FormDialog title="Update cash balance" description="Your current bank balance across accounts." trigger="Update" triggerVariant="secondary" triggerSize="sm" action={updateCashBalance.bind(null, slug)}>
                <Field label={`Cash in bank (${currency})`}>
                  <Input name="cash_balance" type="number" step="any" defaultValue={String(cash)} required autoFocus />
                </Field>
              </FormDialog>
            </div>
            <div className="mt-4 rounded-lg bg-surface-2 px-3 py-2.5">
              <p className="text-xs text-muted">Runway</p>
              <p className={cn("text-lg font-semibold tabular-nums", runwayTone === "good" ? "text-success" : runwayTone === "bad" ? "text-danger" : "text-fg")}>
                {runwayValue}
              </p>
              <p className="text-xs text-faint">
                {runway.months === null ? "You're not burning cash on average." : `Avg net burn ${money(runway.burn)}/mo over the last 3 months`}
              </p>
            </div>
          </CardBody>
        </Card>
        <div className="grid grid-cols-2 gap-3 lg:col-span-2">
          <Stat label="Income · 30 days" value={money(income30)} />
          <Stat label="Burn · 30 days" value={money(expense30)} />
          <Stat label="Net · 30 days" value={money(net30)} tone={net30 >= 0 ? "good" : "bad"} hint={net30 >= 0 ? "Cash positive" : "Burning cash"} />
          <Stat
            label="Outstanding invoices"
            value={money(outstanding)}
            hint={
              <Link href={`/w/${slug}/finance/invoices`} className="hover:text-fg">
                View invoices →
              </Link>
            }
          />
        </div>
      </div>

      <div className="mb-6 grid gap-3 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Income vs expenses"
            description="Last 6 months"
            action={
              <div className="flex items-center gap-3 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-accent" /> Income
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-faint/50" /> Expenses
                </span>
              </div>
            }
          />
          <CardBody>
            <BarChart data={chartMonths.map((m) => ({ label: m.label, a: m.income, b: m.expense }))} height={180} format={(n) => formatMoney(n, currency, true)} />
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Spend by category" description={`This month · ${money(monthExpense)}`} />
          <CardBody className="space-y-3">
            {categories.length === 0 ? (
              <p className="py-6 text-center text-xs text-faint">No expenses logged this month.</p>
            ) : (
              categories.slice(0, 8).map(([cat, v]) => (
                <div key={cat}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-fg">{cat}</span>
                    <span className="tabular-nums text-muted">{formatMoney(v, currency, true)}</span>
                  </div>
                  <Progress value={(v / categoryMax) * 100} />
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Transactions"
          description="Most recent 50"
          action={
            <div className="flex gap-1">
              {filterLink(null, "All")}
              {filterLink("income", "Income")}
              {filterLink("expense", "Expenses")}
            </div>
          }
        />
        {transactions.length === 0 ? (
          <EmptyState icon={Wallet} title="No transactions yet" description="Log income and expenses to see burn and runway." action={<div className="flex gap-2">{addButtons}</div>} />
        ) : (
          <div className="divide-y divide-line">
            {transactions.map((t) => {
              const income = t.kind === "income";
              return (
                <div key={t.id} className="group flex items-center gap-3 px-4 py-2.5">
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      income ? "bg-emerald-500/10 text-success" : "bg-surface-2 text-muted",
                    )}
                  >
                    {income ? <ArrowDownRight className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-fg">{t.description ?? t.category}</p>
                    <p className="truncate text-xs text-faint">
                      {t.category} · {formatDate(t.occurred_on, { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  {t.is_recurring && (
                    <Badge tone="gray">
                      <Repeat className="h-3 w-3" /> Monthly
                    </Badge>
                  )}
                  <span className={cn("text-sm font-medium tabular-nums", income ? "text-success" : "text-fg")}>
                    {income ? "+" : "−"}
                    {money(Number(t.amount))}
                  </span>
                  <form action={deleteTransaction.bind(null, slug, t.id)}>
                    <button
                      type="submit"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-faint opacity-100 hover:bg-surface-2 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label="Delete transaction"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
