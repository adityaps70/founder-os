import "server-only";
import type { WorkspaceContext } from "@/lib/workspace";
import type { Capture, Contact, Deal, Decision, Goal, Invoice, KeyResult, Kpi, KpiEntry, Meeting, Project, Task, Transaction } from "@/lib/types";
import { currentQuarter, formatDateTime, formatMoney, todayISO, weekStart } from "@/lib/utils";

const clip = (s: string | null | undefined, n = 160) => (s ? (s.length > n ? s.slice(0, n) + "…" : s).replace(/\s+/g, " ") : "");

/**
 * A compact, plain-text snapshot of the workspace for the Copilot's system prompt.
 * Everything is scoped by RLS to what the signed-in user can see.
 */
export async function buildSnapshot(ctx: WorkspaceContext): Promise<string> {
  const { supabase, workspace, me, team } = ctx;
  const ws = workspace.id;
  const today = todayISO();
  const in7 = todayISO(7);
  const ago7 = todayISO(-7);
  const ago30 = todayISO(-30);
  const quarter = currentQuarter();
  const nowTs = new Date().toISOString();
  const weekAgoTs = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const weekAheadTs = new Date(Date.now() + 7 * 86_400_000).toISOString();

  const [tasksR, goalsR, krsR, projectsR, meetingsR, dealsR, contactsR, txR, invR, kpiR, kpiEntriesR, decR, capR] = await Promise.all([
    supabase.from("tasks").select("*").eq("workspace_id", ws).neq("status", "done").order("due_date", { ascending: true, nullsFirst: false }).limit(150),
    supabase.from("goals").select("*").eq("workspace_id", ws).eq("quarter", quarter),
    supabase.from("key_results").select("*").eq("workspace_id", ws),
    supabase.from("projects").select("*").eq("workspace_id", ws).in("status", ["planned", "active", "paused"]),
    supabase.from("meetings").select("*").eq("workspace_id", ws).gte("starts_at", weekAgoTs).lte("starts_at", weekAheadTs).order("starts_at"),
    supabase.from("deals").select("*").eq("workspace_id", ws).eq("status", "open").order("value", { ascending: false }).limit(40),
    supabase.from("contacts").select("id, name, company, type, last_contacted_at").eq("workspace_id", ws).limit(300),
    supabase.from("transactions").select("kind, amount, category, occurred_on").eq("workspace_id", ws).gte("occurred_on", todayISO(-90)),
    supabase.from("invoices").select("*").eq("workspace_id", ws).in("status", ["sent", "draft"]),
    supabase.from("kpis").select("*").eq("workspace_id", ws),
    supabase.from("kpi_entries").select("*").eq("workspace_id", ws).gte("week_start", weekStart(new Date(), -4)).order("week_start"),
    supabase.from("decisions").select("*").eq("workspace_id", ws).gte("decided_on", ago30).order("decided_on", { ascending: false }).limit(10),
    supabase.from("captures").select("*").eq("workspace_id", ws).eq("processed", false).order("created_at", { ascending: false }).limit(15),
  ]);

  const tasks = (tasksR.data ?? []) as Task[];
  const goals = (goalsR.data ?? []) as Goal[];
  const krs = (krsR.data ?? []) as KeyResult[];
  const projects = (projectsR.data ?? []) as Project[];
  const meetings = (meetingsR.data ?? []) as Meeting[];
  const deals = (dealsR.data ?? []) as Deal[];
  const contacts = (contactsR.data ?? []) as Pick<Contact, "id" | "name" | "company" | "type" | "last_contacted_at">[];
  const txs = (txR.data ?? []) as Pick<Transaction, "kind" | "amount" | "category" | "occurred_on">[];
  const invoices = (invR.data ?? []) as Invoice[];
  const kpis = (kpiR.data ?? []) as Kpi[];
  const kpiEntries = (kpiEntriesR.data ?? []) as KpiEntry[];
  const decisions = (decR.data ?? []) as Decision[];
  const captures = (capR.data ?? []) as Capture[];

  const person = (id: string | null) => team.find((t) => t.id === id)?.name ?? "unassigned";
  const contactName = (id: string | null) => {
    const c = contacts.find((x) => x.id === id);
    return c ? `${c.name}${c.company ? ` (${c.company})` : ""}` : "";
  };
  const money = (n: number) => formatMoney(n, workspace.currency);
  const taskLine = (t: Task) =>
    `- [${t.priority}] ${clip(t.title, 120)}${t.due_date ? ` — due ${t.due_date}${t.due_date < today ? " (OVERDUE)" : ""}` : ""}${
      t.follow_up_date ? ` — follow up ${t.follow_up_date}` : ""
    }${t.status !== "todo" ? ` — ${t.status}` : ""} {id:${t.id}}`;

  const mine = tasks.filter((t) => t.assignee_id === me?.id);
  const delegated = tasks.filter((t) => t.assignee_id && t.assignee_id !== me?.id);

  const sum = (kind: "income" | "expense", since: string) =>
    txs.filter((t) => t.kind === kind && t.occurred_on >= since).reduce((s, t) => s + Number(t.amount), 0);
  const income30 = sum("income", ago30);
  const expense30 = sum("expense", ago30);
  const net90 = (sum("income", todayISO(-90)) - sum("expense", todayISO(-90))) / 3;
  const cash = Number(workspace.cash_balance);
  const runway = net90 < 0 ? (cash / -net90).toFixed(1) + " months" : "not burning (profitable or no data)";

  const lines: string[] = [];
  lines.push(`TODAY: ${today} (week starting ${weekStart()}), quarter ${quarter}`);
  lines.push(`COMPANY: ${workspace.name} — currency ${workspace.currency}, plan ${workspace.plan}`);
  lines.push(`USER: ${me?.name ?? ctx.user.email} (${me?.title ?? "founder"}) {team_id:${me?.id ?? "none"}}`);

  lines.push(`\nTEAM (${team.length}):`);
  for (const t of team.filter((x) => x.status === "active")) {
    const open = tasks.filter((x) => x.assignee_id === t.id);
    const overdue = open.filter((x) => x.due_date && x.due_date < today).length;
    lines.push(`- ${t.name}${t.title ? `, ${t.title}` : ""}: ${open.length} open tasks, ${overdue} overdue {team_id:${t.id}}`);
  }

  lines.push(`\nMY OPEN TASKS (${mine.length}):`);
  lines.push(...mine.slice(0, 40).map(taskLine));
  lines.push(`\nDELEGATED / WAITING ON OTHERS (${delegated.length}):`);
  lines.push(...delegated.slice(0, 30).map((t) => `${taskLine(t)} — owner ${person(t.assignee_id)}`));

  lines.push(`\nGOALS ${quarter}:`);
  for (const g of goals) {
    const mk = krs.filter((k) => k.goal_id === g.id);
    lines.push(`- ${g.title} [${g.status}] owner ${person(g.owner_id)}`);
    for (const k of mk) {
      const span = Number(k.target_value) - Number(k.start_value) || 1;
      const pct = Math.round(((Number(k.current_value) - Number(k.start_value)) / span) * 100);
      lines.push(`  · KR ${k.title}: ${k.current_value}/${k.target_value}${k.unit ? " " + k.unit : ""} (${pct}%)`);
    }
  }
  if (!goals.length) lines.push("- none set");

  lines.push(`\nACTIVE PROJECTS:`);
  for (const p of projects) {
    const n = tasks.filter((t) => t.project_id === p.id).length;
    lines.push(`- ${p.name} [${p.status}] owner ${person(p.owner_id)}${p.due_date ? `, due ${p.due_date}` : ""}, ${n} open tasks`);
  }

  lines.push(`\nMEETINGS (last 7 days and next 7 days):`);
  for (const m of meetings) {
    const when = m.starts_at < nowTs ? "past" : "upcoming";
    lines.push(`- ${formatDateTime(m.starts_at)} [${when}] ${m.title} — attendees: ${m.attendee_ids.map(person).join(", ") || "—"}`);
    if (m.agenda) lines.push(`  agenda: ${clip(m.agenda, 240)}`);
    if (m.notes) lines.push(`  notes: ${clip(m.notes, 400)}`);
  }

  lines.push(`\nOPEN DEALS:`);
  for (const d of deals) {
    lines.push(
      `- [${d.pipeline}/${d.stage}] ${d.title} — ${money(Number(d.value))} @ ${d.probability}%${d.contact_id ? `, contact ${contactName(d.contact_id)}` : ""}${
        d.next_step ? `, next: ${clip(d.next_step, 80)}${d.next_step_date ? ` by ${d.next_step_date}` : ""}` : ", NO NEXT STEP"
      }`,
    );
  }
  const cold = contacts.filter((c) => ["lead", "client", "investor"].includes(c.type) && (!c.last_contacted_at || c.last_contacted_at < ago30));
  if (cold.length) lines.push(`Contacts going cold (no touch in 30+ days): ${cold.slice(0, 12).map((c) => c.name).join(", ")}`);

  lines.push(`\nFINANCE:`);
  lines.push(`- Cash in bank: ${money(cash)}; last 30 days income ${money(income30)}, expenses ${money(expense30)}; runway ${runway}`);
  const outstanding = invoices.filter((i) => i.status === "sent");
  const overdueInv = outstanding.filter((i) => i.due_date && i.due_date < today);
  lines.push(`- Invoices outstanding: ${outstanding.length} (${money(outstanding.reduce((s, i) => s + Number(i.amount), 0))}), overdue: ${overdueInv.map((i) => `${i.number} ${money(Number(i.amount))} due ${i.due_date}`).join("; ") || "none"}`);

  lines.push(`\nKPIs (last 5 weeks, oldest→newest):`);
  for (const k of kpis) {
    const vals = kpiEntries.filter((e) => e.kpi_id === k.id).map((e) => Number(e.value));
    lines.push(`- ${k.name}${k.unit ? ` (${k.unit})` : ""}: ${vals.join(", ") || "no data"}${k.target != null ? `; target ${k.target} (${k.direction === "up" ? "higher is better" : "lower is better"})` : ""}`);
  }

  if (decisions.length) {
    lines.push(`\nRECENT DECISIONS:`);
    lines.push(...decisions.map((d) => `- ${d.decided_on}: ${clip(d.title, 100)} — ${clip(d.decision, 160)}`));
  }
  if (captures.length) {
    lines.push(`\nUNPROCESSED INBOX:`);
    lines.push(...captures.map((c) => `- (${c.kind}) ${clip(c.content, 140)}`));
  }

  lines.push(`\n(Tasks completed recently are not listed. Window for "recent" = since ${ago7}; upcoming = until ${in7}.)`);
  return lines.join("\n");
}
