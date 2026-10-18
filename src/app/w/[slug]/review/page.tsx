import Link from "next/link";
import { Bot, CalendarClock, CircleCheck, Gavel, Handshake } from "lucide-react";
import { CardEmpty, Section } from "@/components/command/section";
import { TaskList, TaskRow } from "@/components/tasks/task-row";
import { Badge, buttonClass, PageHeader, Stat } from "@/components/ui";
import { PIPELINE_STAGES } from "@/lib/constants";
import type { Deal, Decision, Meeting, Project, Task, Transaction } from "@/lib/types";
import { formatDate, formatDateTime, formatMoney, todayISO } from "@/lib/utils";
import { getWorkspace } from "@/lib/workspace";

export const metadata = { title: "Weekly review" };

const REVIEW_PROMPT = "Run my weekly review: summarise last week and propose my top 3 priorities for next week";

export default async function ReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, workspace, team } = await getWorkspace(slug);
  const base = `/w/${slug}`;
  const today = todayISO();
  const weekAgo = todayISO(-7);
  const weekAgoTs = new Date(`${weekAgo}T00:00:00`).toISOString();
  const nextWeek = todayISO(7);
  const nowTs = new Date().toISOString();
  const nextWeekTs = new Date(`${todayISO(8)}T00:00:00`).toISOString();

  const [completedRes, slippedRes, decisionsRes, dealsRes, txnRes, upcomingRes, meetingsRes, projectsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("status", "done")
      .gte("completed_at", weekAgoTs)
      .order("completed_at", { ascending: false })
      .limit(200),
    supabase.from("tasks").select("*").eq("workspace_id", workspace.id).neq("status", "done").lt("due_date", today).order("due_date").limit(100),
    supabase.from("decisions").select("*").eq("workspace_id", workspace.id).gte("decided_on", weekAgo).order("decided_on", { ascending: false }),
    supabase.from("deals").select("*, contacts(name)").eq("workspace_id", workspace.id).gte("updated_at", weekAgoTs).order("updated_at", { ascending: false }).limit(50),
    supabase.from("transactions").select("kind, amount, occurred_on").eq("workspace_id", workspace.id).gte("occurred_on", weekAgo),
    supabase
      .from("tasks")
      .select("*")
      .eq("workspace_id", workspace.id)
      .neq("status", "done")
      .gte("due_date", today)
      .lte("due_date", nextWeek)
      .order("due_date")
      .limit(100),
    supabase.from("meetings").select("*").eq("workspace_id", workspace.id).gte("starts_at", nowTs).lt("starts_at", nextWeekTs).order("starts_at"),
    supabase.from("projects").select("id, name").eq("workspace_id", workspace.id),
  ]);

  const completed = (completedRes.data ?? []) as Task[];
  const slipped = (slippedRes.data ?? []) as Task[];
  const decisions = (decisionsRes.data ?? []) as Decision[];
  const deals = (dealsRes.data ?? []) as (Deal & { contacts: { name: string } | null })[];
  const txns = (txnRes.data ?? []) as Pick<Transaction, "kind" | "amount">[];
  const upcoming = (upcomingRes.data ?? []) as Task[];
  const meetings = (meetingsRes.data ?? []) as Meeting[];
  const projects = (projectsRes.data ?? []) as Pick<Project, "id" | "name">[];

  const income = txns.filter((t) => t.kind === "income").reduce((s, t) => s + Number(t.amount), 0);
  const spend = txns.filter((t) => t.kind === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const won = deals.filter((d) => d.status === "won");
  const lost = deals.filter((d) => d.status === "lost");
  const moved = deals.filter((d) => d.status === "open");
  const fmt = (n: number) => formatMoney(n, workspace.currency, true);

  // Completed per person, for a quick "who shipped what" line
  const shippedBy = new Map<string, number>();
  for (const t of completed) {
    const name = team.find((m) => m.id === t.assignee_id)?.name ?? "Unassigned";
    shippedBy.set(name, (shippedBy.get(name) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly review"
        description={`${formatDate(weekAgo)} – ${formatDate(today)}. Look back, then set next week up to win.`}
        actions={
          <Link href={`${base}/copilot?prompt=${encodeURIComponent(REVIEW_PROMPT)}`} className={buttonClass("primary")}>
            <Bot className="h-4 w-4" /> Review with Copilot
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Tasks completed" value={completed.length} hint={shippedBy.size ? `${shippedBy.size} ${shippedBy.size === 1 ? "person" : "people"} shipped` : undefined} />
        <Stat label="Slipped (overdue)" value={slipped.length} tone={slipped.length ? "bad" : "good"} hint={slipped.length ? "Re-plan or drop these" : "Nothing overdue"} />
        <Stat label="Deals won" value={won.length} tone={won.length ? "good" : "neutral"} hint={won.length ? fmt(won.reduce((s, d) => s + Number(d.value), 0)) : `${lost.length} lost`} />
        <Stat label="Net cash flow" value={fmt(income - spend)} tone={income - spend >= 0 ? "good" : "bad"} hint={`${fmt(income)} in · ${fmt(spend)} out`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Last 7 days: shipped" description={[...shippedBy].map(([n, c]) => `${n} ${c}`).join(" · ") || undefined} href={`${base}/tasks?status=done&who=all`}>
          {completed.length === 0 ? (
            <CardEmpty>Nothing marked done this week.</CardEmpty>
          ) : (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {completed.map((t) => (
                <li key={t.id} className="flex items-center gap-2.5 px-4 py-2">
                  <CircleCheck className="h-4 w-4 shrink-0 text-success" />
                  <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                  <span className="text-xs text-faint">{team.find((m) => m.id === t.assignee_id)?.name ?? ""}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Slipped" description="Overdue and still open" href={`${base}/tasks?who=all`}>
          {slipped.length === 0 ? (
            <CardEmpty>Nothing overdue. Nice.</CardEmpty>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <TaskList>
                {slipped.map((t) => (
                  <TaskRow key={t.id} slug={slug} task={t} team={team} projects={projects} compact />
                ))}
              </TaskList>
            </div>
          )}
        </Section>

        <Section title="Decisions logged" href={`${base}/decisions`}>
          {decisions.length === 0 ? (
            <CardEmpty>No decisions logged this week. Writing them down saves re-arguing them later.</CardEmpty>
          ) : (
            <ul className="divide-y divide-line">
              {decisions.map((d) => (
                <li key={d.id} className="flex items-start gap-2.5 px-4 py-2.5">
                  <Gavel className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{d.title}</p>
                    {d.decision && <p className="line-clamp-2 text-xs text-muted">{d.decision}</p>}
                  </div>
                  <span className="text-xs text-faint">{formatDate(d.decided_on)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Pipeline activity" description={`${won.length} won · ${lost.length} lost · ${moved.length} updated`} href={`${base}/pipeline`}>
          {deals.length === 0 ? (
            <CardEmpty>No deal activity this week.</CardEmpty>
          ) : (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {deals.map((d) => (
                <li key={d.id} className="flex items-center gap-2.5 px-4 py-2">
                  <Handshake className="h-4 w-4 shrink-0 text-faint" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {d.title}
                    {d.contacts?.name && <span className="text-faint"> · {d.contacts.name}</span>}
                  </span>
                  {d.status === "won" ? (
                    <Badge tone="green">Won</Badge>
                  ) : d.status === "lost" ? (
                    <Badge tone="red">Lost</Badge>
                  ) : (
                    <Badge>{PIPELINE_STAGES[d.pipeline]?.find((s) => s.value === d.stage)?.label ?? d.stage}</Badge>
                  )}
                  <span className="text-xs tabular-nums text-muted">{fmt(Number(d.value))}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">Next 7 days</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Due next week" href={`${base}/tasks?who=all`}>
            {upcoming.length === 0 ? (
              <CardEmpty>Nothing scheduled. Pull work forward from your goals.</CardEmpty>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <TaskList>
                  {upcoming.map((t) => (
                    <TaskRow key={t.id} slug={slug} task={t} team={team} projects={projects} compact />
                  ))}
                </TaskList>
              </div>
            )}
          </Section>
          <Section title="Meetings" href={`${base}/meetings`}>
            {meetings.length === 0 ? (
              <CardEmpty>No meetings scheduled.</CardEmpty>
            ) : (
              <ul className="divide-y divide-line">
                {meetings.map((m) => (
                  <li key={m.id}>
                    <Link href={`${base}/meetings/${m.id}`} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-surface-2">
                      <CalendarClock className="h-4 w-4 text-faint" />
                      <span className="min-w-0 flex-1 truncate text-sm">{m.title}</span>
                      <span className="text-xs text-muted">{formatDateTime(m.starts_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">Reflect</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {[
            ["What went well?", "Name the wins, including small ones. What made them work?"],
            ["What should change?", "What slipped, and why? What will you stop doing?"],
            ["Top 3 for next week", "If only three things got done, which would move a goal the most?"],
          ].map(([q, h]) => (
            <div key={q}>
              <p className="text-sm font-medium">{q}</p>
              <p className="mt-1 text-xs text-muted">{h}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-faint">
          Capture your answers with ⌘K, or{" "}
          <Link className="text-accent" href={`${base}/copilot?prompt=${encodeURIComponent(REVIEW_PROMPT)}`}>
            let Copilot draft the review
          </Link>{" "}
          from this week&apos;s data.
        </p>
      </div>
    </div>
  );
}
