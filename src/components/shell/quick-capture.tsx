"use client";
import { useActionState, useEffect, useRef } from "react";
import { Plus, X } from "lucide-react";
import { createCapture } from "@/actions/captures";
import { SubmitButton } from "@/components/ui/submit-button";

/** Global quick capture. Opens with ⌘K / Ctrl+K from anywhere in a workspace. */
export function QuickCapture({ slug }: { slug: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [state, action] = useActionState(createCapture.bind(null, slug), null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The sidebar renders twice (desktop + mobile); only the visible instance responds.
      if (btnRef.current?.offsetParent === null) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.showModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      const t = setTimeout(() => ref.current?.close(), 600);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => ref.current?.showModal()}
        className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-left text-sm text-muted hover:text-fg"
      >
        <Plus className="h-4 w-4" />
        <span className="flex-1">Quick capture</span>
        <kbd className="rounded border border-line px-1 text-[10px] text-faint">⌘K</kbd>
      </button>
      <dialog
        ref={ref}
        className="m-auto mt-[15vh] w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-line bg-surface p-0 text-fg shadow-2xl"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
      >
        <form ref={formRef} action={action} className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Capture</p>
            <button type="button" onClick={() => ref.current?.close()} className="text-muted hover:text-fg" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <textarea
            name="content"
            rows={3}
            autoFocus
            placeholder="A task, an idea, a note… (first line becomes the title)"
            className="w-full resize-none rounded-lg border border-line bg-bg px-3 py-2 text-sm focus:border-accent focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) formRef.current?.requestSubmit();
            }}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex gap-1 text-xs">
              {(["task", "idea", "note"] as const).map((k, i) => (
                <label key={k} className="cursor-pointer rounded-md border border-line px-2 py-1 has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent">
                  <input type="radio" name="kind" value={k} defaultChecked={i === 0} className="sr-only" />
                  {k[0]!.toUpperCase() + k.slice(1)}
                </label>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {state?.error && <span className="text-xs text-danger">{state.error}</span>}
              {state?.ok && <span className="text-xs text-success">{state.message}</span>}
              <SubmitButton size="sm">Save</SubmitButton>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}
