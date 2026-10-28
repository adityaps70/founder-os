import { getWorkspace } from "@/lib/workspace";
import { refreshWorkspace } from "@/lib/revalidate";
import { callApi } from "@/lib/supabase/client";

export type CopilotResult = { ok: true; reply: string; actions: string[] } | { ok: false; error: string };

/** Send a message to the Copilot (runs in the founder-api Edge Function, which also saves the conversation). */
export async function sendCopilotMessage(slug: string, message: string): Promise<CopilotResult> {
  const text = message.trim().slice(0, 4000);
  if (!text) return { ok: false, error: "Type a message first." };
  const ctx = await getWorkspace(slug);
  const res = await callApi<{ reply: string; actions: string[] }>({ action: "copilot", workspace_id: ctx.workspace.id, message: text });
  if (!res.ok) return res;
  if (res.actions?.length) refreshWorkspace(slug);
  return { ok: true, reply: res.reply, actions: res.actions ?? [] };
}

export async function clearCopilot(slug: string): Promise<void> {
  const ctx = await getWorkspace(slug);
  await ctx.supabase.from("copilot_messages").delete().eq("workspace_id", ctx.workspace.id).eq("user_id", ctx.user.id);
  refreshWorkspace(slug);
}

export type BriefState = { error?: string } | null;

/** Generate (or regenerate) today's morning brief. */
export async function generateBrief(slug: string, _prev: BriefState, _fd: FormData): Promise<BriefState> {
  const ctx = await getWorkspace(slug);
  const res = await callApi<{ content: string }>({ action: "brief", workspace_id: ctx.workspace.id });
  if (!res.ok) return { error: res.error };
  refreshWorkspace(slug);
  return null;
}

let aiStatus: Promise<boolean> | null = null;
/** Whether the Edge Function has an Anthropic key configured (cached per page load). */
export function aiConfigured(): Promise<boolean> {
  aiStatus ??= callApi<{ ai: boolean }>({ action: "status" }).then((r) => (r.ok ? Boolean(r.ai) : false));
  return aiStatus;
}
