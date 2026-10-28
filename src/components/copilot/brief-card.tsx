"use client";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Sparkles } from "lucide-react";
import { aiConfigured } from "@/actions/copilot";
import { getSnapshot, getWorkspace, subscribe } from "@/lib/workspace";
import { todayISO } from "@/lib/utils";
import { Markdown } from "./markdown";
import { BriefButton } from "./brief-button";

/** Today's AI morning brief, with a button to generate / refresh it. */
export function BriefCard({ slug }: { slug: string }) {
  const { version } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [brief, setBrief] = useState<{ content: string } | null>(null);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ctx = await getWorkspace(slug);
      const { data } = await ctx.supabase
        .from("briefs")
        .select("content, created_at")
        .eq("workspace_id", ctx.workspace.id)
        .eq("user_id", ctx.user.id)
        .eq("brief_date", todayISO())
        .maybeSingle();
      if (alive) setBrief((data as { content: string } | null) ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [slug, version]);

  useEffect(() => {
    aiConfigured().then(setConfigured);
  }, []);

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-line bg-gradient-to-br from-accent-soft to-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">Morning brief</h2>
        </div>
        <div className="flex items-center gap-2">
          {configured ? (
            <BriefButton slug={slug} hasBrief={!!brief} />
          ) : (
            <span className="text-xs text-muted">Add ANTHROPIC_API_KEY in Supabase to enable</span>
          )}
          <Link href={`/w/copilot`} className="text-xs font-medium text-accent hover:underline">
            Ask Copilot →
          </Link>
        </div>
      </div>
      {brief ? (
        <div className="border-t border-line/60 px-4 py-3">
          <Markdown text={brief.content} />
        </div>
      ) : (
        <p className="border-t border-line/60 px-4 py-3 text-sm text-muted">
          Get your top 3 priorities, risks and who to chase today — generated from everything in this workspace.
        </p>
      )}
    </section>
  );
}
