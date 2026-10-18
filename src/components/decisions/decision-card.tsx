import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { deleteDecision, setDecisionStatus, updateDecision } from "@/actions/decisions";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FormDialog } from "@/components/ui/form-dialog";
import type { Decision, Meeting, TeamMember } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { DECISION_STATUSES, DecisionFields } from "./decision-fields";

export function DecisionCard({
  slug,
  decision,
  team,
  meetings = [],
  showMeeting = true,
}: {
  slug: string;
  decision: Decision;
  team: TeamMember[];
  meetings?: Pick<Meeting, "id" | "title" | "starts_at">[];
  showMeeting?: boolean;
}) {
  const by = team.find((t) => t.id === decision.decided_by_id);
  const status = DECISION_STATUSES.find((s) => s.value === decision.status) ?? DECISION_STATUSES[1]!;
  const meeting = meetings.find((m) => m.id === decision.meeting_id);

  return (
    <article className="group px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-fg">{decision.title}</h3>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span>{formatDate(decision.decided_on, { day: "numeric", month: "short", year: "numeric" })}</span>
            {by && (
              <span className="inline-flex items-center gap-1">
                · <Avatar name={by.name} size="sm" /> {by.name}
              </span>
            )}
            {showMeeting && meeting && (
              <span>
                · from{" "}
                <Link href={`/w/${slug}/meetings/${meeting.id}`} className="text-accent hover:underline">
                  {meeting.title}
                </Link>
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {DECISION_STATUSES.filter((s) => s.value !== decision.status).map((s) => (
            <form key={s.value} action={setDecisionStatus.bind(null, slug, decision.id, s.value)}>
              <button type="submit" className="rounded-md px-2 py-1 text-[11px] text-muted hover:bg-surface-2 hover:text-fg">
                Mark {s.label.toLowerCase()}
              </button>
            </form>
          ))}
          <FormDialog
            title="Edit decision"
            trigger={<Pencil className="h-3.5 w-3.5" />}
            triggerVariant="ghost"
            triggerSize="icon"
            action={updateDecision.bind(null, slug, decision.id)}
            wide
          >
            <DecisionFields team={team} meetings={meetings} decision={decision} />
          </FormDialog>
          <form action={deleteDecision.bind(null, slug, decision.id)}>
            <button type="submit" className="flex h-8 w-8 items-center justify-center rounded-lg text-faint hover:bg-surface-2 hover:text-danger" aria-label="Delete decision">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
      {decision.decision && <p className="mt-2 whitespace-pre-line text-sm text-fg">{decision.decision}</p>}
      {(decision.rationale || decision.context) && (
        <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
          {decision.rationale && (
            <div>
              <dt className="font-medium text-muted">Why</dt>
              <dd className="mt-0.5 whitespace-pre-line text-fg/90">{decision.rationale}</dd>
            </div>
          )}
          {decision.context && (
            <div>
              <dt className="font-medium text-muted">Context</dt>
              <dd className="mt-0.5 whitespace-pre-line text-fg/90">{decision.context}</dd>
            </div>
          )}
        </dl>
      )}
    </article>
  );
}
