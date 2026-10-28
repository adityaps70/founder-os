"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { NotFoundSignal } from "@/lib/nav";
import { getSnapshot, subscribe } from "@/lib/workspace";
import { buttonClass } from "@/components/ui/button";
import Link from "next/link";

type RenderProps = {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

const serverSnapshot = { current: null, version: 0 };

/**
 * Runs a page's async render function in the browser and shows the result.
 * Re-runs whenever the workspace changes, a mutation calls refreshWorkspace(), or the query string changes.
 * Pages keep their original "async server component" shape: (props) => Promise<JSX>.
 */
export function AsyncPage({ render, title }: { render: (props: RenderProps) => Promise<React.ReactNode>; title?: string }) {
  const snap = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
  const sp = useSearchParams();
  const query = sp.toString();
  const [node, setNode] = useState<React.ReactNode>(null);
  const [state, setState] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (title) document.title = `${title} · Founder OS`;
  }, [title]);

  const slug = snap.current?.workspace.slug;
  useEffect(() => {
    if (!slug) return;
    let alive = true;
    const qs = Object.fromEntries(new URLSearchParams(query)) as Record<string, string | undefined>;
    render({ params: Promise.resolve({ slug, id: qs.id ?? "" }), searchParams: Promise.resolve(qs) })
      .then((n) => {
        if (!alive) return;
        setNode(n);
        setState("ready");
      })
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof NotFoundSignal) setState("notfound");
        else {
          console.error(e);
          setError(e instanceof Error ? e.message : String(e));
          setState("error");
        }
      });
    return () => {
      alive = false;
    };
  }, [render, slug, snap.version, query]);

  if (state === "notfound")
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <h1 className="text-lg font-semibold">Not found</h1>
        <p className="mt-2 text-sm text-muted">It may have been deleted, or it belongs to another workspace.</p>
        <Link href="/w/" className={buttonClass("secondary", "md", "mt-6")}>
          Back to Command Center
        </Link>
      </div>
    );
  if (state === "error")
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 max-w-md text-sm text-muted">{error}</p>
      </div>
    );
  if (state === "loading") return <PageSkeleton />;
  return <>{node}</>;
}

export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-7 w-48 rounded-lg bg-surface-2" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
