import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar, Badge } from "@/components/ui";
import type { Meeting, TeamMember } from "@/lib/types";
import { LocalTime } from "./local-time";

export function MeetingList({
  slug,
  meetings,
  team,
  openItems,
}: {
  slug: string;
  meetings: Meeting[];
  team: TeamMember[];
  openItems: Map<string, number>;
}) {
  return (
    <div className="divide-y divide-line">
      {meetings.map((m) => {
        const people = m.attendee_ids.map((id) => team.find((t) => t.id === id)).filter((t): t is TeamMember => !!t);
        const open = openItems.get(m.id) ?? 0;
        return (
          <Link key={m.id} href={`/w/meetings/view/?id=${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">{m.title}</p>
              <p className="text-xs text-muted">
                <LocalTime iso={m.starts_at} />
                {m.notes ? " · Notes taken" : ""}
              </p>
            </div>
            {open > 0 && <Badge tone="amber">{open} open action{open === 1 ? "" : "s"}</Badge>}
            <div className="hidden -space-x-1.5 sm:flex">
              {people.slice(0, 4).map((p) => (
                <Avatar key={p.id} name={p.name} size="sm" className="ring-2 ring-[var(--surface)]" />
              ))}
              {people.length > 4 && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-[10px] text-muted ring-2 ring-[var(--surface)]">+{people.length - 4}</span>}
            </div>
            <ChevronRight className="h-4 w-4 text-faint" />
          </Link>
        );
      })}
    </div>
  );
}
