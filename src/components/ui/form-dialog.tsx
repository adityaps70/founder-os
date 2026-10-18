"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { ActionState } from "@/lib/types";
import { Button, type ButtonProps } from "./button";
import { SubmitButton } from "./submit-button";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * A button that opens a modal form bound to a server action.
 * The action must have the signature (prev: ActionState, fd: FormData) => Promise<ActionState>
 * (bind any leading args such as the workspace slug before passing it in).
 * The dialog closes and the form resets when the action returns { ok: true }.
 */
export function FormDialog({
  title,
  description,
  trigger,
  triggerVariant = "primary",
  triggerSize = "md",
  triggerIcon,
  submitLabel = "Save",
  action,
  children,
  wide,
}: {
  title: string;
  description?: string;
  trigger: React.ReactNode;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  triggerIcon?: React.ReactNode;
  submitLabel?: string;
  action: Action;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(action, null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (state?.ok) {
      ref.current?.close();
      formRef.current?.reset();
      setKey((k) => k + 1);
    }
  }, [state]);

  return (
    <>
      <Button variant={triggerVariant} size={triggerSize} onClick={() => ref.current?.showModal()}>
        {triggerIcon}
        {trigger}
      </Button>
      <dialog
        ref={ref}
        className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-2xl" : "max-w-lg"} rounded-2xl border border-line bg-surface p-0 text-fg shadow-2xl`}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
      >
        <form ref={formRef} action={formAction} key={key}>
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-base font-semibold">{title}</h2>
              {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
            </div>
            <button type="button" className="text-muted hover:text-fg" onClick={() => ref.current?.close()} aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">{children}</div>
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
            <p className="text-xs text-danger">{state?.error}</p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => ref.current?.close()}>
                Cancel
              </Button>
              <SubmitButton>{submitLabel}</SubmitButton>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}
