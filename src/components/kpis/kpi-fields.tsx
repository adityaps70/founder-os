import { Field, Input, Select } from "@/components/ui/input";
import type { Kpi, TeamMember } from "@/lib/types";

export function KpiFields({ kpi, team }: { kpi?: Kpi; team: TeamMember[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Name" className="sm:col-span-2">
        <Input name="name" required defaultValue={kpi?.name ?? ""} placeholder="Weekly revenue" />
      </Field>
      <Field label="Unit" hint="e.g. ₹, %, users">
        <Input name="unit" defaultValue={kpi?.unit ?? ""} />
      </Field>
      <Field label="Weekly target">
        <Input name="target" type="number" step="any" defaultValue={kpi?.target != null ? String(Number(kpi.target)) : ""} />
      </Field>
      <Field label="Good direction">
        <Select name="direction" defaultValue={kpi?.direction ?? "up"}>
          <option value="up">Higher is better</option>
          <option value="down">Lower is better</option>
        </Select>
      </Field>
      <Field label="Owner">
        <Select name="owner_id" defaultValue={kpi?.owner_id ?? ""}>
          <option value="">Unassigned</option>
          {team
            .filter((t) => t.status === "active")
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </Select>
      </Field>
    </div>
  );
}

/** Format a KPI value with its unit (currency-like units go before the number). */
export function formatKpi(value: number | null | undefined, unit: string | null) {
  if (value === null || value === undefined) return "—";
  const n = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, notation: Math.abs(value) >= 100000 ? "compact" : "standard" }).format(value);
  if (!unit) return n;
  if (["₹", "$", "€", "£", "INR", "USD", "EUR", "GBP"].includes(unit)) return unit.length === 1 ? `${unit}${n}` : `${n} ${unit}`;
  return unit === "%" ? `${n}%` : `${n} ${unit}`;
}

export function kpiOnTrack(kpi: Pick<Kpi, "target" | "direction">, value: number | null | undefined): boolean | null {
  if (value === null || value === undefined || kpi.target === null || kpi.target === undefined) return null;
  const target = Number(kpi.target);
  return kpi.direction === "down" ? value <= target : value >= target;
}
