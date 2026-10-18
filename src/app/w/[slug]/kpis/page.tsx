import { ChartColumn, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { addStarterKpis, createKpi, deleteKpi, logKpiValue, updateKpi } from "@/actions/kpis";
import { formatKpi, KpiFields, kpiOnTrack } from "@/components/kpis/kpi-fields";
import { Avatar, Badge, Card, EmptyState, Input, PageHeader, Sparkline } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { FormDialog } from "@/components/ui/form-dialog";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Kpi, KpiEntry } from "@/lib/types";
import { cn, formatDate, weekStart } from "@/lib/utils";
import { getWorkspace } from "@/lib/workspace";

export const metadata = { title: "KPIs" };

const WEEKS = 8;

export default async function KpisPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, workspace, team } = await getWorkspace(slug);

  // Oldest → newest; the last one is the current week.
  const weeks = Array.from({ length: WEEKS }, (_, i) => weekStart(new Date(), -(WEEKS - 1 - i)));
  const thisWeek = weeks[WEEKS - 1]!;

  const [{ data: kpiRows }, { data: entryRows }] = await Promise.all([
    supabase.from("kpis").select("*").eq("workspace_id", workspace.id).order("created_at"),
    supabase.from("kpi_entries").select("*").eq("workspace_id", workspace.id).gte("week_start", weeks[0]!),
  ]);
  const kpis = (kpiRows ?? []) as Kpi[];
  const entries = new Map<string, number>();
  for (const e of (entryRows ?? []) as KpiEntry[]) entries.set(`${e.kpi_id}:${e.week_start}`, Number(e.value));

  const addKpi = (
    <FormDialog title="New KPI" trigger="Add KPI" triggerIcon={<Plus className="h-4 w-4" />} action={createKpi.bind(null, slug)} submitLabel="Create">
      <KpiFields team={team} />
    </FormDialog>
  );

  const onTrackCount = kpis.filter((k) => kpiOnTrack(k, entries.get(`${k.id}:${thisWeek}`)) === true).length;
  const withTarget = kpis.filter((k) => k.target !== null && entries.has(`${k.id}:${thisWeek}`)).length;

  return (
    <>
      <PageHeader
        title="KPIs"
        description={
          kpis.length
            ? `Weekly scorecard · ${onTrackCount} of ${withTarget} on track this week`
            : "The handful of numbers that tell you if the company is working."
        }
        actions={addKpi}
      />

      {kpis.length === 0 ? (
        <Card>
          <EmptyState
            icon={ChartColumn}
            title="No KPIs yet"
            description="Start with MRR, new customers, burn and active users — or add your own. Log one number per week."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <form action={addStarterKpis.bind(null, slug)}>
                  <SubmitButton variant="secondary">
                    <Sparkles className="h-4 w-4" /> Add starter KPIs
                  </SubmitButton>
                </form>
                {addKpi}
              </div>
            }
          />
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-2.5 font-medium">KPI</th>
                  {weeks.map((w) => (
                    <th key={w} className={cn("px-2 py-2.5 text-right font-medium tabular-nums", w === thisWeek && "text-fg")}>
                      {w === thisWeek ? "This week" : formatDate(w)}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 font-medium">Trend</th>
                  <th className="px-3 py-2.5 text-right font-medium">Target</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {kpis.map((k) => {
                  const values = weeks.map((w) => entries.get(`${k.id}:${w}`));
                  const current = values[WEEKS - 1];
                  // Status uses this week's value, or the latest logged one.
                  const latest = [...values].reverse().find((v) => v !== undefined);
                  const status = kpiOnTrack(k, current ?? latest);
                  const owner = team.find((t) => t.id === k.owner_id);
                  const series = values.filter((v): v is number => v !== undefined);
                  return (
                    <tr key={k.id} className="group">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {owner && <Avatar name={owner.name} size="sm" />}
                          <div className="min-w-0">
                            <p className="font-medium text-fg">{k.name}</p>
                            <p className="text-xs text-faint">{k.direction === "down" ? "Lower is better" : "Higher is better"}</p>
                          </div>
                        </div>
                      </td>
                      {values.slice(0, WEEKS - 1).map((v, i) => (
                        <td key={weeks[i]} className="px-2 py-2.5 text-right tabular-nums text-muted">
                          {formatKpi(v, k.unit)}
                        </td>
                      ))}
                      <td className="px-2 py-1.5">
                        <ActionForm action={logKpiValue.bind(null, slug, k.id)} resetOnSuccess={false} className="flex justify-end">
                          <input type="hidden" name="week_start" value={thisWeek} />
                          <div className="flex items-center gap-1">
                            <Input
                              key={`${k.id}-${current ?? "empty"}`}
                              name="value"
                              type="number"
                              step="any"
                              defaultValue={current !== undefined ? String(current) : ""}
                              placeholder="—"
                              className="h-8 w-24 text-right tabular-nums"
                              aria-label={`${k.name} this week`}
                            />
                            <SubmitButton size="sm" variant="secondary">
                              Save
                            </SubmitButton>
                          </div>
                        </ActionForm>
                      </td>
                      <td className="px-3 py-2.5">
                        <Sparkline values={series} width={96} height={28} />
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted">{k.target !== null ? formatKpi(Number(k.target), k.unit) : "—"}</td>
                      <td className="px-3 py-2.5">
                        {status === null ? (
                          <Badge tone="gray">{latest === undefined ? "No data" : "No target"}</Badge>
                        ) : status ? (
                          <Badge tone="green">On track</Badge>
                        ) : (
                          <Badge tone="red">Off track</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end">
                          <FormDialog
                            title="Edit KPI"
                            trigger={<Pencil className="h-3.5 w-3.5" />}
                            triggerVariant="ghost"
                            triggerSize="icon"
                            action={updateKpi.bind(null, slug, k.id)}
                          >
                            <KpiFields kpi={k} team={team} />
                          </FormDialog>
                          <form action={deleteKpi.bind(null, slug, k.id)}>
                            <button type="submit" className="flex h-8 w-8 items-center justify-center rounded-lg text-faint hover:bg-surface-2 hover:text-danger" aria-label="Delete KPI">
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
        </Card>
      )}
    </>
  );
}
