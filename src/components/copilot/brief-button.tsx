"use client";
import { useActionState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { generateBrief } from "@/actions/copilot";
import { SubmitButton } from "@/components/ui/submit-button";

export function BriefButton({ slug, hasBrief }: { slug: string; hasBrief: boolean }) {
  const [state, action] = useActionState(generateBrief.bind(null, slug), null);
  return (
    <form action={action} className="flex items-center gap-2">
      {state?.error && <span className="max-w-xs text-xs text-danger">{state.error}</span>}
      <SubmitButton size="sm" variant={hasBrief ? "ghost" : "primary"} pendingText="Thinking…">
        {hasBrief ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
        {hasBrief ? "Refresh" : "Generate brief"}
      </SubmitButton>
    </form>
  );
}
