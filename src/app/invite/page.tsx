"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { acceptInvitation } from "@/actions/invitations";
import { Logo } from "@/components/shell/logo";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

async function InviteView(token: string) {
  const supabase = createClient();
  const [{ data: preview }, { data: auth }] = await Promise.all([
    supabase.rpc("invitation_preview", { p_token: token }),
    supabase.auth.getSession(),
  ]);
  const inv = (preview as { workspace_name: string; email: string; expired: boolean }[] | null)?.[0];
  const user = (auth?.session?.user ?? null) as { email?: string } | null;
  const next = encodeURIComponent(`/invite/?token=${token}`);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8">
        <Logo />
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 text-center shadow-sm">
        {!inv ? (
          <>
            <h1 className="text-lg font-semibold">Invitation not found</h1>
            <p className="mt-2 text-sm text-muted">This link is invalid. Ask the person who invited you for a new one.</p>
          </>
        ) : inv.expired ? (
          <>
            <h1 className="text-lg font-semibold">This invitation has expired</h1>
            <p className="mt-2 text-sm text-muted">Ask an admin of {inv.workspace_name} to send a new invite.</p>
          </>
        ) : (
          <>
            <p className="text-xs font-medium uppercase tracking-wide text-faint">You're invited</p>
            <h1 className="mt-1 text-lg font-semibold">Join {inv.workspace_name} on Founder OS</h1>
            <p className="mt-2 text-sm text-muted">This invite is for {inv.email}.</p>
            <div className="mt-6">
              {user ? (
                user.email?.toLowerCase() === inv.email.toLowerCase() ? (
                  <ActionForm action={acceptInvitation.bind(null, token)}>
                    <SubmitButton className="w-full">Accept and continue</SubmitButton>
                  </ActionForm>
                ) : (
                  <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-warning">
                    You're signed in as {user.email}. Sign out and sign in as {inv.email} to accept.
                  </p>
                )
              ) : (
                <div className="space-y-2">
                  <Link href={`/signup/?next=${next}`} className={buttonClass("primary", "md", "w-full")}>
                    Create account
                  </Link>
                  <Link href={`/login/?next=${next}`} className={buttonClass("secondary", "md", "w-full")}>
                    I already have an account
                  </Link>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Invite() {
  const token = useSearchParams().get("token") ?? "";
  const [node, setNode] = useState<React.ReactNode>(null);
  useEffect(() => {
    document.title = "Join workspace · Founder OS";
    InviteView(token).then(setNode);
  }, [token]);
  return <>{node}</>;
}

export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <Invite />
    </Suspense>
  );
}
