"use server";
import { getWorkspace } from "@/lib/workspace";
import { refreshWorkspace } from "@/lib/revalidate";
import { checkLimit, recordUsage } from "@/lib/billing/limits";
import { aiConfigured, COPILOT_MODEL, runBrief, runCopilot } from "@/lib/ai/copilot";
import { todayISO } from "@/lib/utils";
import type { CopilotMessage } from "@/lib/types";

export type CopilotResult = { ok: true; reply: string; actions: string[] } | { ok: false; error: string };

const NOT_CONFIGURED = "The Copilot isn't configured yet. Add ANTHROPIC_API_KEY to your environment variables.";

/** Turns an Anthropic API error into a message the founder can act on, and logs the details. */
function friendly(e: unknown) {
  const err = e as { status?: number; message?: string; error?: { error?: { type?: string; message?: string } } };
  const status = typeof err?.status === "number" ? err.status : undefined;
  const apiMsg = err?.error?.error?.message ?? (e instanceof Error ? e.message : String(e));
  // Log as plain strings so they show up in Cloudflare / Vercel logs (Error objects lose their message there).
  console.error(`Anthropic API error status=${status ?? "n/a"} model=${COPILOT_MODEL} message=${apiMsg}`);
  if (status === 401) return "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.";
  if (status === 403) return "This Anthropic API key isn't allowed to use the Copilot model. Check your Anthropic workspace permissions.";
  if (status === 404) return `The model "${COPILOT_MODEL}" isn't available to this API key. Set ANTHROPIC_MODEL to a model your key can use.`;
  if (/credit balance/i.test(apiMsg)) return "Your Anthropic account is out of credits. Add credits at console.anthropic.com → Billing, then try again.";
  if (status === 429) return "The AI is rate-limited right now. Try again in a moment.";
  if (status === 529 || status === 503) return "The AI service is overloaded right now. Try again shortly.";
  return `The Copilot couldn't answer${status ? ` (error ${status})` : ""}: ${apiMsg.slice(0, 180)}`;
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
    return { error: friendly(e) };
  }
}
