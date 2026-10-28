"use client";
// Client-side navigation helpers for the static (GitHub Pages) build.

/** Base path the site is served under, e.g. "/founder-os" on GitHub Pages. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

type Router = { push(href: string): void; replace(href: string): void };
let router: Router | null = null;

/** Registered by the app shell so non-component code (actions) can navigate. */
export function setRouter(r: Router) {
  router = r;
}

/** Absolute URL for a path inside the app (for auth redirects and invite links). */
export function appUrl(path: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}${BASE_PATH}${path}`;
}

/** Navigate within the app. `path` is app-relative (no base path). */
export function navigate(path: string, opts: { replace?: boolean } = {}) {
  if (router) {
    if (opts.replace) router.replace(path);
    else router.push(path);
  } else if (typeof window !== "undefined") {
    window.location.assign(`${BASE_PATH}${path}`);
  }
}

/**
 * Drop-in for next/navigation's redirect() in client code. It navigates and returns;
 * write `return redirect(...)` so execution stops at the call site.
 */
export function redirect(path: string): never {
  if (/^https?:\/\//.test(path)) window.location.assign(path);
  else navigate(path);
  return undefined as never;
}

export class NotFoundSignal extends Error {
  constructor() {
    super("Not found");
    this.name = "NotFoundSignal";
  }
}

/** Drop-in for next/navigation's notFound() inside page render functions (see AsyncPage). */
export function notFound(): never {
  throw new NotFoundSignal();
}

/** Validates a `next` param so we only ever navigate inside the app. */
export function safeNext(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}
