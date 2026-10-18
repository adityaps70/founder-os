import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { todayISO, weekStart } from "@/lib/utils";

export function OneOnOneFields({ name }: { name: string }) {
  return (
    <>
      <Field label="Date">
        <Input type="date" name="held_on" defaultValue={todayISO()} required />
      </Field>
      <Field label="Talking points">
        <Textarea name="talking_points" rows={4} placeholder={`What do you want to cover with ${name}?`} />
      </Field>
      <Field label="Notes">
        <Textarea name="notes" rows={5} placeholder="What was discussed, feedback given, commitments made…" />
      </Field>
    </>
  );
}

export function CheckinFields() {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Week of" hint="Saved against that week's Monday. Re-logging a week overwrites it.">
          <Input type="date" name="week_start" defaultValue={weekStart()} required />
        </Field>
        <Field label="Mood">
          <Select name="mood" defaultValue="">
            <option value="">Not recorded</option>
            <option value="5">5 — Great</option>
            <option value="4">4 — Good</option>
            <option value="3">3 — Okay</option>
            <option value="2">2 — Struggling</option>
            <option value="1">1 — Rough week</option>
          </Select>
        </Field>
      </div>
      <Field label="Wins">
        <Textarea name="wins" placeholder="What went well this week?" />
      </Field>
      <Field label="Blockers">
        <Textarea name="blockers" placeholder="What's in the way?" />
      </Field>
      <Field label="Plans for next week">
        <Textarea name="plans" placeholder="Top priorities for next week" />
      </Field>
    </>
  );
}
