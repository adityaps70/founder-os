"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { navigate, safeNext } from "@/lib/nav";

type OtpType = "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email";

/** Lands here after Google sign-in, magic links and email confirmations. */
function Callback() {
  const sp = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const next = safeNext(sp.get("next"));
    const tokenHash = sp.get("token_hash");
    const type = sp.get("type") as OtpType | null;
    const errDesc = sp.get("error_description");
    (async () => {
      if (errDesc) return setError(errDesc);
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
        if (error) return setError(error.message);
      } else if (sp.get("code")) {
        // detectSessionInUrl exchanges the PKCE code on start-up; this covers the race where it hasn't yet.
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          const { error } = await supabase.auth.exchangeCodeForSession(sp.get("code")!);
          if (error) return setError(error.message);
        }
      }
      const { data } = await supabase.auth.getSession();
      if (!data.session) return setError("Could not sign you in. Try again.");
      navigate(next, { replace: true });
    })();
  }, [sp]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 text-center">
      {error ? (
        <div>
          <p className="text-sm text-danger">{error}</p>
          <button className="mt-4 text-sm text-accent" onClick={() => navigate("/login/", { replace: true })}>
            Back to sign in
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted">Signing you in…</p>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <Callback />
    </Suspense>
  );
}
