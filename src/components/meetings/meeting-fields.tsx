import { Field, Input, Textarea } from "@/components/ui/input";
import type { Meeting, TeamMember } from "@/lib/types";
import { DateTimeInput } from "./datetime-input";

/** Fields for creating/editing a meeting. */
export function MeetingFields({ team, meeting }: { team: TeamMember[]; meeting?: Meeting }) {
  const active = team.filter((t) => t.status === "active" || meeting?.attendee_ids.includes(t.id));
  return (
    <>
      <Field label="Title">
        <Input name="title" required defaultValue={meeting?.title ?? ""} placeholder="Weekly leadership sync" autoFocus />
      </Field>
      <Field label="Date & time">
        <DateTimeInput defaultIso={meeting?.starts_at} />
      </Field>
      <Field label="Agenda">
        <Textarea name="agenda" rows={4} defaultValue={meeting?.agenda ?? ""} placeholder={"1. Wins from last week\n2. Blockers\n3. Decisions needed"} />
      </Field>
      {active.length > 0 && (
        <fieldset>
          <legend className="mb-1 text-xs font-medium text-muted">Attendees</legend>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {active.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                <input
                  type="checkbox"
                  name="attendee_ids"
                  value={t.id}
                  defaultChecked={meeting ? meeting.attendee_ids.includes(t.id) : false}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <span className="truncate">{t.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </>
  );
}
