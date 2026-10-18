"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp, Bot, LoaderCircle } from "lucide-react";
import { sendCopilotMessage } from "@/actions/copilot";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";

type Msg = { id: string; role: "user" | "assistant"; content: string; rendered?: React.ReactNode };

const SUGGESTIONS = [
  "What should I focus on today?",
  "Who on my team is overloaded or blocked?",
  "Which deals need a follow-up this week?",
  "Draft this month's investor update",
  "How many months of runway do we have, and what's driving burn?",
  "Run my weekly review",
];

export function Chat({
  slug,
  history,
  configured,
  initialPrompt,
}: {
  slug: string;
  history: Msg[];
  configured: boolean;
  initialPrompt?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>(history);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  function send(text: string) {
    const t = text.trim();
    if (!t || pending) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: t }]);
    startTransition(async () => {
      const res = await sendCopilotMessage(slug, t);
      if (res.ok) {
        setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: res.reply }]);
      } else {
        setError(res.error);
      }
    });
  }

  // Auto-send a prompt passed via ?prompt= (e.g. "Prep my 1:1 with …").
  useEffect(() => {
    if (initialPrompt && configured && !sentInitial.current) {
      sentInitial.current = true;
      send(initialPrompt);
      window.history.replaceState(null, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, configured]);

  return (
    <div className="flex flex-1 flex-col rounded-xl border border-line bg-surface">
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {messages.length === 0 && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Bot className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">Ask anything about your company</p>
            <p className="mt-1 text-xs text-muted">Try one of these:</p>
            <div className="mx-auto mt-4 flex max-w-2xl flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={!configured || pending}
                  className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-fg disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex gap-3", m.role === "user" && "justify-end")}>
            {m.role === "assistant" && (
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Bot className="h-4 w-4" />
              </span>
            )}
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5",
                m.role === "user" ? "bg-accent text-sm text-accent-fg" : "bg-surface-2 text-fg",
              )}
            >
              {m.role === "user" ? <p className="whitespace-pre-wrap text-sm">{m.content}</p> : m.rendered ?? <Markdown text={m.content} />}
            </div>
          </div>
        ))}
        {pending && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Looking through your workspace…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-line p-3">
        {!configured && <p className="mb-2 text-xs text-danger">Add ANTHROPIC_API_KEY to your environment to enable the Copilot.</p>}
        {error && <p className="mb-2 text-xs text-danger">{error}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder={configured ? "Ask, or tell it to create tasks… (Enter to send)" : "Copilot is not configured"}
            disabled={!configured}
            className="max-h-40 min-h-9 flex-1 resize-none rounded-lg border border-line bg-bg px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={!configured || pending || !input.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-fg disabled:opacity-40"
            aria-label="Send"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
