"use client";
import { AsyncPage } from "@/components/shell/async-page";
import { CalendarPlus, CalendarDays, History } from "lucide-react";
import { createMeeting } from "@/actions/meetings";
import { MeetingFields } from "@/components/meetings/meeting-fields";
import { MeetingList } from "@/components/meetings/meeting-list";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { Checkbox } from "@/components/ui/input";
import { FormDialog } from "@/components/ui/form-dialog";
import type { Meeting } from "@/lib/types";
import { getWorkspace } from "@/lib/workspace";

async function MeetingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspace(slug);
  const { supabase, workspace, team } = ctx;

  const now = new Date();
  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [{ data: upcomingRows }, { data: pastRows }] = await Promise.all([
    supabase.from("meetings").select("*").eq("workspace_id", workspace.id).gte("starts_at", now.toISOString()).order("starts_at").limit(50),
    supabase
      .from("meetings")
      .select("*")
      .eq("workspace_id", workspace.id)
      .lt("starts_at", now.toISOString())
      .gte("starts_at", monthAgo.toISOString())
      .order("starts_at", { ascending: false }),
  ]);
  const upcoming = (upcomingRows ?? []) as Meeting[];
  const past = (pastRows ?? []) as Meeting[];

  const ids = [...upcoming, ...past].map((m) => m.id);
  const openItems = new Map<string, number>();
  if (ids.length) {
    const { data: items } = await supabase.from("tasks").select("meeting_id").in("meeting_id", ids).neq("status", "done");
    for (const r of (items ?? []) as { meeting_id: string }[]) openItems.set(r.meeting_id, (openItems.get(r.meeting_id) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader
        title="Meetings"
        description="Agenda → notes → action items. Action items become tasks, and decisions go to the decision log."
        actions={
          <FormDialog title="New meeting" trigger="New meeting" triggerIcon={<CalendarPlus className="h-4 w-4" />} action={createMeeting.bind(null, slug)} submitLabel="Create meeting" wide>
            <MeetingFields team={team} />
            <Checkbox name="open_after" value="1" label="Open the meeting after creating it" defaultChecked />
          </FormDialog>
        }
      />

      <div className="space-y-6">
        <Card>
          <CardHeader title="Upcoming" description={upcoming.length ? `${upcoming.length} scheduled` : undefined} />
          {upcoming.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Nothing scheduled" description="Create a meeting to prepare an agenda and capture action items." />
          ) : (
            <MeetingList slug={slug} meetings={upcoming} team={team} openItems={openItems} />
          )}
        </Card>
        <Card>
          <CardHeader title="Past 30 days" />
          {past.length === 0 ? (
            <EmptyState icon={History} title="No recent meetings" />
          ) : (
            <MeetingList slug={slug} meetings={past} team={team} openItems={openItems} />
          )}
        </Card>
      </div>
    </>
  );
}

export default function Page() {
  return <AsyncPage render={MeetingsPage} title={"Meetings"} />;
}
