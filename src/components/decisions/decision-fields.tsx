import { Field, Input, Select, Textarea } from "@/components/ui/input";
import type { Decision, Meeting, TeamMember } from "@/lib/types";
import { todayISO } from "@/lib/utils";

export const DECISION_STATUSES: { value: Decision["status"]; label: string; tone: "amber" | "green" | "purple" }[] = [
  { value: "proposed", label: "Proposed", tone: "amber" },
  { value: "decided", label: "Decided", tone: "green" },
  { value: "revisited", label: "Revisited", tone: "purple" },
];

/** Fields for logging/editing a decision. Pass `meetingId` to lock it to a meeting. */
export function DecisionFields({
  team,
  meetings = [],
  decision,
  meetingId,
  defaultDecidedBy,
}: {
  team: TeamMember[];
  meetings?: Pick<Meeting, "id" | "title" | "starts_at">[];
  decision?: Decision;
  meetingId?: string;
  defaultDecidedBy?: string | null;
}) {
  return (
    <>
      <Field label="Decision title">
        <Input name="title" required defaultValue={decision?.title ?? ""} placeholder="Move pricing to annual-first" autoFocus />
      </Field>
      <Field label="What did we decide?">
        <Textarea name="decision" rows={3} defaultValue={decision?.decision ?? ""} placeholder="The decision, stated plainly." />
      </Field>
      <Field label="Why">
        <Textarea name="rationale" rows={3} defaultValue={decision?.rationale ?? ""} placeholder="Reasoning, trade-offs, alternatives considered." />
      </Field>
      <Field label="Context">
        <Textarea name="context" rows={2} defaultValue={decision?.context ?? ""} placeholder="Background that led here (optional)." />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Decided by">
          <Select name="decided_by_id" defaultValue={decision?.decided_by_id ?? defaultDecidedBy ?? ""}>
            <option value="">Me</option>
            {team.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date">
          <Input type="date" name="decided_on" defaultValue={decision?.decided_on ?? todayISO()} />
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={decision?.status ?? "decided"}>
            {DECISION_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {meetingId ? (
        <input type="hidden" name="meeting_id" value={meetingId} />
      ) : (
        meetings.length > 0 && (
          <Field label="From meeting">
            <Select name="meeting_id" defaultValue={decision?.meeting_id ?? ""}>
              <option value="">None</option>
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} · {m.starts_at.slice(0, 10)}
                </option>
              ))}
            </Select>
          </Field>
        )
      )}
    </>
  );
}
