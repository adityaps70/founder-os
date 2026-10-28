"use client";
import Link from "next/link";
import {
  ChartColumn,
  Bot,
  CalendarCheck,
  SquareCheckBig,
  Check,
  Gavel,
  Handshake,
  Hourglass,
  Layers,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import { Logo } from "@/components/shell/logo";
import { buttonClass } from "@/components/ui";
import { PLANS } from "@/lib/billing/plans";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/utils";

const MODULES = [
  { icon: CalendarCheck, title: "Command Center", text: "One screen each morning: today's focus, meetings, who you're waiting on, deals to chase and cash left." },
  { icon: Target, title: "Goals → Projects → Tasks", text: "Quarterly goals with key results, projects linked to them and tasks that roll progress up." },
  { icon: SquareCheckBig, title: "Tasks & Focus", text: "List and board views, recurring tasks and an Eisenhower matrix so you spend time on what matters." },
  { icon: Users, title: "Team & 1:1s", text: "Team directory, workload, weekly check-ins with mood and blockers, and 1:1 notes per person." },
  { icon: Hourglass, title: "Delegation tracker", text: "Everything you handed off, with follow-up dates and one-click nudges. Nothing falls through the cracks." },
  { icon: Gavel, title: "Meetings & decisions", text: "Agendas, notes, action items that become tasks, and a searchable log of every decision and why." },
  { icon: Handshake, title: "Pipeline & CRM", text: "Sales, fundraising and partnership pipelines with next steps and contacts going cold." },
  { icon: Wallet, title: "Finance & invoices", text: "Burn, runway, income vs. expenses and invoices — paid invoices flow into revenue automatically." },
  { icon: ChartColumn, title: "KPI scorecard", text: "A weekly scorecard of the numbers that matter, with trends and on/off-track at a glance." },
];

const ASKS = [
  "What should I focus on today?",
  "Who on my team is overloaded?",
  "Draft this month's investor update",
  "Which deals went quiet this week?",
  "Turn these meeting notes into tasks for Priya and Arjun",
];

export default function Landing() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => setUser(data.session?.user ?? null));
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-2">
            <a href="#pricing" className="hidden px-3 text-sm text-muted hover:text-fg sm:inline">
              Pricing
            </a>
            {user ? (
              <Link href="/app/" className={buttonClass("primary", "sm")}>
                Open app
              </Link>
            ) : (
              <>
                <Link href="/login/" className={buttonClass("ghost", "sm")}>
                  Sign in
                </Link>
                <Link href="/signup/" className={buttonClass("primary", "sm")}>
                  Start free
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
          <p className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
            <Bot className="h-3.5 w-3.5 text-accent" /> With an AI chief of staff built in
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
            The operating system for running your company
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted sm:text-lg">
            Goals, tasks, team, meetings, pipeline, finances and KPIs in one place, so you stop juggling ten tools and start each day knowing exactly what matters.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={user ? "/app/" : "/signup/"} className={buttonClass("primary", "md", "h-11 px-5 text-base")}>
              {user ? "Open your workspace" : "Start free — no card needed"}
            </Link>
            <a href="#modules" className={buttonClass("secondary", "md", "h-11 px-5 text-base")}>
              See what's inside
            </a>
          </div>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-faint">
            <Layers className="h-3.5 w-3.5" /> Run several companies from one login
          </p>
        </section>

        <section id="modules" className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-center text-2xl font-semibold tracking-tight">Everything a founder runs, connected</h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted">
              Each module is useful on its own. Together they give you and the Copilot the full picture.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {MODULES.map((m) => (
                <div key={m.title} className="rounded-xl border border-line bg-bg p-5">
                  <m.icon className="h-5 w-5 text-accent" />
                  <h3 className="mt-3 text-sm font-semibold">{m.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{m.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">A Copilot that knows your company</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              The Copilot reads your live workspace: tasks, people, goals, meetings, deals, cash and KPIs. It writes your morning brief, answers questions with real numbers, drafts updates in your voice, and creates tasks or logs decisions when you ask.
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              {["Morning brief with your top 3 and what to chase", "1:1 prep and meeting follow-ups", "Investor updates from your real metrics", "Turns notes into assigned tasks"].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <div className="space-y-3">
              {ASKS.map((a, i) => (
                <div key={a} className={i % 2 ? "flex justify-start" : "flex justify-end"}>
                  <span className={i % 2 ? "rounded-2xl bg-surface-2 px-3 py-2 text-sm" : "rounded-2xl bg-accent px-3 py-2 text-sm text-accent-fg"}>{a}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-center text-2xl font-semibold tracking-tight">Simple pricing, per company</h2>
            <p className="mt-2 text-center text-sm text-muted">Start free. Upgrade when your team grows.</p>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {PLANS.map((p, i) => (
                <div key={p.id} className={`flex flex-col rounded-xl border bg-bg p-6 ${i === 1 ? "border-accent ring-1 ring-accent" : "border-line"}`}>
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-muted">{p.tagline}</p>
                  <p className="mt-4 text-3xl font-semibold tabular-nums">
                    {p.price.INR === 0 ? "Free" : formatMoney(p.price.INR, "INR")}
                    {p.price.INR > 0 && <span className="text-sm font-normal text-muted"> /mo</span>}
                  </p>
                  {p.price.USD > 0 && <p className="text-xs text-faint">or ${p.price.USD}/mo outside India</p>}
                  <ul className="mt-5 flex-1 space-y-2 text-sm text-muted">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Link href={user ? "/app/" : "/signup/"} className={buttonClass(i === 1 ? "primary" : "secondary", "md", "mt-6 w-full")}>
                    {p.price.INR === 0 ? "Start free" : `Choose ${p.name}`}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-faint sm:px-6">
          <Logo />
          <span>© {new Date().getFullYear()} Founder OS</span>
        </div>
      </footer>
    </div>
  );
}
