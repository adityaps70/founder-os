import Link from "next/link";
import { ArrowLeft, FileText, Plus, Trash2 } from "lucide-react";
import { createInvoice, deleteInvoice, setInvoiceStatus } from "@/actions/finance";
import { monthStart } from "@/components/finance/finance-math";
import { InvoiceFields } from "@/components/finance/invoice-fields";
import { Badge, Button, Card, EmptyState, PageHeader, Stat, type Tone } from "@/components/ui";
import { FormDialog } from "@/components/ui/form-dialog";
import type { Contact, Invoice } from "@/lib/types";
import { cn, formatDate, formatMoney, todayISO } from "@/lib/utils";
import { getWorkspace } from "@/lib/workspace";

export const metadata = { title: "Invoices" };

const STATUS: Record<Invoice["status"], { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "gray" },
  sent: { label: "Sent", tone: "blue" },
  paid: { label: "Paid", tone: "green" },
  void: { label: "Void", tone: "gray" },
};

function nextNumber(invoices: Pick<Invoice, "number">[]) {
  let max = 0;
  for (const i of invoices) {
    const m = /(\d+)\s*$/.exec(i.number);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `INV-${String(max + 1).padStart(4, "0")}`;
}

export default async function InvoicesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, workspace } = await getWorkspace(slug);
  const currency = workspace.currency;

  const [{ data: invoiceRows }, { data: contactRows }] = await Promise.all([
    supabase.from("invoices").select("*").eq("workspace_id", workspace.id).order("issue_date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("contacts").select("id, name, company").eq("workspace_id", workspace.id).order("name"),
  ]);
  const invoices = ((invoiceRows ?? []) as Invoice[]).map((i) => ({ ...i, amount: Number(i.amount) }));
  const contacts = (contactRows ?? []) as Pick<Contact, "id" | "name" | "company">[];

  const today = todayISO();
  const isLate = (i: Invoice) => i.status === "sent" && !!i.due_date && i.due_date < today;
  const outstanding = invoices.filter((i) => i.status === "sent");
  const overdue = outstanding.filter(isLate);
  const paidMonth = invoices.filter((i) => i.status === "paid" && i.paid_on && i.paid_on >= monthStart(0));
  const total = (list: Invoice[]) => list.reduce((s, i) => s + i.amount, 0);

  const create = (
    <FormDialog title="New invoice" trigger="New invoice" triggerIcon={<Plus className="h-4 w-4" />} action={createInvoice.bind(null, slug)} submitLabel="Create" wide>
      <InvoiceFields nextNumber={nextNumber(invoices)} contacts={contacts} currency={currency} />
    </FormDialog>
  );

  return (
    <>
      <Link href={`/w/${slug}/finance`} className="mb-3 inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
        <ArrowLeft className="h-3.5 w-3.5" /> Finance
      </Link>
      <PageHeader title="Invoices" description="Track what you've billed and what's still owed." actions={create} />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Outstanding" value={formatMoney(total(outstanding), currency)} hint={`${outstanding.length} sent, unpaid`} />
        <Stat
          label="Overdue"
          value={formatMoney(total(overdue), currency)}
          hint={overdue.length ? `${overdue.length} past due date` : "Nothing overdue"}
          tone={overdue.length ? "bad" : "good"}
        />
        <Stat label="Paid this month" value={formatMoney(total(paidMonth), currency)} hint={`${paidMonth.length} invoices`} tone="good" />
      </div>

      <Card>
        {invoices.length === 0 ? (
          <EmptyState icon={FileText} title="No invoices yet" description="Create one when you bill a client — marking it paid books the revenue automatically." action={create} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-2.5 font-medium">Number</th>
                  <th className="px-4 py-2.5 font-medium">Client</th>
                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Issued</th>
                  <th className="px-4 py-2.5 font-medium">Due</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {invoices.map((i) => {
                  const contact = contacts.find((c) => c.id === i.contact_id);
                  const late = isLate(i);
                  const st = STATUS[i.status];
                  return (
                    <tr key={i.id} className={cn(late && "bg-red-500/5")}>
                      <td className="px-4 py-2.5 font-medium text-fg">
                        {i.number}
                        {i.notes && <p className="max-w-48 truncate text-xs font-normal text-faint">{i.notes}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-muted">{contact ? `${contact.name}${contact.company ? ` · ${contact.company}` : ""}` : "—"}</td>
                      <td className={cn("px-4 py-2.5 text-right tabular-nums", i.status === "void" ? "text-faint line-through" : "text-fg")}>
                        {formatMoney(i.amount, currency)}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-muted">{formatDate(i.issue_date)}</td>
                      <td className={cn("px-4 py-2.5 tabular-nums", late ? "font-medium text-danger" : "text-muted")}>{formatDate(i.due_date)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Badge tone={late ? "red" : st.tone}>{late ? "Overdue" : st.label}</Badge>
                          {i.status === "paid" && i.paid_on && <span className="text-xs text-faint">{formatDate(i.paid_on)}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {i.status === "draft" && (
                            <form action={setInvoiceStatus.bind(null, slug, i.id, "sent")}>
                              <Button type="submit" variant="secondary" size="sm">
                                Mark sent
                              </Button>
                            </form>
                          )}
                          {(i.status === "draft" || i.status === "sent") && (
                            <form action={setInvoiceStatus.bind(null, slug, i.id, "paid")}>
                              <Button type="submit" size="sm">
                                Mark paid
                              </Button>
                            </form>
                          )}
                          {i.status !== "void" && i.status !== "paid" && (
                            <form action={setInvoiceStatus.bind(null, slug, i.id, "void")}>
                              <Button type="submit" variant="ghost" size="sm">
                                Void
                              </Button>
                            </form>
                          )}
                          <form action={deleteInvoice.bind(null, slug, i.id)}>
                            <button type="submit" className="flex h-8 w-8 items-center justify-center rounded-lg text-faint hover:bg-surface-2 hover:text-danger" aria-label="Delete invoice">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
