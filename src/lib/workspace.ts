"use client";
// Client-side workspace store. Replaces the old server helpers with the same names
// (getWorkspace, requireUser, listMyWorkspaces) so pages and actions keep working.
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { navigate, notFound } from "@/lib/nav";
import type { Role, TeamMember, Workspace } from "@/lib/types";

export interface WorkspaceContext {
  supabase: SupabaseClient;
  user: { id: string; email?: string };
  workspace: Workspace;
  role: Role;
  /** The signed-in user's own entry in the team (used for "me" / delegation). */
  me: TeamMember | null;
  team: TeamMember[];
}

export const LAST_WS_KEY = "fos:last-workspace";

let current: WorkspaceContext | null = null;
let version = 0;
let loading: Promise<WorkspaceContext | null> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getSnapshot() {
  return { current, version };
}

/** The signed-in user, or a redirect to /login. */
export async function requireUser(): Promise<{ supabase: SupabaseClient; user: User }> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    const here = typeof window !== "undefined" ? window.location.pathname.replace(process.env.NEXT_PUBLIC_BASE_PATH || "", "") : "/app";
    navigate(`/login/?next=${encodeURIComponent(here)}`, { replace: true });
    throw new Error("Not signed in");
  }
  return { supabase, user: session.user };
}

/** All workspaces the user belongs to (for the switcher). */
export async function listMyWorkspaces() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("workspace_members")
    .select("role, workspaces(*)")
    .eq("user_id", user.id)
    .order("created_at");
  return ((data ?? []) as unknown as { role: Role; workspaces: Workspace | null }[])
    .map((r) => ({ role: r.role, workspace: r.workspaces as Workspace }))
    .filter((r) => r.workspace);
}

async function fetchContext(slug: string): Promise<WorkspaceContext | null> {
  const { supabase, user } = await requireUser();
  const { data: workspace } = await supabase.from("workspaces").select("*").eq("slug", slug).maybeSingle();
  if (!workspace) return null;
  const [{ data: member }, { data: team }] = await Promise.all([
    supabase.from("workspace_members").select("role").eq("workspace_id", workspace.id).eq("user_id", user.id).maybeSingle(),
    supabase.from("team_members").select("*").eq("workspace_id", workspace.id).order("name"),
  ]);
  if (!member) return null;
  const teamRows = (team ?? []) as TeamMember[];
  return {
    supabase,
    user: { id: user.id, email: user.email },
    workspace: workspace as Workspace,
    role: member.role as Role,
    me: teamRows.find((t) => t.user_id === user.id) ?? null,
    team: teamRows,
  };
}

/** Load (or switch to) a workspace and make it current. */
export async function loadWorkspace(slug: string): Promise<WorkspaceContext | null> {
  const p = fetchContext(slug).then((ctx) => {
    current = ctx;
    if (ctx) {
      try {
        localStorage.setItem(LAST_WS_KEY, ctx.workspace.slug);
      } catch {
        /* storage unavailable */
      }
    }
    version++;
    emit();
    return ctx;
  });
  loading = p;
  return p;
}

/** The current workspace context. `slug` is accepted for compatibility with the old server API. */
export async function getWorkspace(slug?: string): Promise<WorkspaceContext> {
  if (current && (!slug || current.workspace.slug === slug)) return current;
  const ctx = loading ? await loading : null;
  if (ctx && (!slug || ctx.workspace.slug === slug)) return ctx;
  const loaded = slug ? await loadWorkspace(slug) : null;
  if (!loaded) notFound();
  return loaded;
}

/** Re-fetch the workspace and team, then re-render every page (call after any mutation). */
export function refreshWorkspace(_slug?: string) {
  if (current) void loadWorkspace(current.workspace.slug);
  else {
    version++;
    emit();
  }
}

/** Forget the current workspace (sign-out, leaving a workspace). */
export function clearWorkspace() {
  current = null;
  version++;
  emit();
}

export function canAdmin(role: Role) {
  return role === "owner" || role === "admin";
}
