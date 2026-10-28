// Founder OS — `founder-api` Supabase Edge Function
// ──────────────────────────────────────────────────────────────────────────────
// Everything that needs a secret lives here, because the web app is a static site
// (GitHub Pages) with no server of its own:
//   • AI Copilot chat (Claude tool-use loop over the workspace snapshot)
//   • Morning brief
//   • Plan changes (billing columns can only be written by the service role)
//
// Deploy
//   Dashboard: Edge Functions → Deploy a new function → Via editor → name `founder-api`
//              → paste this file → Deploy. Then turn OFF "Verify JWT" for the function
//              (this function verifies the signed-in user itself).
//   CLI:       supabase functions deploy founder-api --no-verify-jwt
//
// Secrets (Edge Functions → Secrets)
//   ANTHROPIC_API_KEY  required for the Copilot / brief
//   ANTHROPIC_MODEL    optional, default "claude-sonnet-5-5"
//   APP_TIMEZONE       optional, default "Asia/Kolkata"
//   (SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided automatically.)
//
// Contract: POST JSON { action, ... } with the user's `Authorization: Bearer <jwt>` and `apikey`
// headers (supabase.functions.invoke sends both). Handled outcomes always return HTTP 200 with
// { ok: true, ... } or { ok: false, error }.
//   { action: "status" }                                   → { ok, ai, model }
//   { action: "copilot", workspace_id, message }           → { ok, reply, actions }
//   { action: "brief", workspace_id }                      → { ok, content }
//   { action: "change_plan", workspace_id, plan }          → { ok, message }

import { createClient } from "npm:@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
type Db = any;
type Json = Record<string, unknown>;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5";
const APP_TIMEZONE = Deno.env.get("APP_TIMEZONE") ?? "Asia/Kolkata";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-region",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Json, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
const fail = (error: string) => json({ ok: false, error });

// ─── Plans (mirror src/lib/billing/plans.ts and plan_limit() in 0002_plan_limits.sql) ───
type PlanId = "free" | "pro" | "scale";
const PLANS: Record<PlanId, { name: string; limits: { seats: number; teamMembers: number; openDeals: number; aiMessages: number } }> = {
  free: { name: "Free", limits: { seats: 2, teamMembers: 5, openDeals: 25, aiMessages: 30 } },
  pro: { name: "Pro", limits: { seats: 10, teamMembers: 25, openDeals: 500, aiMessages: 600 } },
  scale: { name: "Scale", limits: { seats: 50, teamMembers: 200, openDeals: 5000, aiMessages: 3000 } },
};
const planFor = (id: string | null | undefined) => PLANS[(id as PlanId) in PLANS ? (id as PlanId) : "free"];

// ─── Dates (APP_TIMEZONE-aware, same semantics as src/lib/utils.ts) ───
function zonedDateISO(d: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function addDaysISO(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const todayISO = (offsetDays = 0) => addDaysISO(zonedDateISO(), offsetDays);
function weekStart(d = new Date(), offsetWeeks = 0) {
  const iso = zonedDateISO(d);
  const dow = (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDaysISO(iso, -dow + offsetWeeks * 7);
}
function currentQuarter(d = new Date()) {
  const [y, m] = zonedDateISO(d).split("-").map(Number);
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
}
function tzOffsetMinutes(at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Math.round((Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute")) - at.getTime()) / 60_000);
}
/** Start of the current calendar month in APP_TIMEZONE, as a UTC ISO instant. */
function monthStartISO() {
  const iso = `${todayISO().slice(0, 7)}-01`;
  const offset = tzOffsetMinutes(new Date(`${iso}T12:00:00Z`));
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() - offset * 60_000).toISOString();
}
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: APP_TIMEZONE }).format(new Date(value));
}
const LOCALE: Record<string, string> = { INR: "en-IN", USD: "en-US", EUR: "de-DE", GBP: "en-GB" };
function formatMoney(value: number, currency = "INR") {
  const n = Number(value ?? 0);
  try {
    return new Intl.NumberFormat(LOCALE[currency] ?? "en-US", { style: "currency", currency, maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(0)}`;
  }
}
const clip = (s: string | null | undefined, n = 160) => (s ? (s.length > n ? s.slice(0, n) + "…" : s).replace(/\s+/g, " ") : "");

// ─── Context loaded per request ───
interface TeamMember { id: string; user_id: string | null; name: string; title: string | null; status: string; email: string | null }
interface Ctx {
  db: Db; // user-scoped client: every query goes through RLS
  user: { id: string; email?: string };
  workspace: { id: string; name: string; slug: string; currency: string; plan: string; cash_balance: number };
  role: "owner" | "admin" | "member";
  team: TeamMember[];
  me: TeamMember | null;
}

// ─── Company snapshot (port of src/lib/ai/context.ts) ───
// deno-lint-ignore no-explicit-any
type Row = any;

async function buildSnapshot(ctx: Ctx): Promise<string> {
  const { db, workspace, me, team } = ctx;
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
    db.from("tasks").select("*").eq("workspace_id", ws).neq("status", "done").order("due_date", { ascending: true, nullsFirst: false }).limit(150),
    db.from("goals").select("*").eq("workspace_id", ws).eq("quarter", quarter),
    db.from("key_results").select("*").eq("workspace_id", ws),
    db.from("projects").select("*").eq("workspace_id", ws).in("status", ["planned", "active", "paused"]),
    db.from("meetings").select("*").eq("workspace_id", ws).gte("starts_at", weekAgoTs).lte("starts_at", weekAheadTs).order("starts_at"),
    db.from("deals").select("*").eq("workspace_id", ws).eq("status", "open").order("value", { ascending: false }).limit(40),
    db.from("contacts").select("id, name, company, type, last_contacted_at").eq("workspace_id", ws).limit(300),
    db.from("transactions").select("kind, amount, category, occurred_on").eq("workspace_id", ws).gte("occurred_on", todayISO(-90)),
    db.from("invoices").select("*").eq("workspace_id", ws).in("status", ["sent", "draft"]),
    db.from("kpis").select("*").eq("workspace_id", ws),
    db.from("kpi_entries").select("*").eq("workspace_id", ws).gte("week_start", weekStart(new Date(), -4)).order("week_start"),
    db.from("decisions").select("*").eq("workspace_id", ws).gte("decided_on", ago30).order("decided_on", { ascending: false }).limit(10),
    db.from("captures").select("*").eq("workspace_id", ws).eq("processed", false).order("created_at", { ascending: false }).limit(15),
  ]);

  const tasks: Row[] = tasksR.data ?? [];
  const goals: Row[] = goalsR.data ?? [];
  const krs: Row[] = krsR.data ?? [];
  const projects: Row[] = projectsR.data ?? [];
  const meetings: Row[] = meetingsR.data ?? [];
  const deals: Row[] = dealsR.data ?? [];
  const contacts: Row[] = contactsR.data ?? [];
  const txs: Row[] = txR.data ?? [];
  const invoices: Row[] = invR.data ?? [];
  const kpis: Row[] = kpiR.data ?? [];
  const kpiEntries: Row[] = kpiEntriesR.data ?? [];
  const decisions: Row[] = decR.data ?? [];
  const captures: Row[] = capR.data ?? [];

  const person = (id: string | null) => team.find((t) => t.id === id)?.name ?? "unassigned";
  const contactName = (id: string | null) => {
    const c = contacts.find((x) => x.id === id);
    return c ? `${c.name}${c.company ? ` (${c.company})` : ""}` : "";
  };
  const money = (n: number) => formatMoney(n, workspace.currency);
  const taskLine = (t: Row) =>
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
    const attendees: string[] = (m.attendee_ids ?? []).map(person);
    lines.push(`- ${formatDateTime(m.starts_at)} [${when}] ${m.title} — attendees: ${attendees.join(", ") || "—"}`);
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
  lines.push(
    `- Invoices outstanding: ${outstanding.length} (${money(outstanding.reduce((s, i) => s + Number(i.amount), 0))}), overdue: ${
      overdueInv.map((i) => `${i.number} ${money(Number(i.amount))} due ${i.due_date}`).join("; ") || "none"
    }`,
  );

  lines.push(`\nKPIs (last 5 weeks, oldest→newest):`);
  for (const k of kpis) {
    const vals = kpiEntries.filter((e) => e.kpi_id === k.id).map((e) => Number(e.value));
    lines.push(
      `- ${k.name}${k.unit ? ` (${k.unit})` : ""}: ${vals.join(", ") || "no data"}${
        k.target != null ? `; target ${k.target} (${k.direction === "up" ? "higher is better" : "lower is better"})` : ""
      }`,
    );
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

// ─── Copilot (port of src/lib/ai/copilot.ts) ───
const PERSONA = `You are the Copilot inside Founder OS — a sharp, practical chief of staff for a startup founder.
You see a live snapshot of their company below (tasks, team, goals, meetings, pipeline, finances, KPIs).
Rules:
- Be concise and specific. Use the founder's real data: names, numbers, dates. Never invent data that is not in the snapshot; say what's missing instead.
- Prefer short bullet lists and clear next actions. Use **bold** sparingly. Use ### for section headings only when the answer has several parts.
- Money is in the company's currency. Dates are YYYY-MM-DD in the snapshot; present them naturally ("Thu 23 Oct").
- When the founder asks you to create tasks, log a decision, change a task, or save a note, use the tools. Confirm briefly what you did.
- Only create things the founder asked for, or that they clearly agreed to. Don't spam tasks.
- For drafts (emails, investor updates, announcements), write them ready to send, in a warm, direct founder voice.`;

const TOOLS = [
  {
    name: "create_task",
    description: "Create a task in Founder OS. Use the team_id from the snapshot to assign it to someone; omit to assign to the founder.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short imperative title" },
        assignee_team_id: { type: "string", description: "team_id of the owner (from the snapshot)" },
        due_date: { type: "string", description: "YYYY-MM-DD" },
        priority: { type: "string", enum: ["urgent", "high", "medium", "low"] },
        notes: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_task",
    description: "Update an existing task by its id (shown as {id:...} in the snapshot).",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        status: { type: "string", enum: ["todo", "in_progress", "waiting", "done"] },
        due_date: { type: "string", description: "YYYY-MM-DD" },
        priority: { type: "string", enum: ["urgent", "high", "medium", "low"] },
      },
      required: ["task_id"],
    },
  },
  {
    name: "log_decision",
    description: "Record a decision in the decision log.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        decision: { type: "string" },
        rationale: { type: "string" },
      },
      required: ["title", "decision"],
    },
  },
  {
    name: "save_note",
    description: "Save an idea or note to the founder's inbox for later.",
    input_schema: {
      type: "object",
      properties: { content: { type: "string" }, kind: { type: "string", enum: ["idea", "note"] } },
      required: ["content"],
    },
  },
];

const BRIEF_PROMPT = `Write my morning brief for today. Format (markdown, under 220 words):
### Top 3 for today
Numbered — the three highest-leverage things I should do today, each with a one-line why. Prefer overdue or due-today items, deals with due next steps, and blocked goals.
### Watch out
2–4 bullets: risks (overdue items, cold deals, overdue invoices, runway, KPIs off track, people overloaded).
### Waiting on
Up to 3 bullets of delegated items I should chase today (who + what).
If the workspace is mostly empty, instead give 3 concrete setup steps to get value from Founder OS.`;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITIES = ["urgent", "high", "medium", "low"];
const STATUSES = ["todo", "in_progress", "waiting", "done"];

async function runTool(ctx: Ctx, name: string, input: Json): Promise<{ result: string; action?: string }> {
  const { db, workspace, user, me, team } = ctx;
  const s = (k: string) => (typeof input[k] === "string" && (input[k] as string).trim() ? (input[k] as string).trim() : null);

  if (name === "create_task") {
    const title = s("title");
    if (!title) return { result: "Error: title is required" };
    const assignee = team.find((t) => t.id === s("assignee_team_id"))?.id ?? me?.id ?? null;
    const due = s("due_date");
    const priority = PRIORITIES.includes(s("priority") ?? "") ? s("priority")! : "medium";
    const { data, error } = await db
      .from("tasks")
      .insert({
        workspace_id: workspace.id,
        title: title.slice(0, 200),
        notes: s("notes"),
        assignee_id: assignee,
        delegated_by_id: assignee && me && assignee !== me.id ? me.id : null,
        due_date: due && DATE.test(due) ? due : null,
        priority,
        is_important: priority === "urgent" || priority === "high",
        is_urgent: priority === "urgent",
        source: "copilot",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) return { result: `Error: ${error.message}` };
    const who = team.find((t) => t.id === assignee)?.name ?? "you";
    return { result: `Created task ${data.id}`, action: `Created task “${title}” for ${who}${due && DATE.test(due) ? ` (due ${due})` : ""}` };
  }

  if (name === "update_task") {
    const id = s("task_id");
    if (!id) return { result: "Error: task_id is required" };
    const patch: Json = {};
    const status = s("status");
    if (status && STATUSES.includes(status)) {
      patch.status = status;
      patch.completed_at = status === "done" ? new Date().toISOString() : null;
    }
    const due = s("due_date");
    if (due && DATE.test(due)) patch.due_date = due;
    const pr = s("priority");
    if (pr && PRIORITIES.includes(pr)) patch.priority = pr;
    if (!Object.keys(patch).length) return { result: "Error: nothing to update" };
    const { data, error } = await db.from("tasks").update(patch).eq("id", id).eq("workspace_id", workspace.id).select("title").maybeSingle();
    if (error) return { result: `Error: ${error.message}` };
    if (!data) return { result: "Error: task not found" };
    return { result: "Updated", action: `Updated “${data.title}”` };
  }

  if (name === "log_decision") {
    const title = s("title");
    const decision = s("decision");
    if (!title || !decision) return { result: "Error: title and decision are required" };
    const { error } = await db.from("decisions").insert({
      workspace_id: workspace.id,
      title,
      decision,
      rationale: s("rationale"),
      decided_by_id: me?.id ?? null,
      decided_on: todayISO(),
    });
    if (error) return { result: `Error: ${error.message}` };
    return { result: "Logged", action: `Logged decision “${title}”` };
  }

  if (name === "save_note") {
    const content = s("content");
    if (!content) return { result: "Error: content is required" };
    const kind = s("kind") === "idea" ? "idea" : "note";
    const { error } = await db.from("captures").insert({ workspace_id: workspace.id, user_id: user.id, content, kind });
    if (error) return { result: `Error: ${error.message}` };
    return { result: "Saved", action: `Saved ${kind} to your inbox` };
  }

  return { result: `Error: unknown tool ${name}` };
}

// ─── Anthropic Messages API (plain fetch) ───
interface TextBlock { type: "text"; text: string }
interface ToolUseBlock { type: "tool_use"; id: string; name: string; input: Json }
type ContentBlock = TextBlock | ToolUseBlock | { type: string };
interface AnthropicResponse { content: ContentBlock[]; stop_reason: string | null }
type Message = { role: "user" | "assistant"; content: string | unknown[] };

class AnthropicError extends Error {
  constructor(public status: number, public apiMessage: string) {
    super(`${status} ${apiMessage}`);
  }
}

async function callClaude(body: Json): Promise<AnthropicResponse> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, ...body }),
  });
  const text = await res.text();
  let data: Row = null;
  try {
    data = JSON.parse(text);
  } catch {
    // non-JSON (e.g. gateway error page)
  }
  if (!res.ok) throw new AnthropicError(res.status, data?.error?.message ?? text.slice(0, 300));
  return data as AnthropicResponse;
}

const textOf = (content: ContentBlock[]) =>
  content
    .filter((b): b is TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

function friendly(e: unknown) {
  const status = e instanceof AnthropicError ? e.status : undefined;
  const apiMsg = e instanceof AnthropicError ? e.apiMessage : e instanceof Error ? e.message : String(e);
  console.error(`Anthropic API error status=${status ?? "n/a"} model=${MODEL} message=${apiMsg}`);
  if (status === 401) return "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in Supabase → Edge Functions → Secrets.";
  if (status === 403 && /request not allowed/i.test(apiMsg))
    return "Anthropic refused the request from this server's location. Try again in a moment.";
  if (status === 403) return "This Anthropic API key isn't allowed to use the Copilot model. Check your Anthropic workspace permissions.";
  if (status === 404) return `The model "${MODEL}" isn't available to this API key. Set ANTHROPIC_MODEL to a model your key can use.`;
  if (/credit balance/i.test(apiMsg)) return "Your Anthropic account is out of credits. Add credits at console.anthropic.com → Billing, then try again.";
  if (status === 429) return "The AI is rate-limited right now. Try again in a moment.";
  if (status === 529 || status === 503) return "The AI service is overloaded right now. Try again shortly.";
  return `The Copilot couldn't answer${status ? ` (error ${status})` : ""}: ${apiMsg.slice(0, 180)}`;
}

async function runCopilot(ctx: Ctx, history: { role: "user" | "assistant"; content: string }[], message: string) {
  const snapshot = await buildSnapshot(ctx);
  const system = `${PERSONA}\n\n<company_snapshot>\n${snapshot}\n</company_snapshot>`;
  const messages: Message[] = [...history.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: message }];
  const actions: string[] = [];

  for (let step = 0; step < 6; step++) {
    const res = await callClaude({ max_tokens: 2000, system, tools: TOOLS, messages });
    const text = textOf(res.content);
    if (res.stop_reason !== "tool_use") {
      return { reply: text || (actions.length ? "Done." : "I don't have an answer for that yet."), actions };
    }
    messages.push({ role: "assistant", content: res.content });
    const results: unknown[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      const tu = block as ToolUseBlock;
      const out = await runTool(ctx, tu.name, tu.input ?? {});
      if (out.action) actions.push(out.action);
      results.push({ type: "tool_result", tool_use_id: tu.id, content: out.result, is_error: out.result.startsWith("Error") });
    }
    messages.push({ role: "user", content: results });
  }
  return { reply: "I made the changes above.", actions };
}

// ─── Request handling ───
async function aiLimitError(service: Db, ctx: Ctx): Promise<string | null> {
  const plan = planFor(ctx.workspace.plan);
  const { count, error } = await service
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", ctx.workspace.id)
    .eq("kind", "ai_message")
    .gte("created_at", monthStartISO());
  if (error) return `Couldn't check your AI usage: ${error.message}`;
  if ((count ?? 0) >= plan.limits.aiMessages) {
    return `You've used all ${plan.limits.aiMessages} Copilot messages on the ${plan.name} plan this month. Upgrade in Settings → Plan & billing.`;
  }
  return null;
}

async function recordUsage(service: Db, ctx: Ctx) {
  const { error } = await service.from("usage_events").insert({ workspace_id: ctx.workspace.id, user_id: ctx.user.id, kind: "ai_message" });
  if (error) console.error(`usage_events insert failed: ${error.message}`);
}

async function loadCtx(db: Db, user: { id: string; email?: string }, workspaceId: unknown): Promise<Ctx | string> {
  if (typeof workspaceId !== "string" || !workspaceId) return "workspace_id is required.";
  const [{ data: member }, { data: workspace }, { data: team }] = await Promise.all([
    db.from("workspace_members").select("role").eq("workspace_id", workspaceId).eq("user_id", user.id).maybeSingle(),
    db.from("workspaces").select("id, name, slug, currency, plan, cash_balance").eq("id", workspaceId).maybeSingle(),
    db.from("team_members").select("id, user_id, name, title, status, email").eq("workspace_id", workspaceId).order("name"),
  ]);
  if (!member || !workspace) return "You don't have access to this workspace.";
  const teamRows: TeamMember[] = team ?? [];
  return { db, user, workspace, role: member.role, team: teamRows, me: teamRows.find((t) => t.user_id === user.id) ?? null };
}

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const apikey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!token) return fail("Please sign in again.");

  const db: Db = createClient(SUPABASE_URL, apikey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData?.user) return fail("Your session has expired. Please sign in again.");
  const user = { id: userData.user.id as string, email: userData.user.email as string | undefined };

  let body: Json = {};
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body.");
  }
  const action = body.action;

  if (action === "status") return json({ ok: true, ai: Boolean(ANTHROPIC_API_KEY), model: MODEL });

  const service: Db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const ctxOrErr = await loadCtx(db, user, body.workspace_id);
  if (typeof ctxOrErr === "string") return fail(ctxOrErr);
  const ctx = ctxOrErr;

  if (action === "copilot" || action === "brief") {
    if (!ANTHROPIC_API_KEY) return fail("The Copilot isn't configured yet. Add ANTHROPIC_API_KEY in Supabase → Edge Functions → Secrets.");
    const over = await aiLimitError(service, ctx);
    if (over) return fail(over);

    if (action === "copilot") {
      const message = typeof body.message === "string" ? body.message.trim().slice(0, 4000) : "";
      if (!message) return fail("Type a message first.");
      const { data: prior } = await db
        .from("copilot_messages")
        .select("role, content")
        .eq("workspace_id", ctx.workspace.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(16);
      const history: { role: "user" | "assistant"; content: string }[] = ((prior ?? []) as Row[]).reverse();
      // The API requires the conversation to start with a user turn.
      while (history.length && history[0].role !== "user") history.shift();

      try {
        const turn = await runCopilot(ctx, history, message);
        const reply = turn.actions.length ? `${turn.reply}\n\n${turn.actions.map((a) => `✓ ${a}`).join("\n")}` : turn.reply;
        const { error: saveErr } = await db.from("copilot_messages").insert([
          { workspace_id: ctx.workspace.id, user_id: user.id, role: "user", content: message },
          { workspace_id: ctx.workspace.id, user_id: user.id, role: "assistant", content: reply },
        ]);
        if (saveErr) console.error(`copilot_messages insert failed: ${saveErr.message}`);
        await recordUsage(service, ctx);
        return json({ ok: true, reply, actions: turn.actions });
      } catch (e) {
        return fail(friendly(e));
      }
    }

    // brief
    try {
      const snapshot = await buildSnapshot(ctx);
      const res = await callClaude({
        max_tokens: 900,
        system: `${PERSONA}\n\n<company_snapshot>\n${snapshot}\n</company_snapshot>`,
        messages: [{ role: "user", content: BRIEF_PROMPT }],
      });
      const content = textOf(res.content);
      if (!content) return fail("The Copilot returned an empty brief. Try again.");
      const { error } = await db
        .from("briefs")
        .upsert(
          { workspace_id: ctx.workspace.id, user_id: user.id, brief_date: todayISO(), content },
          { onConflict: "workspace_id,user_id,brief_date" },
        );
      if (error) return fail(error.message);
      await recordUsage(service, ctx);
      return json({ ok: true, content });
    } catch (e) {
      return fail(friendly(e));
    }
  }

  if (action === "change_plan") {
    if (ctx.role !== "owner" && ctx.role !== "admin") return fail("Only owners and admins can change the plan.");
    const planId = body.plan as PlanId;
    if (!(planId in PLANS)) return fail("Unknown plan.");
    const target = PLANS[planId];
    if (planId === ctx.workspace.plan) return json({ ok: true, message: `You're already on the ${target.name} plan.` });

    const ws = ctx.workspace.id;
    const [seats, teamMembers, openDeals] = await Promise.all([
      service.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("workspace_id", ws),
      service.from("team_members").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("status", "active"),
      service.from("deals").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("status", "open"),
    ]);
    const checks: [string, number, number][] = [
      ["seats", seats.count ?? 0, target.limits.seats],
      ["team members", teamMembers.count ?? 0, target.limits.teamMembers],
      ["open deals", openDeals.count ?? 0, target.limits.openDeals],
    ];
    for (const [label, used, limit] of checks) {
      if (used > limit) return fail(`You're using ${used} ${label}; the ${target.name} plan allows ${limit}.`);
    }

    // ── Payment goes here ──
    // With a real provider, create a Razorpay Subscription / Stripe Checkout Session for `planId`
    // (store workspace_id in its notes/metadata), return { ok: true, url } for the browser to open,
    // and apply the plan below only from the provider's verified webhook. Until then this is a stub
    // that switches plans instantly without charging.
    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    const { error } = await service
      .from("workspaces")
      .update({
        plan: planId,
        plan_status: "active",
        billing_customer_id: `stub_cus_${ws.slice(0, 8)}`,
        billing_subscription_id: planId === "free" ? null : `stub_sub_${Date.now()}`,
        current_period_end: planId === "free" ? null : end.toISOString(),
      })
      .eq("id", ws);
    if (error) return fail(error.message);
    return json({ ok: true, message: `You're now on the ${target.name} plan.` });
  }

  return fail(`Unknown action "${String(action)}".`);
}

Deno.serve(async (req: Request) => {
  try {
    return await handle(req);
  } catch (e) {
    console.error(`founder-api crashed: ${e instanceof Error ? `${e.message}\n${e.stack}` : String(e)}`);
    return json({ ok: false, error: "Something went wrong. Please try again." }, 500);
  }
});
