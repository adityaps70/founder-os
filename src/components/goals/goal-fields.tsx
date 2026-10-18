import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { GOAL_STATUSES } from "@/lib/constants";
import type { Goal, TeamMember } from "@/lib/types";

export function GoalFields({ team, goal, quarter, withKeyResult }: { team: TeamMember[]; goal?: Goal; quarter: string; withKeyResult?: boolean }) {
  return (
    <>
      <Field label="Goal" hint="An outcome, not an activity. E.g. “Reach ₹10L MRR”, not “Do marketing”.">
        <Input name="title" required defaultValue={goal?.title ?? ""} placeholder="Reach product-market fit in the SMB segment" autoFocus />
      </Field>
      <Field label="Why it matters">
        <Textarea name="description" rows={2} defaultValue={goal?.description ?? ""} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quarter">
          <Input name="quarter" required pattern="\d{4}-Q[1-4]" defaultValue={goal?.quarter ?? quarter} />
        </Field>
        <Field label="Owner">
          <Select name="owner_id" defaultValue={goal?.owner_id ?? ""}>
            <option value="">Me</option>
            {team
              .filter((t) => t.status === "active")
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={goal?.status ?? "on_track"}>
            {GOAL_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Target date">
          <Input type="date" name="target_date" defaultValue={goal?.target_date ?? ""} />
        </Field>
      </div>
      {withKeyResult && (
        <div className="rounded-lg border border-line bg-surface-2/50 p-3">
          <p className="mb-2 text-xs font-medium">First key result (optional)</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Measure" className="col-span-2 sm:col-span-4">
              <Input name="kr_title" placeholder="Monthly recurring revenue" />
            </Field>
            <Field label="Start">
              <Input name="kr_start" inputMode="decimal" placeholder="0" />
            </Field>
            <Field label="Target">
              <Input name="kr_target" inputMode="decimal" placeholder="1000000" />
            </Field>
            <Field label="Unit" className="col-span-2">
              <Input name="kr_unit" placeholder="₹, users, %" />
            </Field>
          </div>
        </div>
      )}
    </>
  );
}

export function KeyResultFields() {
  return (
    <>
      <Field label="Key result" hint="Something you can measure.">
        <Input name="title" required placeholder="Paying customers" autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start value">
          <Input name="start_value" inputMode="decimal" placeholder="0" />
        </Field>
        <Field label="Target value">
          <Input name="target_value" required inputMode="decimal" placeholder="100" />
        </Field>
        <Field label="Current value" hint="Defaults to start">
          <Input name="current_value" inputMode="decimal" />
        </Field>
        <Field label="Unit">
          <Input name="unit" placeholder="customers" />
        </Field>
      </div>
    </>
  );
}
