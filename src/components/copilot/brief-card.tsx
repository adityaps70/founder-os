import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getWorkspace } from "@/lib/workspace";
import { aiConfigured } from "@/lib/ai/copilot";
import { todayISO } from "@/lib/utils";
import { Markdown } from "./markdown";
import { BriefButton } from "./brief-button";

/** Today's AI morning brief, with a button to generate / refresh it. */
export async function BriefCard({ slug }: { slug: string }) {
  const ctx = await getWorkspace(slug);
  const { data: brief } = await ctx.supabase
    .from("briefs")
    .select("content, created_at")
    .eq("workspace_id", ctx.workspace.id)
    .eq("user_id", ctx.user.id)
    .eq("brief_date", todayISO())
    .maybeSingle();

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-line bg-gradient-to-br from-accent-soft to-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">Morning brief</h2>
        </div>
        <div className="flex items-center gap-2">
          {aiConfigured() ? (
            <BriefButton slug={slug} hasBrief={!!brief} />
          ) : (
            <span className="text-xs text-muted">Add ANTHROPIC_API_KEY to enable</span>
          )}
          <Link href={`/w/${slug}/copilot`} className="text-xs font-medium text-accent hover:underline">
            Ask Copilot →
          </Link>
        </div>
      </div>
      {brief ? (
        <div className="border-t border-line/60 px-4 py-3">
          <Markdown text={brief.content as string} />
        </div>
      ) : (
        <p className="border-t border-line/60 px-4 py-3 text-sm text-muted">
          Get your top 3 priorities, risks and who to chase today — generated from everything in this workspace.
        </p>
      )}
    </section>
  );
}
