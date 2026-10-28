"use client";
import { useEffect } from "react";
import { navigate } from "@/lib/nav";
import { LAST_WS_KEY, listMyWorkspaces } from "@/lib/workspace";

/** Entry point after sign-in: open the last-used workspace, or create one. */
export default function AppEntry() {
  useEffect(() => {
    listMyWorkspaces()
      .then((mine) => {
        if (mine.length === 0) return navigate("/onboarding/", { replace: true });
        let last: string | null = null;
        try {
          last = localStorage.getItem(LAST_WS_KEY);
        } catch {
          /* storage unavailable */
        }
        const slug = mine.find((m) => m.workspace.slug === last)?.workspace.slug ?? mine[0]!.workspace.slug;
        navigate(`/w/?ws=${slug}`, { replace: true });
      })
      .catch(() => {}); // not signed in → redirected to /login
  }, []);
  return <div className="flex min-h-screen items-center justify-center text-sm text-muted">Loading your workspace…</div>;
}
