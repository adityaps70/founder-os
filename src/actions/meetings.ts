"use server";
import { redirect } from "next/navigation";
import { getWorkspace, type WorkspaceContext } from "@/lib/workspace";
import { refreshWorkspace } from "@/lib/revalidate";
import { num, str } from "@/lib/utils";
import type { ActionState } from "@/lib/types";

/**
 * Converts a browser `datetime-local` value plus the browser's timezone offset
 * (minutes, from Date#getTimezoneOffset) into a UTC ISO string.
 */
function parseStart(fd: FormData): string | null {
  const local = str(fd, "starts_at_local");
  const m = local?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const offset = num(fd, "tz_offset") ?? 0;
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) + offset * 60_000;
  const d = new Date(utc);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function attendees(ctx: WorkspaceContext, fd: FormData) {
  const ids = new Set(ctx.team.map((t) => t.id));
  return [...new Set(fd.getAll("attendee_ids").filter((v): v is string => typeof v === "string" && ids.has(v)))];
}

/** Bind: createMeeting.bind(null, slug). */
export async function createMeeting(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getWorkspace(slug);
  const title = str(fd, "title");
  if (!title) return { error: "Give the meeting a title." };
  const starts = parseStart(fd);
  if (!starts) return { error: "Pick a date and time." };
  const { data, error } = await ctx.supabase
    .from("meetings")
    .insert({
      workspace_id: ctx.workspace.id,
      title,
      starts_at: starts,
      agenda: str(fd, "agenda"),
      attendee_ids: attendees(ctx, fd),
      created_by: ctx.user.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  if (fd.get("open_after") === "1" && data?.id) redirect(`/w/${slug}/meetings/${data.id}`);
  return { ok: true };
}

/** Edit title/time/agenda/attendees. Bind: updateMeeting.bind(null, slug, id). */
export async function updateMeeting(slug: string, id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getWorkspace(slug);
  const title = str(fd, "title");
  if (!title) return { error: "Give the meeting a title." };
  const starts = parseStart(fd);
  if (!starts) return { error: "Pick a date and time." };
  const { error } = await ctx.supabase
    .from("meetings")
    .update({ title, starts_at: starts, agenda: str(fd, "agenda"), attendee_ids: attendees(ctx, fd) })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  return { ok: true };
}

/** Save agenda + notes from the meeting page. Bind: updateMeetingNotes.bind(null, slug, id). */
export async function updateMeetingNotes(slug: string, id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getWorkspace(slug);
  const { error } = await ctx.supabase
    .from("meetings")
    .update({ agenda: str(fd, "agenda"), notes: str(fd, "notes") })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  return { ok: true, message: "Saved." };
}

export async function deleteMeeting(slug: string, id: string): Promise<void> {
  const ctx = await getWorkspace(slug);
  await ctx.supabase.from("meetings").delete().eq("id", id).eq("workspace_id", ctx.workspace.id);
  refreshWorkspace(slug);
  redirect(`/w/${slug}/meetings`);
}
