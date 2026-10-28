"use client";
import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { MobileNav } from "@/components/shell/mobile-nav";
import { PageSkeleton } from "@/components/shell/async-page";
import { createClient } from "@/lib/supabase/client";
import { navigate, setRouter } from "@/lib/nav";
import { getSnapshot, LAST_WS_KEY, listMyWorkspaces, loadWorkspace, subscribe, clearWorkspace } from "@/lib/workspace";

const serverSnapshot = { current: null, version: 0 };

function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const sp = useSearchParams();
  const wsParam = sp.get("ws");
  const snap = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
  const [workspaces, setWorkspaces] = useState<{ name: string; slug: string }[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => setRouter(router), [router]);

  // Pick the workspace: ?ws= in the URL, else the last one used, else the first one.
  useEffect(() => {
    let alive = true;
    (async () => {
      let mine: Awaited<ReturnType<typeof listMyWorkspaces>>;
      try {
        mine = await listMyWorkspaces();
      } catch {
        return; // requireUser() already redirected to /login
      }
      if (!alive) return;
      setWorkspaces(mine.map((m) => ({ name: m.workspace.name, slug: m.workspace.slug })));
      if (mine.length === 0) return navigate("/onboarding/", { replace: true });

      let last: string | null = null;
      try {
        last = localStorage.getItem(LAST_WS_KEY);
      } catch {
        /* storage unavailable */
      }
      const slugs = mine.map((m) => m.workspace.slug);
      const target = [wsParam, getSnapshot().current?.workspace.slug, last].find((s) => s && slugs.includes(s)) ?? slugs[0]!;
      if (getSnapshot().current?.workspace.slug !== target) {
        const ctx = await loadWorkspace(target);
        if (!ctx && alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [wsParam]);

  // Keep the switcher's names fresh after renames/new workspaces.
  useEffect(() => {
    if (!snap.current) return;
    listMyWorkspaces()
      .then((mine) => setWorkspaces(mine.map((m) => ({ name: m.workspace.name, slug: m.workspace.slug }))))
      .catch(() => {});
  }, [snap.current?.workspace.name, snap.current?.workspace.id]);

  // Signed out in another tab, or session expired.
  useEffect(() => {
    const { data } = createClient().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearWorkspace();
        navigate("/login/", { replace: true });
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const ctx = snap.current;
  if (failed)
    return <div className="p-8 text-sm text-muted">Couldn't load this workspace. Try reloading the page.</div>;
  if (!ctx)
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <PageSkeleton />
      </div>
    );

  const current = { name: ctx.workspace.name, slug: ctx.workspace.slug, plan: ctx.workspace.plan };
  const sidebar = <Sidebar slug={ctx.workspace.slug} current={current} workspaces={workspaces} email={ctx.user.email} />;

  return (
    <div className="min-h-screen lg:flex">
      <MobileNav title={ctx.workspace.name}>{sidebar}</MobileNav>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-line bg-bg lg:block">{sidebar}</aside>
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </div>
      </main>
    </div>
  );
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <WorkspaceShell>{children}</WorkspaceShell>
    </Suspense>
  );
}
