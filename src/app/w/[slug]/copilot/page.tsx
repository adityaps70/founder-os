import { Trash2 } from "lucide-react";
import { clearCopilot } from "@/actions/copilot";
import { Chat } from "@/components/copilot/chat";
import { Markdown } from "@/components/copilot/markdown";
import { PageHeader } from "@/components/ui";
import { aiConfigured } from "@/lib/ai/copilot";
import { usageFor } from "@/lib/billing/limits";
import { planFor } from "@/lib/billing/plans";
import type { CopilotMessage } from "@/lib/types";
import { getWorkspace } from "@/lib/workspace";

export const metadata = { title: "Copilot" };

export default async function CopilotPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ prompt?: string }>;
}) {
  const { slug } = await params;
  const { prompt } = await searchParams;
  const ctx = await getWorkspace(slug);
  const [{ data }, used] = await Promise.all([
    ctx.supabase
      .from("copilot_messages")
      .select("*")
      .eq("workspace_id", ctx.workspace.id)
      .eq("user_id", ctx.user.id)
      .order("created_at", { ascending: true })
      .limit(100),
    usageFor(ctx, "aiMessages"),
  ]);
  const messages = (data ?? []) as CopilotMessage[];
  const limit = planFor(ctx.workspace.plan).limits.aiMessages;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col">
      <PageHeader
        title="Copilot"
        description="Your AI chief of staff. It can see your tasks, team, goals, meetings, pipeline, finances and KPIs — and can create tasks and log decisions for you."
        actions={
          <>
            <span className="text-xs text-muted tabular-nums">
              {used}/{limit} messages this month
            </span>
            {messages.length > 0 && (
              <form action={clearCopilot.bind(null, slug)}>
                <button type="submit" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-fg">
                  <Trash2 className="h-3.5 w-3.5" /> Clear chat
                </button>
              </form>
            )}
          </>
        }
      />
      <Chat
        slug={slug}
        configured={aiConfigured()}
        initialPrompt={prompt}
        history={messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          // Pre-render stored replies on the server.
          rendered: m.role === "assistant" ? <Markdown text={m.content} /> : null,
        }))}
      />
    </div>
  );
}
