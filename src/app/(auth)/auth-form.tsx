"use client";
import { useActionState } from "react";
import Link from "next/link";
import { signIn, signInWithGoogle, signInWithMagicLink, signUp } from "@/actions/auth";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export function AuthForm({ mode, next, error }: { mode: "login" | "signup"; next?: string; error?: string }) {
  const [state, action] = useActionState(mode === "login" ? signIn : signUp, null);
  const [magic, magicAction] = useActionState(signInWithMagicLink, null);
  const msg = state?.error ?? magic?.error ?? error;
  const ok = state?.message ?? magic?.message;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "login" ? "Sign in to run your company." : "Start free. No card needed."}
        </p>
      </div>

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next ?? ""} />
        <SubmitButton variant="secondary" className="w-full">
          Continue with Google
        </SubmitButton>
      </form>

      <div className="flex items-center gap-3 text-xs text-faint">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      <form action={action} className="space-y-3">
        <input type="hidden" name="next" value={next ?? ""} />
        {mode === "signup" && (
          <Field label="Full name">
            <Input name="full_name" autoComplete="name" required />
          </Field>
        )}
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} />
        </Field>
        <SubmitButton className="w-full">{mode === "login" ? "Sign in" : "Create account"}</SubmitButton>
      </form>

      {mode === "login" && (
        <form action={magicAction} className="space-y-2">
          <input type="hidden" name="next" value={next ?? ""} />
          <details className="text-sm">
            <summary className="cursor-pointer text-muted hover:text-fg">Email me a magic link instead</summary>
            <div className="mt-2 flex gap-2">
              <Input name="email" type="email" placeholder="you@company.com" required />
              <SubmitButton variant="secondary">Send</SubmitButton>
            </div>
          </details>
        </form>
      )}

      {msg && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-danger">{msg}</p>}
      {ok && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-success">{ok}</p>}

      <p className="text-center text-xs text-muted">
        {mode === "login" ? (
          <>
            New here? <Link className="font-medium text-accent" href={`/signup/${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Create an account</Link>
          </>
        ) : (
          <>
            Already have an account? <Link className="font-medium text-accent" href={`/login/${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Sign in</Link>
          </>
        )}
      </p>
    </div>
  );
}
