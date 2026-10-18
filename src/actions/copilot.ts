"use server";
import { getWorkspace } from "@/lib/workspace";
import { refreshWorkspace } from "@/lib/revalidate";
import { checkLimit, recordUsage } from "@/lib/billing/limits";
import { aiConfigured, runBrief, runCopilot } from "@/lib/ai/copilot";
import { todayISO } from "@/lib/utils";
import type { CopilotMessage } from "@/lib/types";

export type CopilotResult = { ok: true; reply: string; actions: string[] } | { ok: false; error: string };

const NOT_CONFIGURED = "The Copilot isn't configured yet. Add ANTHROPIC_API_KEY to your environment variables.";

function friendly(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (/401|authentication/i.test(msg)) return "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.";
  if (/429|rate/i.test(msg)) return "The AI is busy right now. Try again in a moment.";
  return "The Copilot couldn't answer just now. Please try again.";
}

/** Send a message to the Copilot; persists both sides of the conversation. */
export async function sendCopilotMessage(slug: string, message: string): Promise<CopilotResult> {
  const text = message.trim().slice(0, 4000);
  if (!text) return { ok: false, error: "Type a message first." };
  if (!aiConfigured()) return { ok: false, error: NOT_CONFIGURED };

  const ctx = await getWorkspace(slug);
  const over = await checkLimit(ctx, "aiMessages");
  if (over) return { ok: false, error: over };

  const { data: prior } = await ctx.supabase
    .from("copilot_messages")
    .select("role, content")
    .eq("workspace_id", ctx.workspace.id)
    .eq("user_id", ctx.user.id)
    .order("created_at", { ascending: false })
    .limit(16);
  const history = ((prior ?? []) as Pick<CopilotMessage, "role" | "content">[]).reverse();
  // The API requires the conversation to start with a user turn.
  while (history.length && history[0]!.role !== "user") history.shift();

  try {
    const turn = await runCopilot(ctx, history, text);
    const reply = turn.actions.length ? `${turn.reply}\n\n${turn.actions.map((a) => `✓ ${a}`).join("\n")}` : turn.reply;
    await ctx.supabase.from("copilot_messages").insert([
      { workspace_id: ctx.workspace.id, user_id: ctx.user.id, role: "user", content: text },
      { workspace_id: ctx.workspace.id, user_id: ctx.user.id, role: "assistant", content: reply },
    ]);
    await recordUsage(ctx, "ai_message");
    if (turn.actions.length) refreshWorkspace(slug);
    return { ok: true, reply, actions: turn.actions };
  } catch (e) {
    console.error("copilot error", e);
    return { ok: false, error: friendly(e) };
  }
}

export async function clearCopilot(slug: string): Promise<void> {
  const ctx = await getWorkspace(slug);
  await ctx.supabase.from("copilot_messages").delete().eq("workspace_id", ctx.workspace.id).eq("user_id", ctx.user.id);
  refreshWorkspace(slug);
}

export type BriefState = { error?: string } | null;

/** Generate (or regenerate) today's morning brief. */
export async function generateBrief(slug: string, _prev: BriefState, _fd: FormData): Promise<BriefState> {
  if (!aiConfigured()) return { error: NOT_CONFIGURED };
  const ctx = await getWorkspace(slug);
  const over = await checkLimit(ctx, "aiMessages");
  if (over) return { error: over };
  try {
    const content = await runBrief(ctx);
    const { error } = await ctx.supabase
      .from("briefs")
      .upsert(
        { workspace_id: ctx.workspace.id, user_id: ctx.user.id, brief_date: todayISO(), content },
        { onConflict: "workspace_id,user_id,brief_date" },
      );
    if (error) return { error: error.message };
    await recordUsage(ctx, "ai_message");
    refreshWorkspace(slug);
    return null;
  } catch (e) {
    console.error("brief error", e);
    return { error: friendly(e) };
  }
}
