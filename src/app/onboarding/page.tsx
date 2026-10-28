"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/shell/logo";
import { OnboardingForm } from "./onboarding-form";
import { listMyWorkspaces } from "@/lib/workspace";

export default function OnboardingPage() {
  const [existing, setExisting] = useState<{ name: string; slug: string }[] | null>(null);

  useEffect(() => {
    document.title = "Set up your company · Founder OS";
    listMyWorkspaces()
      .then((m) => setExisting(m.map((r) => ({ name: r.workspace.name, slug: r.workspace.slug }))))
      .catch(() => {}); // not signed in → requireUser() redirects to /login
  }, []);

  if (!existing) return null;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-8">
        <Logo />
      </div>
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <h1 className="text-lg font-semibold">{existing.length ? "Add another company" : "Set up your company"}</h1>
        <p className="mt-1 text-sm text-muted">
          Each company gets its own workspace: goals, team, pipeline and finances. You can run several from one account.
        </p>
        <OnboardingForm />
        {existing.length > 0 && (
          <p className="mt-4 text-center text-xs text-muted">
            or go back to{" "}
            <Link className="text-accent" href={`/w/?ws=${existing[0]!.slug}`}>
              {existing[0]!.name}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
