"use server";
import { getWorkspace, type WorkspaceContext } from "@/lib/workspace";
import { refreshWorkspace } from "@/lib/revalidate";
import { str } from "@/lib/utils";
import type { ActionState, Decision } from "@/lib/types";

const STATUSES: Decision["status"][] = ["proposed", "decided", "revisited"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fields(ctx: WorkspaceContext, fd: FormData) {
  const status = str(fd, "status") as Decision["status"] | null;
  const decidedBy = str(fd, "decided_by_id");
  const decidedOn = str(fd, "decided_on");
  return {
    title: str(fd, "title") ?? "",
    context: str(fd, "context"),
    decision: str(fd, "decision"),
    rationale: str(fd, "rationale"),
    status: status && STATUSES.includes(status) ? status : "decided",
    decided_by_id: decidedBy && ctx.team.some((t) => t.id === decidedBy) ? decidedBy : (ctx.me?.id ?? null),
    decided_on: decidedOn && DATE_RE.test(decidedOn) ? decidedOn : undefined,
    meeting_id: str(fd, "meeting_id"),
  };
}

/** Bind: createDecision.bind(null, slug). Optional hidden field meeting_id. */
export async function createDecision(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getWorkspace(slug);
  const f = fields(ctx, fd);
  if (!f.title) return { error: "Give the decision a title." };
  const { error } = await ctx.supabase.from("decisions").insert({ ...f, workspace_id: ctx.workspace.id });
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  return { ok: true };
}

/** Bind: updateDecision.bind(null, slug, id). */
export async function updateDecision(slug: string, id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getWorkspace(slug);
  const f = fields(ctx, fd);
  if (!f.title) return { error: "Give the decision a title." };
  const { error } = await ctx.supabase
    .from("decisions")
    .update(f)
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  return { ok: true };
}

export async function setDecisionStatus(slug: string, id: string, status: Decision["status"]): Promise<void> {
  if (!STATUSES.includes(status)) return;
  const ctx = await getWorkspace(slug);
  await ctx.supabase.from("decisions").update({ status }).eq("id", id).eq("workspace_id", ctx.workspace.id);
  refreshWorkspace(slug);
}

export async function deleteDecision(slug: string, id: string): Promise<void> {
  const ctx = await getWorkspace(slug);
  await ctx.supabase.from("decisions").delete().eq("id", id).eq("workspace_id", ctx.workspace.id);
  refreshWorkspace(slug);
}
