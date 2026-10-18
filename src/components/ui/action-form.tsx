"use client";
import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/types";
import { cn } from "@/lib/utils";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** An inline <form> bound to a server action that shows errors/success and resets on success. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = true,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={cn(className)}>
      {children}
      {state?.error && <p className="mt-2 text-xs text-danger">{state.error}</p>}
      {state?.ok && state.message && <p className="mt-2 text-xs text-success">{state.message}</p>}
    </form>
  );
}
