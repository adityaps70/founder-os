"use client";
import { AsyncPage } from "@/components/shell/async-page";
import Link from "next/link";
import { Archive, ArrowUpRight, CalendarClock, SquareCheckBig, Inbox, Lightbulb, Plus, StickyNote } from "lucide-react";
import { createTask } from "@/actions/tasks";
import { archiveCapture, captureToTask } from "@/actions/captures";
import { BriefCard } from "@/components/copilot/brief-card";
import { CardEmpty, Section } from "@/components/command/section";
import { moneySnapshot } from "@/components/command/money";
import { goalProgress, progressTone } from "@/components/goals/progress";
import { TaskFields } from "@/components/tasks/task-fields";
import { TaskList, TaskRow } from "@/components/tasks/task-row";
import { Avatar, Badge, ButtonLink, Progress } from "@/components/ui";
import { FormDialog } from "@/components/ui/form-dialog";
import { GOAL_STATUSES, labelFor, PIPELINE_STAGES, PRIORITY_RANK } from "@/lib/constants";
import type { Capture, Deal, Goal, KeyResult, Kpi, KpiEntry, Meeting, Project, Task, Transaction } from "@/lib/types";
import { cn, currentQuarter, formatDate, formatMoney, formatNumber, formatTime, relativeDay, todayISO, zonedDayRange, zonedHour } from "@/lib/utils";
import { getWorkspace } from "@/lib/workspace";

function greeting() {
  const h = zonedHour();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** Overdue first, then due today, then urgent/high, then by due date. */
function focusSort(a: Task, b: Task) {
  const t = todayISO();
  const rank = (x: Task) => (x.due_date && x.due_date < t ? 0 : x.due_date === t ? 1 : x.priority === "urgent" || x.priority === "high" ? 2 : 3);
  return (
    rank(a) - rank(b) ||
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")
  );
}

async function CommandCenter({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, workspace, user, me, team } = await getWorkspace(slug);
  const base = `/w`;
  const today = todayISO();
  const { start: dayStart, end: dayEnd } = zonedDayRange(today);
  const meId = me?.id ?? "00000000-0000-0000-0000-000000000000";

  const [myTasksRes, waitingRes, meetingsRes, dealsRes, txnRes, overdueInvRes, kpisRes, kpiEntriesRes, capturesRes, goalsRes, projectsRes] =
    await Promise.all([
      supabase.from("tasks").select("*").eq("workspace_id", workspace.id).eq("assignee_id", meId).neq("status", "done").limit(200),
      supabase.from("tasks").select("*").eq("workspace_id", workspace.id).neq("assignee_id", meId).neq("status", "done").limit(200),
      supabase
        .from("meetings")
        .select("*")
        .eq("workspace_id", workspace.id)
        .gte("starts_at", dayStart)
        .lt("starts_at", dayEnd)
        .order("starts_at"),
      supabase
        .from("deals")
        .select("*, contacts(name)")
        .eq("workspace_id", workspace.id)
        .eq("status", "open")
        .not("next_step_date", "is", null)
        .lte("next_step_date", todayISO(2))
        .order("next_step_date")
        .limit(6),
      supabase.from("transactions").select("kind, amount, occurred_on").eq("workspace_id", workspace.id).gte("occurred_on", todayISO(-90)),
      supabase
        .from("invoices")
        .select("id, amount", { count: "exact" })
        .eq("workspace_id", workspace.id)
        .eq("status", "sent")
        .lt("due_date", today),
      supabase.from("kpis").select("*").eq("workspace_id", workspace.id).order("created_at").limit(6),
      supabase.from("kpi_entries").select("*").eq("workspace_id", workspace.id).gte("week_start", todayISO(-63)).order("week_start"),
      supabase
        .from("captures")
        .select("*")
        .eq("workspace_id", workspace.id)
        .eq("user_id", user.id)
        .eq("processed", false)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase.from("goals").select("*, key_results(*)").eq("workspace_id", workspace.id).eq("quarter", currentQuarter()).order("created_at"),
      supabase.from("projects").select("id, name").eq("workspace_id", workspace.id).neq("status", "done").order("name"),
    ]);

  const myTasks = ((myTasksRes.data ?? []) as Task[]).sort(focusSort);
  const focus = myTasks.slice(0, 7);
  const waiting = ((waitingRes.data ?? []) as Task[])
    .sort((a, b) => {
      const fa = a.follow_up_date && a.follow_up_date <= today ? 0 : 1;
      const fb = b.follow_up_date && b.follow_up_date <= today ? 0 : 1;
      return fa - fb || (a.follow_up_date ?? a.due_date ?? "9999").localeCompare(b.follow_up_date ?? b.due_date ?? "9999");
    })
    .slice(0, 5);
  const waitingTotal = (waitingRes.data ?? []).length;
  const meetings = (meetingsRes.data ?? []) as Meeting[];
  const deals = (dealsRes.data ?? []) as (Deal & { contacts: { name: string } | null })[];
  const money = moneySnapshot(Number(workspace.cash_balance), (txnRes.data ?? []) as Transaction[]);
  const overdueInvoices = overdueInvRes.count ?? (overdueInvRes.data ?? []).length;
  const overdueAmount = ((overdueInvRes.data ?? []) as { amount: number }[]).reduce((s, i) => s + Number(i.amount), 0);
  const kpis = (kpisRes.data ?? []) as Kpi[];
  const kpiEntries = (kpiEntriesRes.data ?? []) as KpiEntry[];
  const captures = (capturesRes.data ?? []) as Capture[];
  const goals = (goalsRes.data ?? []) as (Goal & { key_results: KeyResult[] })[];
  const projects = (projectsRes.data ?? []) as Pick<Project, "id" | "name">[];

  const overdueCount = myTasks.filter((t) => t.due_date && t.due_date < today).length;
  const dueTodayCount = myTasks.filter((t) => t.due_date === today).length;
  const firstName = (me?.name ?? user.email ?? "").split(/[\s@]/)[0];
  const isNew = myTasks.length === 0 && goals.length === 0 && team.length <= 1 && kpis.length === 0;
  const fmt = (n: number) => formatMoney(n, workspace.currency, true);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-faint">{formatDate(new Date(), { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {overdueCount + dueTodayCount === 0
              ? "Nothing due today. Pick something that moves a goal forward."
              : `${dueTodayCount} due today${overdueCount ? ` · ${overdueCount} overdue` : ""} · ${meetings.length} meeting${meetings.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <FormDialog title="New task" trigger="New task" triggerIcon={<Plus className="h-4 w-4" />} action={createTask.bind(null, slug)} submitLabel="Add task">
          <TaskFields team={team} projects={projects} defaults={{ due_date: today }} />
        </FormDialog>
      </div>

      <BriefCard slug={slug} />

      {isNew && (
        <div className="rounded-xl border border-dashed border-line bg-surface p-5">
          <p className="text-sm font-semibold">Set up your Founder OS in five minutes</p>
          <p className="mt-1 text-xs text-muted">Start with the essentials. Everything shows up here as you go.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { href: `${base}/goals`, label: "Set this quarter's goals" },
              { href: `${base}/team`, label: "Add your team" },
              { href: `${base}/pipeline`, label: "Add deals or investors" },
              { href: `${base}/finance`, label: "Enter cash in bank" },
            ].map((s, i) => (
              <Link key={s.href} href={s.href} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">{i + 1}</span>
                <span className="flex-1">{s.label}</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-faint" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: execution */}
        <div className="space-y-4 lg:col-span-2">
          <Section title="Today's focus" description="Overdue and due today first, then your highest priorities" href={`${base}/tasks`}>
            {focus.length === 0 ? (
              <CardEmpty cta={<ButtonLink href={`${base}/tasks`} size="sm">Open tasks</ButtonLink>}>
                Your list is clear. Add a task or press ⌘K to capture anything on your mind.
              </CardEmpty>
            ) : (
              <TaskList>
                {focus.map((t) => (
                  <TaskRow key={t.id} slug={slug} task={t} team={team} projects={projects} showAssignee={false} />
                ))}
              </TaskList>
            )}
            {myTasks.length > focus.length && (
              <p className="border-t border-line px-4 py-2 text-xs text-faint">+{myTasks.length - focus.length} more open tasks</p>
            )}
          </Section>

          <div className="grid gap-4 md:grid-cols-2">
            <Section title="Waiting on" description={`${waitingTotal} open with your team`} href={`${base}/delegation`}>
              {waiting.length === 0 ? (
                <CardEmpty>Nothing delegated yet. Assign a task to a teammate and it shows up here.</CardEmpty>
              ) : (
                <ul className="divide-y divide-line">
                  {waiting.map((t) => {
                    const who = team.find((m) => m.id === t.assignee_id);
                    const followDue = t.follow_up_date && t.follow_up_date <= today;
                    return (
                      <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                        <Avatar name={who?.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{t.title}</p>
                          <p className="truncate text-xs text-faint">{who?.name ?? "Unassigned"}</p>
                        </div>
                        {followDue ? (
                          <Badge tone="amber">Follow up</Badge>
                        ) : t.due_date ? (
                          <span className={cn("text-xs", t.due_date < today ? "text-danger" : "text-muted")}>{relativeDay(t.due_date)}</span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            <Section title="Today's meetings" href={`${base}/meetings`}>
              {meetings.length === 0 ? (
                <CardEmpty>No meetings today. Good day for deep work.</CardEmpty>
              ) : (
                <ul className="divide-y divide-line">
                  {meetings.map((m) => (
                    <li key={m.id}>
                      <Link href={`${base}/meetings/view/?id=${m.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                        <CalendarClock className="h-4 w-4 text-faint" />
                        <span className="min-w-0 flex-1 truncate text-sm">{m.title}</span>
                        <span className="text-xs tabular-nums text-muted">
                          {formatTime(m.starts_at)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <Section title="Pipeline next steps" description="Due within two days" href={`${base}/pipeline`}>
            {deals.length === 0 ? (
              <CardEmpty>No follow-ups due. Keep deals moving by setting a next step on each one.</CardEmpty>
            ) : (
              <ul className="divide-y divide-line">
                {deals.map((d) => {
                  const stage = PIPELINE_STAGES[d.pipeline]?.find((s) => s.value === d.stage);
                  return (
                    <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          {d.title}
                          {d.contacts?.name && <span className="text-faint"> · {d.contacts.name}</span>}
                        </p>
                        <p className="truncate text-xs text-muted">{d.next_step ?? "Next step not set"}</p>
                      </div>
                      {stage && <Badge>{stage.label}</Badge>}
                      <span className="hidden text-xs tabular-nums text-muted sm:inline">{fmt(Number(d.value))}</span>
                      <span className={cn("text-xs", d.next_step_date && d.next_step_date < today ? "font-medium text-danger" : "text-muted")}>
                        {relativeDay(d.next_step_date)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title="Goals this quarter" description={currentQuarter()} href={`${base}/goals`}>
            {goals.length === 0 ? (
              <CardEmpty cta={<ButtonLink href={`${base}/goals`} size="sm">Set goals</ButtonLink>}>
                Pick 2–4 outcomes for this quarter so every task has a reason to exist.
              </CardEmpty>
            ) : (
              <ul className="divide-y divide-line">
                {goals.map((g) => {
                  const p = goalProgress(g.key_results ?? []);
                  const st = labelFor(GOAL_STATUSES, g.status);
                  return (
                    <li key={g.id} className="px-4 py-3">
                      <div className="mb-1.5 flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm">{g.title}</p>
                        {st && <Badge tone={st.tone}>{st.label}</Badge>}
                        <span className="w-10 text-right text-xs tabular-nums text-muted">{Math.round(p)}%</span>
                      </div>
                      <Progress value={p} tone={progressTone(p)} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>

        {/* Right: money, numbers, inbox */}
        <div className="space-y-4">
          <Section title="Money" href={`${base}/finance`}>
            <div className="grid grid-cols-2 gap-px bg-line">
              {[
                { label: "Cash in bank", value: fmt(Number(workspace.cash_balance)) },
                {
                  label: "Runway",
                  value: money.runwayMonths === null ? "∞" : `${formatNumber(money.runwayMonths, 1)} mo`,
                  tone: money.runwayMonths !== null && money.runwayMonths < 6 ? "text-danger" : undefined,
                },
                { label: "Income · 30d", value: fmt(money.income30) },
                { label: "Spend · 30d", value: fmt(money.burn30) },
              ].map((s) => (
                <div key={s.label} className="bg-surface px-4 py-3">
                  <p className="text-[11px] text-muted">{s.label}</p>
                  <p className={cn("mt-0.5 text-lg font-semibold tabular-nums", s.tone)}>{s.value}</p>
                </div>
              ))}
            </div>
            {overdueInvoices > 0 && (
              <Link href={`${base}/finance/invoices`} className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs hover:bg-surface-2">
                <span className="text-danger">
                  {overdueInvoices} overdue invoice{overdueInvoices === 1 ? "" : "s"}
                </span>
                <span className="tabular-nums text-muted">{fmt(overdueAmount)}</span>
              </Link>
            )}
            {Number(workspace.cash_balance) === 0 && (
              <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
                <Link href={`${base}/finance`} className="text-accent">Enter your cash balance</Link> to see runway.
              </p>
            )}
          </Section>

          <Section title="KPIs" href={`${base}/kpis`}>
            {kpis.length === 0 ? (
              <CardEmpty cta={<ButtonLink href={`${base}/kpis`} size="sm">Add KPIs</ButtonLink>}>
                Track the 3–5 numbers that tell you if the business is healthy.
              </CardEmpty>
            ) : (
              <ul className="divide-y divide-line">
                {kpis.map((k) => {
                  const entries = kpiEntries.filter((e) => e.kpi_id === k.id);
                  const latest = entries[entries.length - 1];
                  const prev = entries[entries.length - 2];
                  const hit =
                    latest && k.target !== null
                      ? k.direction === "up"
                        ? Number(latest.value) >= Number(k.target)
                        : Number(latest.value) <= Number(k.target)
                      : null;
                  const delta = latest && prev ? Number(latest.value) - Number(prev.value) : null;
                  return (
                    <li key={k.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{k.name}</p>
                        {k.target !== null && (
                          <p className="text-xs text-faint">
                            Target {formatNumber(Number(k.target), 2)}
                            {k.unit ? ` ${k.unit}` : ""}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={cn("text-sm font-semibold tabular-nums", hit === true && "text-success", hit === false && "text-danger")}>
                          {latest ? formatNumber(Number(latest.value), 2) : "—"}
                        </p>
                        {delta !== null && delta !== 0 && (
                          <p className="text-[11px] tabular-nums text-faint">
                            {delta > 0 ? "▲" : "▼"} {formatNumber(Math.abs(delta), 2)}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title="Inbox" description="Your quick captures (⌘K)">
            {captures.length === 0 ? (
              <CardEmpty>
                <Inbox className="mx-auto mb-2 h-4 w-4 text-faint" />
                Press ⌘K anywhere to capture an idea, note or task in two seconds.
              </CardEmpty>
            ) : (
              <ul className="divide-y divide-line">
                {captures.map((c) => {
                  const Icon = c.kind === "idea" ? Lightbulb : StickyNote;
                  return (
                    <li key={c.id} className="group flex items-start gap-2.5 px-4 py-2.5">
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
                      <p className="min-w-0 flex-1 whitespace-pre-line text-sm">{c.content}</p>
                      <div className="flex shrink-0 gap-0.5">
                        <form action={captureToTask.bind(null, slug, c.id)}>
                          <button type="submit" title="Make it a task" aria-label="Make it a task" className="rounded-md p-1 text-faint hover:bg-surface-2 hover:text-accent">
                            <SquareCheckBig className="h-3.5 w-3.5" />
                          </button>
                        </form>
                        <form action={archiveCapture.bind(null, slug, c.id)}>
                          <button type="submit" title="Archive" aria-label="Archive" className="rounded-md p-1 text-faint hover:bg-surface-2 hover:text-fg">
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <AsyncPage render={CommandCenter} title={"Command Center"} />;
}
