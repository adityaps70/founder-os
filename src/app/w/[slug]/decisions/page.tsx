import Link from "next/link";
import { Gavel, Plus, Search } from "lucide-react";
import { createDecision } from "@/actions/decisions";
import { DecisionCard } from "@/components/decisions/decision-card";
import { DECISION_STATUSES, DecisionFields } from "@/components/decisions/decision-fields";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { FormDialog } from "@/components/ui/form-dialog";
import { Input, Select } from "@/components/ui/input";
import type { Decision, Meeting } from "@/lib/types";
import { getWorkspace } from "@/lib/workspace";

export const metadata = { title: "Decisions" };

export default async function DecisionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await getWorkspace(slug);
  const { supabase, workspace, team } = ctx;

  // Strip characters that have meaning in PostgREST filter syntax.
  const q = (sp.q ?? "").replace(/[,()%*"\\]/g, " ").trim().slice(0, 100);
  const status = DECISION_STATUSES.some((s) => s.value === sp.status) ? (sp.status as Decision["status"]) : null;

  let query = supabase.from("decisions").select("*").eq("workspace_id", workspace.id);
  if (q) query = query.or(`title.ilike."%${q}%",decision.ilike."%${q}%",rationale.ilike."%${q}%"`);
  if (status) query = query.eq("status", status);

  const [{ data: rows }, { data: meetingRows }] = await Promise.all([
    query.order("decided_on", { ascending: false }).order("created_at", { ascending: false }).limit(200),
    supabase.from("meetings").select("id, title, starts_at").eq("workspace_id", workspace.id).order("starts_at", { ascending: false }).limit(100),
  ]);
  const decisions = (rows ?? []) as Decision[];
  const meetings = (meetingRows ?? []) as Pick<Meeting, "id" | "title" | "starts_at">[];
  const filtered = !!q || !!status;

  return (
    <>
      <PageHeader
        title="Decisions"
        description="What was decided, why, and by whom, so nobody has to re-argue it six months from now."
        actions={
          <FormDialog title="Log a decision" trigger="Log decision" triggerIcon={<Plus className="h-4 w-4" />} action={createDecision.bind(null, slug)} wide>
            <DecisionFields team={team} meetings={meetings} defaultDecidedBy={ctx.me?.id} />
          </FormDialog>
        }
      />

      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input name="q" defaultValue={sp.q ?? ""} placeholder="Search decisions…" className="pl-9" />
        </div>
        <Select name="status" defaultValue={status ?? ""} className="w-auto">
          <option value="">All statuses</option>
          {DECISION_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {filtered && (
          <Link href={`/w/${slug}/decisions`} className="inline-flex h-9 items-center px-2 text-sm text-muted hover:text-fg">
            Clear
          </Link>
        )}
      </form>

      <Card>
        {decisions.length === 0 ? (
          <EmptyState
            icon={Gavel}
            title={filtered ? "No decisions match" : "No decisions logged yet"}
            description={filtered ? "Try a different search or status." : "Log important calls (pricing, hires, strategy) with the reasoning behind them."}
          />
        ) : (
          <div className="divide-y divide-line">
            {decisions.map((d) => (
              <DecisionCard key={d.id} slug={slug} decision={d} team={team} meetings={meetings} />
            ))}
          </div>
        )}
      </Card>
      {decisions.length > 0 && (
        <p className="mt-2 text-xs text-faint">
          {decisions.length} decision{decisions.length === 1 ? "" : "s"}
          {filtered ? " matching" : ""}
        </p>
      )}
    </>
  );
}
