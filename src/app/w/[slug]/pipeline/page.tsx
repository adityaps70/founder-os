import { Handshake, Plus, RotateCcw } from "lucide-react";
import { createDeal, deleteDeal, setDealStatus } from "@/actions/pipeline";
import { DealBoard, type BoardCard } from "@/components/pipeline/deal-board";
import { DealCardActions, DealCardBody } from "@/components/pipeline/deal-card";
import { DealFields } from "@/components/pipeline/deal-fields";
import { PipelineTabs } from "@/components/pipeline/pipeline-tabs";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui";
import { FormDialog } from "@/components/ui/form-dialog";
import { PIPELINE_STAGES, PIPELINES } from "@/lib/constants";
import type { Contact, Deal, Pipeline } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/utils";
import { getWorkspace } from "@/lib/workspace";

export const metadata = { title: "Pipeline" };

function quarterStartISO(d = new Date()) {
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1).toISOString();
}

export default async function PipelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { slug } = await params;
  const { p } = await searchParams;
  const pipeline: Pipeline = PIPELINES.some((x) => x.value === p) ? (p as Pipeline) : "sales";
  const ctx = await getWorkspace(slug);
  const { supabase, workspace, team } = ctx;
  const currency = workspace.currency;

  const [{ data: dealRows }, { data: contactRows }] = await Promise.all([
    supabase.from("deals").select("*").eq("workspace_id", workspace.id).eq("pipeline", pipeline).order("updated_at", { ascending: false }),
    supabase.from("contacts").select("id, name, company").eq("workspace_id", workspace.id).order("name"),
  ]);
  const deals = ((dealRows ?? []) as Deal[]).map((d) => ({ ...d, value: Number(d.value), probability: Number(d.probability) }));
  const contacts = (contactRows ?? []) as Pick<Contact, "id" | "name" | "company">[];

  const open = deals.filter((d) => d.status === "open");
  const closed = deals.filter((d) => d.status !== "open");
  const totalValue = open.reduce((s, d) => s + d.value, 0);
  const weighted = open.reduce((s, d) => s + (d.value * d.probability) / 100, 0);
  const qStart = quarterStartISO();
  const wonQuarter = deals.filter((d) => d.status === "won" && d.updated_at >= qStart);
  const wonValue = wonQuarter.reduce((s, d) => s + d.value, 0);
  const label = PIPELINES.find((x) => x.value === pipeline)!.label;

  const cards: BoardCard[] = open.map((d) => ({
    id: d.id,
    stage: d.stage,
    value: d.value,
    body: <DealCardBody deal={d} team={team} contacts={contacts} currency={currency} />,
    actions: <DealCardActions slug={slug} deal={d} team={team} contacts={contacts} currency={currency} />,
  }));

  const newDeal = (
    <FormDialog
      title={pipeline === "investors" ? "New investor" : pipeline === "partners" ? "New partnership" : "New deal"}
      trigger={pipeline === "investors" ? "Add investor" : "New deal"}
      triggerIcon={<Plus className="h-4 w-4" />}
      action={createDeal.bind(null, slug)}
      submitLabel="Create"
      wide
    >
      <DealFields pipeline={pipeline} team={team} contacts={contacts} currency={currency} />
    </FormDialog>
  );

  return (
    <>
      <PageHeader title="Pipeline" description="Deals, fundraising and partnerships — and the next step on each." actions={newDeal} />
      <PipelineTabs slug={slug} active={pipeline} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open" value={open.length} hint={`${label} pipeline`} />
        <Stat label={pipeline === "investors" ? "Total in play" : "Pipeline value"} value={formatMoney(totalValue, currency, true)} />
        <Stat label="Weighted" value={formatMoney(weighted, currency, true)} hint="Value × probability" />
        <Stat label="Won this quarter" value={formatMoney(wonValue, currency, true)} hint={`${wonQuarter.length} closed won`} tone={wonQuarter.length ? "good" : "neutral"} />
      </div>

      {open.length === 0 ? (
        <Card>
          <EmptyState
            icon={Handshake}
            title={`No open ${label.toLowerCase()} deals`}
            description="Add the conversations you're having so every one has a clear next step."
            action={newDeal}
          />
        </Card>
      ) : (
        <DealBoard slug={slug} stages={PIPELINE_STAGES[pipeline]} cards={cards} currency={currency} />
      )}

      {closed.length > 0 && (
        <Card className="mt-6">
          <details>
            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <CardHeader title={`Closed (${closed.length})`} description="Won and lost deals — reopen to put one back on the board." className="border-b-0" />
            </summary>
            <div className="divide-y divide-line border-t border-line">
              {closed.slice(0, 30).map((d) => {
                const contact = contacts.find((c) => c.id === d.contact_id);
                return (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Badge tone={d.status === "won" ? "green" : "red"}>{d.status === "won" ? "Won" : "Lost"}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-fg">{d.title}</p>
                      <p className="truncate text-xs text-faint">
                        {[contact?.name, formatDate(d.updated_at)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span className="text-sm tabular-nums text-muted">{formatMoney(d.value, currency, true)}</span>
                    <form action={setDealStatus.bind(null, slug, d.id, "open")}>
                      <button type="submit" className="flex h-8 w-8 items-center justify-center rounded-lg text-faint hover:bg-surface-2 hover:text-fg" title="Reopen" aria-label="Reopen deal">
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </form>
                    <form action={deleteDeal.bind(null, slug, d.id)}>
                      <button type="submit" className="text-xs text-faint hover:text-danger">Delete</button>
                    </form>
                  </div>
                );
              })}
            </div>
          </details>
        </Card>
      )}
    </>
  );
}
