import { getWorkspace } from "@/lib/workspace";
import { refreshWorkspace } from "@/lib/revalidate";
import { bool, num, str, todayISO } from "@/lib/utils";
import type { ActionState, Invoice } from "@/lib/types";

export async function createTransaction(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, workspace } = await getWorkspace(slug);
  const kind = str(fd, "kind");
  if (kind !== "income" && kind !== "expense") return { error: "Choose income or expense." };
  const amount = num(fd, "amount");
  if (amount === null || amount <= 0) return { error: "Enter an amount greater than zero." };
  const { error } = await supabase.from("transactions").insert({
    workspace_id: workspace.id,
    kind,
    amount,
    category: str(fd, "category") ?? "Other",
    description: str(fd, "description"),
    occurred_on: str(fd, "occurred_on") ?? todayISO(),
    is_recurring: bool(fd, "is_recurring"),
  });
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  return { ok: true };
}

export async function deleteTransaction(slug: string, id: string): Promise<void> {
  const { supabase } = await getWorkspace(slug);
  await supabase.from("transactions").delete().eq("id", id);
  refreshWorkspace(slug);
}

/** Next invoice number in the INV-0001 pattern, based on the highest existing number. */
async function nextInvoiceNumber(supabase: Awaited<ReturnType<typeof getWorkspace>>["supabase"], workspaceId: string) {
  const { data } = await supabase.from("invoices").select("number").eq("workspace_id", workspaceId);
  let max = 0;
  for (const row of (data ?? []) as { number: string }[]) {
    const m = /(\d+)\s*$/.exec(row.number);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `INV-${String(max + 1).padStart(4, "0")}`;
}

export async function createInvoice(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, workspace } = await getWorkspace(slug);
  const amount = num(fd, "amount");
  if (amount === null || amount <= 0) return { error: "Enter an amount greater than zero." };
  const number = str(fd, "number") ?? (await nextInvoiceNumber(supabase, workspace.id));
  const status = str(fd, "status") === "sent" ? "sent" : "draft";
  const { error } = await supabase.from("invoices").insert({
    workspace_id: workspace.id,
    number,
    contact_id: str(fd, "contact_id"),
    amount,
    status,
    issue_date: str(fd, "issue_date") ?? todayISO(),
    due_date: str(fd, "due_date"),
    notes: str(fd, "notes"),
  });
  if (error) return { error: /duplicate|unique/i.test(error.message) ? `Invoice number ${number} already exists.` : error.message };
  refreshWorkspace(slug);
  return { ok: true };
}

/** Change invoice status. Marking paid also books the income as a Revenue transaction. */
export async function setInvoiceStatus(slug: string, id: string, status: Invoice["status"]): Promise<void> {
  if (!["draft", "sent", "paid", "void"].includes(status)) return;
  const { supabase, workspace } = await getWorkspace(slug);
  const { data: inv } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();
  if (!inv) return;
  const invoice = inv as Invoice;
  if (invoice.status === status) return;
  const today = todayISO();
  await supabase
    .from("invoices")
    .update({ status, paid_on: status === "paid" ? today : null })
    .eq("id", id);
  if (status === "paid") {
    await supabase.from("transactions").insert({
      workspace_id: workspace.id,
      kind: "income",
      amount: Number(invoice.amount),
      category: "Revenue",
      description: `Invoice ${invoice.number}`,
      occurred_on: today,
    });
  }
  refreshWorkspace(slug);
}

export async function deleteInvoice(slug: string, id: string): Promise<void> {
  const { supabase } = await getWorkspace(slug);
  await supabase.from("invoices").delete().eq("id", id);
  refreshWorkspace(slug);
}
