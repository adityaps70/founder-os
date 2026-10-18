"use server";
import { getWorkspace } from "@/lib/workspace";
import { refreshWorkspace } from "@/lib/revalidate";
import { checkLimit } from "@/lib/billing/limits";
import { num, str, weekStart } from "@/lib/utils";
import type { ActionState } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function memberFields(fd: FormData) {
  const start = str(fd, "start_date");
  return {
    name: str(fd, "name") ?? "",
    email: str(fd, "email")?.toLowerCase() ?? null,
    title: str(fd, "title"),
    department: str(fd, "department"),
    start_date: start && DATE_RE.test(start) ? start : null,
  };
}

function validateMember(f: ReturnType<typeof memberFields>): string | null {
  if (!f.name) return "Name is required.";
  if (f.name.length > 120) return "Name is too long.";
  if (f.email && !EMAIL_RE.test(f.email)) return "That email doesn't look right.";
  return null;
}

/** Add a person to the team. Bind: createTeamMember.bind(null, slug). */
export async function createTeamMember(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getWorkspace(slug);
  const f = memberFields(fd);
  const invalid = validateMember(f);
  if (invalid) return { error: invalid };
  if (f.email && ctx.team.some((t) => t.email?.toLowerCase() === f.email)) {
    return { error: "Someone on the team already uses that email." };
  }
  const over = await checkLimit(ctx, "teamMembers");
  if (over) return { error: over };
  const { error } = await ctx.supabase.from("team_members").insert({ ...f, workspace_id: ctx.workspace.id });
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  return { ok: true };
}

/** Edit a team member. Bind: updateTeamMember.bind(null, slug, id). */
export async function updateTeamMember(slug: string, id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getWorkspace(slug);
  if (!ctx.team.some((t) => t.id === id)) return { error: "Team member not found." };
  const f = memberFields(fd);
  const invalid = validateMember(f);
  if (invalid) return { error: invalid };
  if (f.email && ctx.team.some((t) => t.id !== id && t.email?.toLowerCase() === f.email)) {
    return { error: "Someone else on the team already uses that email." };
  }
  const { error } = await ctx.supabase
    .from("team_members")
    .update(f)
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  return { ok: true };
}

/** Deactivate / reactivate. Use with <ActionForm action={setTeamMemberStatus.bind(null, slug, id, "inactive")}>. */
export async function setTeamMemberStatus(
  slug: string,
  id: string,
  status: "active" | "inactive",
  _prev: ActionState,
  _fd: FormData,
): Promise<ActionState> {
  const ctx = await getWorkspace(slug);
  const member = ctx.team.find((t) => t.id === id);
  if (!member) return { error: "Team member not found." };
  if (status !== "active" && status !== "inactive") return { error: "Invalid status." };
  if (status === "inactive" && member.user_id === ctx.user.id) return { error: "You can't deactivate yourself." };
  if (status === "active" && member.status !== "active") {
    const over = await checkLimit(ctx, "teamMembers");
    if (over) return { error: over };
  }
  const { error } = await ctx.supabase
    .from("team_members")
    .update({ status })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  return { ok: true, message: status === "active" ? "Reactivated." : "Deactivated." };
}

/** Record a 1:1. Bind: createOneOnOne.bind(null, slug, memberId). */
export async function createOneOnOne(slug: string, memberId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getWorkspace(slug);
  if (!ctx.team.some((t) => t.id === memberId)) return { error: "Team member not found." };
  const heldOn = str(fd, "held_on");
  const talking = str(fd, "talking_points");
  const notes = str(fd, "notes");
  if (!talking && !notes) return { error: "Add talking points or notes." };
  const { error } = await ctx.supabase.from("one_on_ones").insert({
    workspace_id: ctx.workspace.id,
    team_member_id: memberId,
    held_on: heldOn && DATE_RE.test(heldOn) ? heldOn : undefined,
    talking_points: talking,
    notes,
    created_by: ctx.user.id,
  });
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  return { ok: true };
}

export async function deleteOneOnOne(slug: string, id: string): Promise<void> {
  const ctx = await getWorkspace(slug);
  await ctx.supabase.from("one_on_ones").delete().eq("id", id).eq("workspace_id", ctx.workspace.id);
  refreshWorkspace(slug);
}

/** Log (or overwrite) a weekly check-in. Bind: upsertCheckin.bind(null, slug, memberId). */
export async function upsertCheckin(slug: string, memberId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getWorkspace(slug);
  if (!ctx.team.some((t) => t.id === memberId)) return { error: "Team member not found." };
  const raw = str(fd, "week_start");
  const week = raw && DATE_RE.test(raw) ? weekStart(new Date(`${raw}T00:00:00`)) : weekStart();
  const moodRaw = num(fd, "mood");
  const mood = moodRaw !== null && moodRaw >= 1 && moodRaw <= 5 ? Math.round(moodRaw) : null;
  const wins = str(fd, "wins");
  const blockers = str(fd, "blockers");
  const plans = str(fd, "plans");
  if (!wins && !blockers && !plans && mood === null) return { error: "Fill in at least one field." };
  const { error } = await ctx.supabase.from("checkins").upsert(
    { workspace_id: ctx.workspace.id, team_member_id: memberId, week_start: week, wins, blockers, plans, mood },
    { onConflict: "team_member_id,week_start" },
  );
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  return { ok: true };
}

export async function deleteCheckin(slug: string, id: string): Promise<void> {
  const ctx = await getWorkspace(slug);
  await ctx.supabase.from("checkins").delete().eq("id", id).eq("workspace_id", ctx.workspace.id);
  refreshWorkspace(slug);
}
